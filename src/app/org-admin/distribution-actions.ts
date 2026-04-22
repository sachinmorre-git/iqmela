"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Publishes a position to free distribution channels (Indeed XML + Google Jobs).
 * Creates JobDistribution records for tracking.
 */
export async function publishPositionAction(positionId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const position = await prisma.position.findFirst({
    where: { id: positionId, organizationId: orgId, isDeleted: false },
  });
  if (!position) throw new Error("Position not found");

  // Update the position as published
  await prisma.position.update({
    where: { id: positionId },
    data: { isPublished: true },
  });

  // Create/upsert distribution records for free channels
  const channels = ["INDEED", "GOOGLE_JOBS"];
  for (const channel of channels) {
    await prisma.jobDistribution.upsert({
      where: {
        positionId_boardName: {
          positionId,
          boardName: channel,
        },
      },
      create: {
        positionId,
        boardName: channel,
        status: "LIVE",
        publishedAt: new Date(),
      },
      update: {
        status: "LIVE",
        publishedAt: new Date(),
        unpublishedAt: null,
        errorMessage: null,
      },
    });
  }

  // Log the action
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: (await auth()).userId || "system",
      action: "POSITION_PUBLISHED",
      resourceType: "Position",
      resourceId: positionId,
      metadata: { channels },
    },
  });

  console.log(
    `[Distribution] 📡 Position "${position.title}" published to Indeed + Google Jobs`
  );

  revalidatePath(`/org-admin/positions/${positionId}`);
  return { success: true, channels };
}

/**
 * Unpublishes a position from all distribution channels.
 */
export async function unpublishPositionAction(positionId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

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

  console.log(`[Distribution] Position ${positionId} unpublished from all channels`);

  revalidatePath(`/org-admin/positions/${positionId}`);
  return { success: true };
}

/**
 * Gets aggregate statistics for the intake queue.
 */
export async function getIntakeStatsAction(positionId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const where = { positionId, organizationId: orgId };
  const [total, tier1Pass, tier1Fail, tier2Scored, shortlisted, promoted, archived] =
    await Promise.all([
      prisma.intakeCandidate.count({ where }),
      prisma.intakeCandidate.count({
        where: { ...where, finalStatus: "TIER1_PASS" },
      }),
      prisma.intakeCandidate.count({
        where: { ...where, tier1Status: "TIER1_FAIL" },
      }),
      prisma.intakeCandidate.count({
        where: { ...where, finalStatus: "TIER2_SCORED" },
      }),
      prisma.intakeCandidate.count({
        where: { ...where, finalStatus: "SHORTLISTED" },
      }),
      prisma.intakeCandidate.count({
        where: { ...where, finalStatus: "PROMOTED" },
      }),
      prisma.intakeCandidate.count({
        where: { ...where, finalStatus: "ARCHIVED" },
      }),
    ]);

  return { total, tier1Pass, tier1Fail, tier2Scored, shortlisted, promoted, archived };
}

/**
 * Gets paginated intake candidates with scores.
 */
export async function getIntakeCandidatesAction(
  positionId: string,
  options?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: "tier2Score" | "createdAt";
    sortOrder?: "asc" | "desc";
  }
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const page = options?.page || 1;
  const limit = options?.limit || 25;
  const skip = (page - 1) * limit;

  const where = {
    positionId,
    ...(options?.status ? { finalStatus: options.status as never } : {}),
  };

  const [candidates, total] = await Promise.all([
    prisma.intakeCandidate.findMany({
      where,
      orderBy: {
        [options?.sortBy || "tier2Score"]: options?.sortOrder || "desc",
      },
      skip,
      take: limit,
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        phone: true,
        location: true,
        source: true,
        tier1Score: true,
        tier1Reasons: true,
        tier2Score: true,
        tier2Label: true,
        tier2Rationale: true,
        tier2MatchedSkills: true,
        tier2MissingSkills: true,
        finalStatus: true,
        promotedToResumeId: true,
        createdAt: true,
      },
    }),
    prisma.intakeCandidate.count({ where }),
  ]);

  return {
    candidates,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Promotes a single intake candidate to the active pipeline.
 * Creates a Resume record and optionally triggers AI extraction.
 */
export async function promoteIntakeCandidateAction(intakeCandidateId: string) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) throw new Error("Unauthorized");

  const intake = await prisma.intakeCandidate.findUnique({
    where: { id: intakeCandidateId },
    include: { position: { select: { id: true, intakeAutoPromote: true } } },
  });

  if (!intake) throw new Error("Intake candidate not found");
  if (intake.finalStatus === "PROMOTED") throw new Error("Already promoted");

  // Create a Resume record in the active pipeline
  const resume = await prisma.resume.create({
    data: {
      organizationId: intake.organizationId,
      positionId: intake.positionId,
      originalFileName: intake.resumeFileName || `${intake.candidateEmail}_resume`,
      storagePath: intake.resumeFileUrl || "",
      mimeType: intake.resumeMimeType || "application/pdf",
      fileSize: intake.resumeFileSizeBytes || 0,
      candidateName: intake.candidateName,
      candidateEmail: intake.candidateEmail,
      phoneNumber: intake.phone,
      linkedinUrl: intake.linkedinUrl,
      location: intake.location,
      rawExtractedText: intake.resumeText,
      extractedText: intake.resumeText,
      parsingStatus: "UPLOADED",
      extractionStatus: "PENDING",
      // Source tracking — so Candidates tab shows where this candidate came from
      candidateSource: intake.source,
      intakeCandidateId: intake.id,
      // Copy AI scores as initial match data
      jdMatchScore: intake.tier2Score,
      jdMatchLabel: intake.tier2Label,
      matchedSkillsJson: (intake.tier2MatchedSkills as Prisma.InputJsonValue) ?? undefined,
      missingSkillsJson: (intake.tier2MissingSkills as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // Update intake candidate
  await prisma.intakeCandidate.update({
    where: { id: intakeCandidateId },
    data: {
      finalStatus: "PROMOTED",
      promotedToResumeId: resume.id,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId,
      action: "INTAKE_PROMOTED",
      resourceType: "IntakeCandidate",
      resourceId: intakeCandidateId,
      metadata: {
        resumeId: resume.id,
        candidateEmail: intake.candidateEmail,
        tier2Score: intake.tier2Score,
      },
    },
  });

  console.log(
    `[Intake] ✅ Promoted ${intake.candidateName || intake.candidateEmail} to pipeline (Resume: ${resume.id})`
  );

  revalidatePath(`/org-admin/positions/${intake.positionId}`);
  return { success: true, resumeId: resume.id };
}

/**
 * Bulk promotes the top N shortlisted candidates.
 */
export async function bulkPromoteTopNAction(
  positionId: string,
  count?: number
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const position = await prisma.position.findFirst({
    where: { id: positionId, organizationId: orgId },
    select: { intakeTopN: true },
  });

  const topN = count || position?.intakeTopN || 50;

  const shortlisted = await prisma.intakeCandidate.findMany({
    where: { positionId, finalStatus: "SHORTLISTED" },
    orderBy: { tier2Score: "desc" },
    take: topN,
    select: { id: true },
  });

  let promoted = 0;
  for (const candidate of shortlisted) {
    try {
      await promoteIntakeCandidateAction(candidate.id);
      promoted++;
    } catch (err) {
      console.error(`[Intake] Failed to promote ${candidate.id}:`, err);
    }
  }

  revalidatePath(`/org-admin/positions/${positionId}`);
  return { promoted, total: shortlisted.length };
}

/**
 * Archives an intake candidate with a reason.
 */
export async function archiveIntakeCandidateAction(
  intakeCandidateId: string,
  reason?: string
) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) throw new Error("Unauthorized");

  const intake = await prisma.intakeCandidate.update({
    where: { id: intakeCandidateId },
    data: {
      finalStatus: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId,
      action: "INTAKE_ARCHIVED",
      resourceType: "IntakeCandidate",
      resourceId: intakeCandidateId,
      metadata: { reason, candidateEmail: intake.candidateEmail },
    },
  });

  // Send polite rejection email — only to candidates who applied directly
  if (intake.consentSource === "direct_consent" && intake.candidateEmail) {
    const { emailService } = await import("@/lib/email");
    const position = await prisma.position.findUnique({
      where: { id: intake.positionId },
      select: { title: true },
    });
    emailService
      .sendGenericEmail({
        to: intake.candidateEmail,
        subject: `Update on your application — ${position?.title || "Open Position"}`,
        heading: "Application Update",
        body: `Hi ${intake.candidateName || "there"},\n\nThank you for your interest in the <strong>${position?.title || "position"}</strong> role.\n\nAfter careful review, we've decided to move forward with other candidates whose experience more closely aligns with this particular role.\n\nWe encourage you to join the <strong>IQMela Talent Network</strong> — our AI will automatically match you to future roles that fit your skills.`,
        ctaLabel: "Join the Talent Network",
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"}/careers`,
      })
      .catch((err: unknown) =>
        console.warn("[Intake] Rejection email failed (non-blocking):", err)
      );
  }

  revalidatePath(`/org-admin/positions/${intake.positionId}`);
  return { success: true };
}

/**
 * Gets distribution status for a position.
 */
export async function getDistributionStatusAction(positionId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  const distributions = await prisma.jobDistribution.findMany({
    where: { positionId },
    orderBy: { boardName: "asc" },
  });

  const position = await prisma.position.findFirst({
    where: { id: positionId, organizationId: orgId },
    select: { isPublished: true, intakeTopN: true, intakeAutoPromote: true },
  });

  return {
    isPublished: position?.isPublished || false,
    intakeTopN: position?.intakeTopN || 50,
    intakeAutoPromote: position?.intakeAutoPromote || false,
    channels: distributions.map((d) => ({
      id: d.id,
      boardName: d.boardName,
      status: d.status,
      publishedAt: d.publishedAt,
      viewCount: d.viewCount,
      clickCount: d.clickCount,
      applicationCount: d.applicationCount,
    })),
  };
}

/**
 * Updates intake configuration for a position.
 */
export async function updateIntakeConfigAction(
  positionId: string,
  config: { intakeTopN?: number; intakeAutoPromote?: boolean }
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("Unauthorized");

  await prisma.position.update({
    where: { id: positionId },
    data: {
      ...(config.intakeTopN !== undefined ? { intakeTopN: config.intakeTopN } : {}),
      ...(config.intakeAutoPromote !== undefined
        ? { intakeAutoPromote: config.intakeAutoPromote }
        : {}),
    },
  });

  revalidatePath(`/org-admin/positions/${positionId}`);
  return { success: true };
}
