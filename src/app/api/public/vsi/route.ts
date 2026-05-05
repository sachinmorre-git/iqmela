import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/vsi
 *
 * Sealed Voluntary Self-Identification endpoint.
 * Stores EEO/OFCCP compliance data in the isolated CandidateVSI table.
 *
 * This data is NEVER surfaced to hiring managers or org-admin APIs.
 * Only aggregate counts may be used for EEO-1 reporting.
 *
 * Security:
 * - No auth required (fire-and-forget from the public careers page)
 * - Linked to IntakeCandidate → candidate email → CandidateProfile
 * - Accepts partial data (any field can be null/skipped)
 * - Failures are non-blocking to the candidate experience
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      intakeCandidateId,
      gender,
      race,
      veteranStatus,
      disabilityStatus,
    } = body;

    if (!intakeCandidateId) {
      return NextResponse.json(
        { error: "intakeCandidateId is required" },
        { status: 400 }
      );
    }

    // Find the intake candidate → get their linked profile
    const intake = await prisma.intakeCandidate.findUnique({
      where: { id: intakeCandidateId },
      select: { candidateEmail: true, linkedProfileId: true },
    });

    if (!intake) {
      // Silently succeed — don't leak application existence
      return NextResponse.json({ success: true });
    }

    // Try to find or resolve the profile ID
    let profileId = intake.linkedProfileId;

    if (!profileId) {
      // Try to find by email — the candidate may have a profile from a previous network signup
      const user = await prisma.user.findFirst({
        where: { email: intake.candidateEmail },
        select: {
          candidateProfile: { select: { id: true } },
        },
      });
      profileId = user?.candidateProfile?.id || null;
    }

    if (!profileId) {
      // No profile to link to yet — silently succeed.
      // VSI will be collected when they join the Talent Network.
      console.log(
        `[VSI] No profile found for ${intake.candidateEmail} — skipping (non-blocking)`
      );
      return NextResponse.json({ success: true });
    }

    // Upsert the VSI data (idempotent — same candidate can update)
    await prisma.candidateVSI.upsert({
      where: { profileId },
      create: {
        profileId,
        gender: gender || null,
        race: race || null,
        veteranStatus: veteranStatus || null,
        disabilityStatus: disabilityStatus || null,
        completedAt: new Date(),
      },
      update: {
        ...(gender !== undefined ? { gender } : {}),
        ...(race !== undefined ? { race } : {}),
        ...(veteranStatus !== undefined ? { veteranStatus } : {}),
        ...(disabilityStatus !== undefined ? { disabilityStatus } : {}),
        completedAt: new Date(),
      },
    });

    console.log(`[VSI] ✅ Saved for profile ${profileId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Non-blocking — VSI is optional. Never fail the candidate experience.
    console.error("[VSI] Error (non-blocking):", error);
    return NextResponse.json({ success: true });
  }
}
