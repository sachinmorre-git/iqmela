import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { intakeClosesAt } from "@/lib/intake-window"
import { autoShortlistTopN } from "@/lib/intake-scoring"

/**
 * GET /api/cron/process-closed-positions
 *
 * Cron-compatible endpoint that finds positions whose intake window just closed
 * with autoProcessOnClose enabled, and triggers the full AI pipeline.
 *
 * Security: Requires Bearer token matching CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") || ""
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find all published positions with autoProcessOnClose enabled
    const candidates = await prisma.position.findMany({
      where: {
        isPublished: true,
        isDeleted: false,
        autoProcessOnClose: true,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        intakeWindowDays: true,
        intakeTopN: true,
        aiLastPipelineRunAt: true,
        organizationId: true,
      },
    })

    const now = new Date()
    const processed: string[] = []
    const skipped: string[] = []

    for (const pos of candidates) {
      const closes = intakeClosesAt(pos)

      // Only process if window has closed AND we haven't already run the pipeline after close
      if (now < closes) {
        skipped.push(pos.id) // window still open
        continue
      }

      if (pos.aiLastPipelineRunAt && pos.aiLastPipelineRunAt > closes) {
        skipped.push(pos.id) // already processed after close
        continue
      }

      // Trigger the pipeline — import dynamically to avoid circular deps
      try {
        const { bulkProcessAllAction } = await import(
          "@/app/org-admin/positions/[id]/actions"
        )
        const result = await bulkProcessAllAction(pos.id, false)

        // Now run intake shortlisting (race-safe — only runs at window close)
        const shortlistResult = await autoShortlistTopN(pos.id, pos.intakeTopN)
        console.log(
          `[Cron] Intake shortlisted ${shortlistResult.shortlisted} candidates for ${pos.title} (${shortlistResult.needsReview} need review)`
        )

        // Update the pipeline timestamp
        await prisma.position.update({
          where: { id: pos.id },
          data: { aiLastPipelineRunAt: new Date() },
        })

        // Close all live external distributions
        const liveDistributions = await prisma.jobDistribution.findMany({
          where: {
            positionId: pos.id,
            status: "LIVE",
            distributionTier: { in: ["DIRECT", "NETWORK"] },
          },
        })

        for (const dist of liveDistributions) {
          try {
            const { closeJobOnLinkedIn, closeJobOnIndeed, closeJobViaNetwork } =
              await import("@/lib/job-push")

            if (dist.distributionTier === "NETWORK" && dist.boardJobId) {
              const platform = dist.boardName.replace("_NETWORK", "") as "LINKEDIN" | "INDEED"
              await closeJobViaNetwork(dist.boardJobId, platform)
            } else if (dist.distributionTier === "DIRECT" && dist.boardJobId) {
              // Need the org's integration token
              const orgIntegration = await prisma.orgIntegration.findFirst({
                where: {
                  organizationId: pos.organizationId!,
                  platform: dist.boardName.replace("_DIRECT", ""),
                  status: "ACTIVE",
                },
              })
              if (orgIntegration) {
                if (dist.boardName.includes("LINKEDIN")) {
                  await closeJobOnLinkedIn(dist.boardJobId, orgIntegration.accessToken)
                } else {
                  await closeJobOnIndeed(dist.boardJobId, orgIntegration.accessToken)
                }
              }
            }

            await prisma.jobDistribution.update({
              where: { id: dist.id },
              data: { status: "CLOSED", unpublishedAt: new Date() },
            })
          } catch (closeErr) {
            console.error(`[cron:auto-process] Failed to close distribution ${dist.id}:`, closeErr)
          }
        }

        // Also mark organic distributions as closed
        await prisma.jobDistribution.updateMany({
          where: { positionId: pos.id, status: "LIVE", distributionTier: "ORGANIC" },
          data: { status: "CLOSED", unpublishedAt: new Date() },
        })

        // ── Notify recruiters that intake window closed and pipeline ran ──
        if (pos.organizationId) {
          try {
            const closeOrgId = pos.organizationId
            const { createBulkNotifications } = await import("@/lib/notification-service")
            const recruiters = await prisma.user.findMany({
              where: {
                organizationId: closeOrgId,
                roles: { hasSome: ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"] },
                isDeleted: false,
              },
              select: { id: true },
            })

            if (recruiters.length > 0) {
              await createBulkNotifications(
                recruiters.map((u) => ({
                  organizationId: closeOrgId,
                  userId: u.id,
                  type: "POSITION_CLOSED" as const,
                  title: "Intake Window Closed",
                  body: `The intake window for "${pos.title}" has closed. AI pipeline has been triggered automatically — candidates are ready for review.`,
                  link: `/org-admin/positions/${pos.id}`,
                })),
              )
            }
          } catch (notifyErr) {
            console.warn("[cron:auto-process] Close notification failed (non-blocking):", notifyErr)
          }
        }

        console.log(
          `[cron:auto-process] Processed "${pos.title}" (${pos.id}):`,
          result.success ? "OK" : result.error
        )
        processed.push(pos.id)
      } catch (err) {
        console.error(`[cron:auto-process] Failed for ${pos.id}:`, err)
      }
    }

    // ── Detect stale distributions (past intake deadline but still LIVE) ──
    const staleAlerted: string[] = []
    try {
      // Find positions past their intake window that still have LIVE distributions
      const allPositions = await prisma.position.findMany({
        where: {
          isPublished: true,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          organizationId: true,
          createdAt: true,
          intakeWindowDays: true,
        },
      })

      for (const pos of allPositions) {
        const closes = intakeClosesAt(pos)
        if (now < closes) continue // still open, skip

        // Check for any LIVE external distributions
        const liveExternalCount = await prisma.jobDistribution.count({
          where: { positionId: pos.id, status: "LIVE" },
        })

        if (liveExternalCount > 0 && pos.organizationId) {
          const staleOrgId = pos.organizationId
          const { createBulkNotifications } = await import("@/lib/notification-service")
          const recruiters = await prisma.user.findMany({
            where: {
              organizationId: staleOrgId,
              roles: { hasSome: ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"] },
              isDeleted: false,
            },
            select: { id: true },
          })

          if (recruiters.length > 0) {
            await createBulkNotifications(
              recruiters.map((u) => ({
                organizationId: staleOrgId,
                userId: u.id,
                type: "POSITION_STALE_DISTRIBUTION" as const,
                title: "⚠️ Stale Job Listing Detected",
                body: `"${pos.title}" has ${liveExternalCount} active listing(s) on job boards, but the intake window closed ${Math.floor((now.getTime() - closes.getTime()) / 86400000)} day(s) ago. Please unpublish or extend the deadline.`,
                link: `/org-admin/positions/${pos.id}`,
              })),
            )
          }
          staleAlerted.push(pos.id)
        }
      }
    } catch (staleErr) {
      console.warn("[cron:auto-process] Stale distribution check failed (non-blocking):", staleErr)
    }

    return NextResponse.json({
      processed: processed.length,
      skipped: skipped.length,
      processedIds: processed,
      staleAlerted: staleAlerted.length,
    })
  } catch (err) {
    console.error("[cron:auto-process] Unhandled error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
