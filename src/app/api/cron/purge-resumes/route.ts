import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deleteFile } from "@/lib/storage"

/**
 * GET /api/cron/purge-resumes
 *
 * Cron-compatible endpoint that purges stored resume files
 * older than the position's resumePurgeDays setting.
 *
 * The resume METADATA (candidate name, scores, etc.) is preserved.
 * Only the stored file is deleted, and storagePath is set to "PURGED".
 *
 * Security: Requires Bearer token matching CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find all resumes that have a storagePath and whose position has a purge policy
    const candidates = await prisma.resume.findMany({
      where: {
        NOT: { storagePath: "PURGED" },
      },
      select: {
        id: true,
        storagePath: true,
        uploadedAt: true,
        position: {
          select: { resumePurgeDays: true },
        },
      },
    })

    let purged = 0
    let failed = 0

    for (const resume of candidates) {
      const purgeDays = resume.position.resumePurgeDays ?? 90
      const uploadedAt = resume.uploadedAt || new Date()
      const purgeAfter = new Date(uploadedAt)
      purgeAfter.setDate(purgeAfter.getDate() + purgeDays)

      if (now < purgeAfter) continue // Not yet eligible

      try {
        // Delete the actual file from storage
        if (resume.storagePath) {
          await deleteFile(resume.storagePath)
        }

        // Mark as purged (keep metadata)
        await prisma.resume.update({
          where: { id: resume.id },
          data: { storagePath: "PURGED" },
        })

        purged++
      } catch (err) {
        console.error(`[cron:purge] Failed to purge resume ${resume.id}:`, err)
        failed++
      }
    }

    console.log(`[cron:purge] Purged ${purged} files. Failed: ${failed}`)

    return NextResponse.json({ purged, failed, total: candidates.length })
  } catch (err) {
    console.error("[cron:purge] Unhandled error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
