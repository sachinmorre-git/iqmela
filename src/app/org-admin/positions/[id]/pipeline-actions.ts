"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCallerPermissions } from "@/lib/rbac";
import { InterviewRoundType, InterviewMode } from "@prisma/client";

// ── Default interview plan template ─────────────────────────────────────────

const DEFAULT_STAGES: {
  stageIndex: number;
  roundLabel: string;
  roundType: InterviewRoundType;
  durationMinutes: number;
  interviewMode: InterviewMode;
  description?: string;
}[] = [
  { stageIndex: 0, roundLabel: "AI Screen",       roundType: "AI_SCREEN",      durationMinutes: 30, interviewMode: "AI_AVATAR", description: "Automated AI-led screening interview" },
  { stageIndex: 1, roundLabel: "Technical",        roundType: "TECHNICAL",      durationMinutes: 45, interviewMode: "HUMAN",     description: "Technical skills assessment" },
  { stageIndex: 2, roundLabel: "System Design",    roundType: "SYSTEM_DESIGN",  durationMinutes: 60, interviewMode: "HUMAN",     description: "Architecture and system design discussion" },
  { stageIndex: 3, roundLabel: "Culture Fit",      roundType: "CULTURE_FIT",    durationMinutes: 30, interviewMode: "HUMAN",     description: "Team and culture alignment" },
];

// ── Ensure a plan exists (creates default if missing) ───────────────────────

export async function ensureInterviewPlanAction(positionId: string): Promise<{
  success: boolean;
  planId?: string;
  error?: string;
}> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found" };
    }

    // Return existing plan if present
    const existing = await prisma.interviewPlan.findUnique({ where: { positionId } });
    if (existing) return { success: true, planId: existing.id };

    // Create default plan
    const plan = await prisma.interviewPlan.create({
      data: {
        positionId,
        stages: {
          create: DEFAULT_STAGES.map((s) => ({
            stageIndex: s.stageIndex,
            roundLabel: s.roundLabel,
            roundType: s.roundType,
            durationMinutes: s.durationMinutes,
            interviewMode: s.interviewMode,
            description: s.description,
          })),
        },
      },
    });

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true, planId: plan.id };
  } catch (err) {
    console.error("[ensureInterviewPlanAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create plan" };
  }
}

// ── Update interview plan stages ────────────────────────────────────────────

export interface StageInput {
  id?: string; // existing stage ID (for updates), omit for new
  stageIndex: number;
  roundLabel: string;
  roundType: InterviewRoundType;
  durationMinutes: number;
  interviewMode: InterviewMode;
  isRequired?: boolean;
  description?: string;
}

export async function updateInterviewPlanAction(
  positionId: string,
  stages: StageInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found" };
    }

    // Ensure plan exists
    let plan = await prisma.interviewPlan.findUnique({ where: { positionId } });
    if (!plan) {
      plan = await prisma.interviewPlan.create({ data: { positionId } });
    }

    // Delete existing stages and recreate with new order
    // This is simpler and safer than trying to reconcile individual stage updates
    await prisma.interviewStage.deleteMany({ where: { interviewPlanId: plan.id } });

    await prisma.interviewStage.createMany({
      data: stages.map((s, i) => ({
        interviewPlanId: plan.id,
        stageIndex: i, // Re-index based on array order
        roundLabel: s.roundLabel,
        roundType: s.roundType,
        durationMinutes: s.durationMinutes,
        interviewMode: s.interviewMode,
        isRequired: s.isRequired ?? true,
        description: s.description || null,
      })),
    });

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateInterviewPlanAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update plan" };
  }
}

// ── Schedule a specific round for a candidate ───────────────────────────────

export async function scheduleRoundAction(input: {
  positionId: string;
  resumeId: string;
  stageIndex: number;
  interviewerIds: string[];
  scheduledAt: string; // ISO date string
  durationMinutes?: number;
  externalLink?: string;
  notes?: string;
}): Promise<{ success: boolean; interviewId?: string; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManageInvites) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: input.positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found" };
    }

    const resume = await prisma.resume.findUnique({ where: { id: input.resumeId } });
    if (!resume) return { success: false, error: "Resume not found" };

    // Get the stage from the plan
    const plan = await prisma.interviewPlan.findUnique({
      where: { positionId: input.positionId },
      include: { stages: { orderBy: { stageIndex: "asc" } } },
    });
    const stage = plan?.stages.find((s) => s.stageIndex === input.stageIndex);
    if (!stage) return { success: false, error: "Stage not found in interview plan" };

    // If a round already exists for this stage, cancel it (supports rescheduling)
    const existing = await prisma.interview.findFirst({
      where: {
        resumeId: input.resumeId,
        positionId: input.positionId,
        stageIndex: input.stageIndex,
        status: { not: "CANCELED" },
      },
    });
    if (existing) {
      await prisma.interview.update({
        where: { id: existing.id },
        data: { status: "CANCELED" },
      });
    }

    // No round gating — recruiters can schedule any round in any order

    // Resolve candidate user (may not exist yet — OK for scheduling)
    const candidateEmail = resume.overrideEmail || resume.candidateEmail;
    const candidateUser = candidateEmail
      ? await prisma.user.findUnique({ where: { email: candidateEmail } })
      : null;

    if (!candidateUser) {
      return { success: false, error: `No account found for ${candidateEmail || "unknown"}. Candidate must sign up first.` };
    }

    // Verify interviewers belong to org
    const interviewers = input.interviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: input.interviewerIds }, organizationId: perms.orgId },
        })
      : [];

    const candidateName = resume.overrideName || resume.candidateName || "Candidate";
    const roundTitle = `${stage.roundLabel} — ${candidateName}`;

    const interview = await prisma.interview.create({
      data: {
        title: roundTitle,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes || stage.durationMinutes,
        status: "SCHEDULED",
        interviewMode: stage.interviewMode,
        roomName: input.externalLink || null,
        notes: input.notes || null,
        candidateId: candidateUser.id,
        interviewerId: interviewers[0]?.id || null,
        positionId: input.positionId,
        organizationId: perms.orgId,
        scheduledById: perms.userId,
        resumeId: input.resumeId,
        stageIndex: input.stageIndex,
        roundType: stage.roundType,
        roundLabel: stage.roundLabel,
        panelists: interviewers.length > 0
          ? { create: interviewers.map((u) => ({ interviewerId: u.id })) }
          : undefined,
      },
    });

    // TODO: Send email notifications (candidate + interviewers) — reuse existing email templates

    revalidatePath(`/org-admin/positions/${input.positionId}`);
    return { success: true, interviewId: interview.id };
  } catch (err) {
    console.error("[scheduleRoundAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to schedule" };
  }
}

// ── Complete a round ────────────────────────────────────────────────────────

export async function completeRoundAction(
  interviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview || interview.organizationId !== perms.orgId) {
      return { success: false, error: "Interview not found" };
    }

    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: "COMPLETED" },
    });

    if (interview.positionId) {
      revalidatePath(`/org-admin/positions/${interview.positionId}`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

// ── Skip a round ────────────────────────────────────────────────────────────

export async function skipRoundAction(input: {
  positionId: string;
  resumeId: string;
  stageIndex: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: input.positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found" };
    }

    // Create a "skipped" interview record
    const candidateEmail = (await prisma.resume.findUnique({ where: { id: input.resumeId } }))?.candidateEmail;
    const candidateUser = candidateEmail
      ? await prisma.user.findUnique({ where: { email: candidateEmail } })
      : null;

    if (!candidateUser) {
      return { success: false, error: "Candidate must have an account to track skipped rounds" };
    }

    await prisma.interview.create({
      data: {
        title: `Round ${input.stageIndex} — Skipped`,
        scheduledAt: new Date(),
        status: "CANCELED",
        candidateId: candidateUser.id,
        positionId: input.positionId,
        organizationId: perms.orgId,
        resumeId: input.resumeId,
        stageIndex: input.stageIndex,
        roundLabel: "Skipped",
      },
    });

    revalidatePath(`/org-admin/positions/${input.positionId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
