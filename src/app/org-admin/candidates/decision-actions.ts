"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { CandidatePipelineStatus, HiringDecisionAction } from "@prisma/client";
import { dispatchNotification } from "@/lib/notify";

// ── RBAC: who can do what ─────────────────────────────────────────────────────
const ACTION_ROLE_MAP: Record<HiringDecisionAction, string[]> = {
  ADVANCE:    ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"],
  REJECT:     ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"],
  HOLD:       ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"],
  OFFER:      ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"],
  HIRE:       ["ORG_ADMIN", "DEPT_ADMIN"],
  WITHDRAW:   ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"],
  REACTIVATE: ["ORG_ADMIN"],
};

// ── Action → new pipeline status ──────────────────────────────────────────────
function getNewStatus(action: HiringDecisionAction): CandidatePipelineStatus {
  switch (action) {
    case "ADVANCE":    return CandidatePipelineStatus.ACTIVE;
    case "REJECT":     return CandidatePipelineStatus.REJECTED;
    case "HOLD":       return CandidatePipelineStatus.ON_HOLD;
    case "OFFER":      return CandidatePipelineStatus.OFFER_PENDING;
    case "HIRE":       return CandidatePipelineStatus.HIRED;
    case "WITHDRAW":   return CandidatePipelineStatus.WITHDRAWN;
    case "REACTIVATE": return CandidatePipelineStatus.ACTIVE;
  }
}

export type MakeDecisionInput = {
  resumeId: string;
  positionId: string;
  action: HiringDecisionAction;
  note?: string;
  totalStages?: number; // used for ADVANCE to know max stage
};

export async function makeHiringDecisionAction(input: MakeDecisionInput) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized — please sign in." };

  // RBAC check
  const allowedRoles = ACTION_ROLE_MAP[input.action];
  const hasRole = perms.roles?.some((r: string) => allowedRoles.includes(r));
  if (!hasRole) {
    return { success: false, error: `You don't have permission to ${input.action.toLowerCase()} candidates.` };
  }

  // Fetch current resume state
  const resume = await prisma.resume.findUnique({
    where: { id: input.resumeId },
    select: { pipelineStatus: true, pipelineStageIdx: true, positionId: true },
  });

  if (!resume) return { success: false, error: "Resume not found." };
  if (resume.positionId !== input.positionId) return { success: false, error: "Position mismatch." };

  const fromStage = resume.pipelineStageIdx;
  const newStatus = getNewStatus(input.action);

  // Calculate toStage for ADVANCE
  let toStage: number | null = fromStage;
  if (input.action === "ADVANCE") {
    const maxStage = (input.totalStages ?? 3) - 1;
    toStage = Math.min(fromStage + 1, maxStage);
  } else if (input.action === "REACTIVATE") {
    toStage = fromStage; // stays same stage
  } else {
    toStage = null; // terminal
  }

  try {
    // Atomic: update resume + create decision log
    const [updatedResume, decision] = await prisma.$transaction([
      prisma.resume.update({
        where: { id: input.resumeId },
        data: {
          pipelineStatus: newStatus,
          pipelineStageIdx: toStage ?? fromStage,
          lastDecisionAt: new Date(),
          lastDecisionById: perms.userId,
          lastDecisionNote: input.note || null,
        },
      }),
      prisma.hiringDecision.create({
        data: {
          resumeId: input.resumeId,
          positionId: input.positionId,
          decidedById: perms.userId,
          action: input.action,
          fromStage,
          toStage,
          note: input.note || null,
        },
      }),
    ]);

    // Revalidate relevant pages
    revalidatePath(`/org-admin/positions/${input.positionId}`);
    revalidatePath(`/org-admin/candidates/${input.resumeId}/intelligence`);

    // ── Audit log — EEOC/compliance trail ──────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: `HIRING_DECISION_${input.action}`,
        resourceType: "Resume",
        resourceId: input.resumeId,
        metadata: {
          positionId: input.positionId,
          action: input.action,
          fromStage,
          toStage,
          newStatus: newStatus,
          note: input.note || null,
          aiRecommendation: undefined, // Will be enriched below
        },
      },
    }).catch((err) =>
      console.error("[HiringDecision] Audit log write failed:", err)
    );

    // ── In-app notification — ONLY for high-signal terminal events ────
    // ADVANCE and OFFER are routine — the recruiter sees them immediately.
    // We only notify on HIRE (rare, celebratory) and REJECT (audit trail).
    const candidateInfo = await prisma.resume.findUnique({
      where: { id: input.resumeId },
      select: { candidateName: true, position: { select: { title: true } } },
    });
    const cName = candidateInfo?.candidateName || "Candidate";
    const pTitle = candidateInfo?.position?.title || "Position";

    if (input.action === "HIRE" || input.action === "REJECT") {
      const notif = input.action === "HIRE"
        ? { title: `${cName} Hired! 🎉`, body: `${cName} has been officially hired for ${pTitle}`, type: "OFFER_ACCEPTED" as const }
        : { title: `${cName} Rejected`, body: `${cName} has been rejected for ${pTitle}`, type: "CANDIDATE_REJECTED" as const };

      // Only notify ORG_ADMINs (not every hiring manager) — keeps the feed lean
      const orgAdmins = await prisma.user.findMany({
        where: {
          organizationId: perms.orgId,
          roles: { hasSome: ["ORG_ADMIN"] },
        },
        select: { id: true },
      });
      for (const u of orgAdmins) {
        if (u.id !== perms.userId) {
          dispatchNotification({
            organizationId: perms.orgId,
            userId: u.id,
            type: notif.type,
            title: notif.title,
            body: notif.body,
            link: `/org-admin/candidates/${input.resumeId}/intelligence`,
            sendPush: false, // Bell only — no browser interruption
          }).catch(() => {});
        }
      }
    }

    return { success: true, resume: updatedResume, decision };
  } catch (err: any) {
    console.error("[HiringDecision] Failed:", err);
    return { success: false, error: err.message };
  }
}
