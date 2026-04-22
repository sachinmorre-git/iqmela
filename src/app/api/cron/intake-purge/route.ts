import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

/**
 * GET /api/cron/intake-purge
 *
 * Vercel Cron job — runs weekly.
 * Finds all IntakeCandidate records past their purge date and:
 * 1. Anonymizes PII (name → "REDACTED", email → SHA-256 hash)
 * 2. Clears resume text and file references
 * 3. Sets finalStatus to PURGED
 * 4. Logs action to AuditLog for compliance trail
 *
 * Schedule: Weekly (configured in vercel.json)
 * GDPR Article 5(1)(e): "kept no longer than is necessary"
 */
export async function GET(request: Request) {
  // Verify Vercel Cron authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find candidates due for purge
    const candidatesToPurge = await prisma.intakeCandidate.findMany({
      where: {
        purgeScheduledAt: { lte: now },
        finalStatus: { notIn: ["PURGED", "PROMOTED"] }, // Never purge promoted candidates
      },
      select: {
        id: true,
        candidateEmail: true,
        organizationId: true,
        positionId: true,
        resumeFileUrl: true,
      },
      take: 500, // Process in batches to avoid timeout
    });

    console.log(
      `[IntakePurge] Found ${candidatesToPurge.length} candidates due for purge`
    );

    let purgedCount = 0;
    let errors = 0;

    for (const candidate of candidatesToPurge) {
      try {
        // Hash email before anonymization (for audit trail)
        const emailHash = await hashEmail(candidate.candidateEmail);

        // Delete resume file from storage (Vercel Blob or local)
        if (candidate.resumeFileUrl) {
          try {
            await deleteFile(candidate.resumeFileUrl);
            console.log(`[IntakePurge] Deleted resume file: ${candidate.resumeFileUrl}`);
          } catch (fileErr) {
            console.warn(`[IntakePurge] Failed to delete file ${candidate.resumeFileUrl}:`, fileErr);
            // Continue with anonymization even if file deletion fails
          }
        }

        // Anonymize the record
        await prisma.intakeCandidate.update({
          where: { id: candidate.id },
          data: {
            candidateName: "REDACTED",
            candidateEmail: `purged_${emailHash.substring(0, 12)}@redacted.local`,
            phone: null,
            linkedinUrl: null,
            location: null,
            resumeText: null,
            resumeFileUrl: null,
            resumeFileName: null,
            knockoutAnswersJson: Prisma.JsonNull,
            tier2Rationale: null,
            tier2MatchedSkills: Prisma.JsonNull,
            tier2MissingSkills: Prisma.JsonNull,
            finalStatus: "PURGED",
            deletionCompletedAt: now,
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            organizationId: candidate.organizationId,
            userId: "cron_intake_purge",
            action: "INTAKE_DATA_PURGED",
            resourceType: "IntakeCandidate",
            resourceId: candidate.id,
            metadata: {
              emailHash,
              reason: "AUTO_RETENTION_EXPIRY",
              purgedAt: now.toISOString(),
            },
          },
        });

        purgedCount++;
      } catch (err) {
        console.error(
          `[IntakePurge] Failed to purge candidate ${candidate.id}:`,
          err
        );
        errors++;
      }
    }

    const result = {
      status: "complete",
      purged: purgedCount,
      errors,
      remaining: candidatesToPurge.length - purgedCount,
      processedAt: now.toISOString(),
    };

    console.log(`[IntakePurge] Complete:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[IntakePurge] Cron error:", error);
    return NextResponse.json(
      { error: "Purge cron failed" },
      { status: 500 }
    );
  }
}

async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
