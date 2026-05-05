"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PositionStatus } from "@prisma/client";
import { getCallerPermissions } from "@/lib/rbac";

const VALID_STATUSES = Object.values(PositionStatus);

export async function updatePosition(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) throw new Error("Unauthorized");

    // ── Extract id from hidden input ─────────────────────────────
    const id = (formData.get("id") as string)?.trim();
    if (!id) throw new Error("Position ID is missing.");

    // ── Org-scoped check ─────────────────────────────────────────
    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) throw new Error("Position not found.");
    if (existing.organizationId !== perms.orgId) throw new Error("Forbidden.");

    // ── Extract fields ───────────────────────────────────────────
    const title          = (formData.get("title")          as string)?.trim();
    const departmentId   = (formData.get("department")     as string)?.trim() || null;
    const location       = (formData.get("location")       as string)?.trim() || null;
    const employmentType = (formData.get("employmentType") as string)?.trim() || null;
    const rawStatus      = (formData.get("status")         as string)?.trim();
    const description    = (formData.get("description")    as string)?.trim() || null;
    const jdText         = (formData.get("jdText")         as string)?.trim() || null;

    // AI Pipeline Configuration
    const intakeWindowDays   = parseInt((formData.get("intakeWindowDays") as string) || existing.intakeWindowDays.toString(), 10);
    const atsPreScreenSize   = parseInt((formData.get("atsPreScreenSize") as string) || existing.atsPreScreenSize.toString(), 10);
    const aiShortlistSize    = parseInt((formData.get("aiShortlistSize")  as string) || existing.aiShortlistSize.toString(), 10);
    const autoProcessOnClose = formData.get("autoProcessOnClose") === "true";
    const autoInviteAiScreen  = formData.get("autoInviteAiScreen") === "true";
    const resumePurgeDays    = parseInt((formData.get("resumePurgeDays")  as string) || existing.resumePurgeDays.toString(), 10);
    const aiGenerationStrategy = (formData.get("aiGenerationStrategy") as string) || "STANDARDIZED";

    if (!title) throw new Error("Position title is required.");

    // Resolve department name from ID
    let department: string | null = null;
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
      department = dept?.name ?? null;
    }

    const status: PositionStatus = VALID_STATUSES.includes(rawStatus as PositionStatus)
      ? (rawStatus as PositionStatus)
      : existing.status;

    // ── Persist ──────────────────────────────────────────────────
    await prisma.position.update({
      where: { id },
      data: {
        title,
        department,
        departmentId,
        location,
        employmentType,
        description,
        jdText,
        status,
        intakeWindowDays,
        atsPreScreenSize,
        aiShortlistSize,
        autoProcessOnClose,
        autoInviteAiScreen,
        resumePurgeDays,
      },
    });

    console.log(`[updatePosition] Updated position ${id} — "${title}"`);

    // ── Update interview pipeline plan if stages provided ─────
    const pipelineRaw = (formData.get("pipelineStages") as string)?.trim();
    if (pipelineRaw) {
      try {
        const stages = JSON.parse(pipelineRaw) as {
          roundLabel: string;
          roundType: string;
          durationMinutes: number;
          isRequired?: boolean;
          description?: string | null;
          assignedPanelJson?: any;
        }[];
        if (Array.isArray(stages)) {
          // Find existing plan
          const plan = await prisma.interviewPlan.findUnique({ where: { positionId: id } });
          
          if (plan) {
            // Delete existing stages and recreate
            await prisma.interviewStage.deleteMany({ where: { interviewPlanId: plan.id } });
            if (stages.length > 0) {
              await prisma.interviewPlan.update({
                where: { id: plan.id },
                data: {
                  stages: {
                    create: stages.map((s, i) => ({
                      stageIndex: i,
                      roundLabel: s.roundLabel,
                      roundType: s.roundType as any,
                      durationMinutes: s.durationMinutes,
                      isRequired: s.isRequired ?? true,
                      description: s.description || null,
                      assignedPanelJson: s.assignedPanelJson || null,
                    })),
                  },
                },
              });
            }
          } else if (stages.length > 0) {
            // Create new plan
            await prisma.interviewPlan.create({
              data: {
                positionId: id,
                stages: {
                  create: stages.map((s, i) => ({
                    stageIndex: i,
                    roundLabel: s.roundLabel,
                    roundType: s.roundType as any,
                    durationMinutes: s.durationMinutes,
                    isRequired: s.isRequired ?? true,
                    description: s.description || null,
                    assignedPanelJson: s.assignedPanelJson || null,
                  })),
                },
              },
            });
          }
          console.log(`[updatePosition] Updated interview plan with ${stages.length} stages`);
        }
      } catch (planErr) {
        console.error("[updatePosition] Pipeline update failed (non-blocking):", planErr);
      }
    }

    // ── Update AI Interview Config ──────────────────────────────
    try {
      const existingConfig = await prisma.aiInterviewConfig.findFirst({
        where: { positionId: id, interviewId: null }
      });
      if (existingConfig) {
        await prisma.aiInterviewConfig.update({
          where: { id: existingConfig.id },
          data: { generationStrategy: aiGenerationStrategy as any }
        });
      } else {
        await prisma.aiInterviewConfig.create({
          data: {
            positionId: id,
            generationStrategy: aiGenerationStrategy as any,
            difficulty: "MEDIUM",
            durationMinutes: 30,
            introQuestions: 2,
            technicalQuestions: 4,
            behavioralQuestions: 3,
          }
        });
      }
    } catch (aiErr) {
      console.error("[updatePosition] AI Config update failed (non-blocking):", aiErr);
    }

    // ── Position Close Side-Effects ──────────────────────────────
    // When status transitions to CLOSED, trigger the full ATS close workflow:
    // 1. Auto-unpublish from all boards (Indeed XML + Google JSON-LD)
    // 2. Archive all pending intake candidates
    // 3. Send closure emails to public applicants
    const isClosing =
      (status === "CLOSED" || status === "ARCHIVED") &&
      existing.status !== "CLOSED" &&
      existing.status !== "ARCHIVED";

    if (isClosing) {
      await handlePositionClose(id, title || existing.title, perms.orgId);
    }

  } catch (error) {
    console.error(">>> [updatePosition] Error:", error);
    throw error;
  }

  // redirect() must live outside try/catch
  const id = (formData.get("id") as string)?.trim();
  redirect(`/org-admin/positions/${id}`);
}

/**
 * Handles all side-effects when a position is closed:
 * 1. Unpublish from Indeed + Google (set isPublished=false, close distributions)
 * 2. Archive all pending intake candidates
 * 3. Send closure notification emails to public applicants
 */
async function handlePositionClose(
  positionId: string,
  positionTitle: string,
  orgId: string
) {
  console.log(`[PositionClose] 🔒 Closing position "${positionTitle}" (${positionId})`);

  // ── 1. Unpublish from all boards ────────────────────────────────────────
  await prisma.position.update({
    where: { id: positionId },
    data: { isPublished: false },
  });

  await prisma.jobDistribution.updateMany({
    where: { positionId, status: "LIVE" },
    data: {
      status: "CLOSED",
      unpublishedAt: new Date(),
    },
  });

  console.log(`[PositionClose] ✅ Unpublished from Indeed XML + Google Jobs`);

  // ── 2. Archive all pending intake candidates ────────────────────────────
  const pendingStatuses = ["RECEIVED", "TIER1_PASS", "TIER2_SCORING", "TIER2_SCORED", "SHORTLISTED"];
  const pendingCandidates = await prisma.intakeCandidate.findMany({
    where: {
      positionId,
      finalStatus: { in: pendingStatuses as never[] },
    },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      consentSource: true,
    },
  });

  if (pendingCandidates.length > 0) {
    await prisma.intakeCandidate.updateMany({
      where: {
        positionId,
        finalStatus: { in: pendingStatuses as never[] },
      },
      data: {
        finalStatus: "ARCHIVED",
        archivedAt: new Date(),
      },
    });

    console.log(
      `[PositionClose] 📦 Archived ${pendingCandidates.length} pending intake candidates`
    );
  }

  // ── 3. Send closure emails to public applicants (fire-and-forget) ──────
  const publicApplicants = pendingCandidates.filter(
    (c) => c.consentSource === "direct_consent" && c.candidateEmail
  );

  if (publicApplicants.length > 0) {
    // Dynamic import to avoid loading email service on every position update
    const { emailService } = await import("@/lib/email");

    for (const candidate of publicApplicants) {
      emailService
        .sendGenericEmail({
          to: candidate.candidateEmail,
          subject: `Position update — ${positionTitle}`,
          heading: "Position Has Been Filled",
          body: `Hi ${candidate.candidateName || "there"},\n\nThe <strong>${positionTitle}</strong> position has been filled and is no longer accepting applications.\n\nThank you for your interest — we appreciate the time you invested in applying.\n\nJoin the <strong>IQMela Talent Network</strong> to get automatically matched to similar roles when they open.`,
          ctaLabel: "Join the Talent Network",
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"}/careers`,
        })
        .catch((err: unknown) =>
          console.warn(`[PositionClose] Email to ${candidate.candidateEmail} failed:`, err)
        );
    }

    console.log(
      `[PositionClose] 📧 Sent closure emails to ${publicApplicants.length} candidates`
    );
  }

  // ── 4. Audit log ───────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: "system",
      action: "POSITION_CLOSED",
      resourceType: "Position",
      resourceId: positionId,
      metadata: {
        distributionsClosed: true,
        intakeCandidatesArchived: pendingCandidates.length,
        closureEmailsSent: publicApplicants.length,
      },
    },
  });

  console.log(`[PositionClose] ✅ Position close workflow complete`);
}
