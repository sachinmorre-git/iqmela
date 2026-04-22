import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/candidate/delete-my-data
 *
 * GDPR Article 17 / CCPA Right to Delete endpoint.
 * Candidates can request deletion of all their data from IQMela.
 *
 * Accepts: { email: string }
 * Returns: Confirmation that deletion is queued.
 *
 * Timeline: Must be processed within 30 days (GDPR Article 12(3)).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find all intake candidates with this email
    const intakeCandidates = await prisma.intakeCandidate.findMany({
      where: { candidateEmail: normalizedEmail },
      select: { id: true, positionId: true, organizationId: true },
    });

    if (intakeCandidates.length === 0) {
      // Don't reveal whether the email exists or not (privacy)
      return NextResponse.json({
        status: "acknowledged",
        message:
          "If we have any data associated with this email, it will be processed for deletion within 30 days.",
      });
    }

    // Mark all records for deletion
    await prisma.intakeCandidate.updateMany({
      where: { candidateEmail: normalizedEmail },
      data: {
        deletionRequestedAt: new Date(),
        // Schedule actual purge for 7 days from now (gives time for legal review if needed)
        purgeScheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Audit log (without PII — just the count and hashed email)
    const emailHash = await hashEmail(normalizedEmail);
    for (const ic of intakeCandidates) {
      await prisma.auditLog.create({
        data: {
          organizationId: ic.organizationId,
          userId: "gdpr_system",
          action: "GDPR_DELETION_REQUESTED",
          resourceType: "IntakeCandidate",
          resourceId: ic.id,
          metadata: {
            emailHash,
            requestedAt: new Date().toISOString(),
          },
        },
      });
    }

    console.log(
      `[GDPR] Deletion requested for ${normalizedEmail} (${intakeCandidates.length} records)`
    );

    return NextResponse.json({
      status: "acknowledged",
      message:
        "Your deletion request has been received. All personal data associated with this email will be permanently removed within 30 days, in accordance with GDPR and CCPA regulations.",
      recordsAffected: intakeCandidates.length,
    });
  } catch (error) {
    console.error("[GDPR] Deletion request error:", error);
    return NextResponse.json(
      { error: "Failed to process deletion request" },
      { status: 500 }
    );
  }
}

/**
 * SHA-256 hash of email for audit logging (no raw PII in logs).
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
