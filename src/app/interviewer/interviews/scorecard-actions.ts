"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export type PanelistScorecardInput = {
  interviewId: string;
  resumeId?: string;
  positionId?: string;
  stageIndex?: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  cultureFitScore: number;
  recommendation: string;
  summary: string;
  strengths?: string;
  concerns?: string;
  privateNotes?: string;
};

export async function submitPanelistScorecardAction(input: PanelistScorecardInput) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };

  // Compute composite overall score (weighted average ×10 to get 0-100)
  const overallScore = Math.round(
    (input.technicalScore * 0.35 +
      input.communicationScore * 0.2 +
      input.problemSolvingScore * 0.3 +
      input.cultureFitScore * 0.15) *
      10
  );

  try {
    const feedback = await prisma.panelistFeedback.upsert({
      where: {
        interviewId_interviewerId: {
          interviewId: input.interviewId,
          interviewerId: perms.userId,
        },
      },
      update: {
        technicalScore: input.technicalScore,
        communicationScore: input.communicationScore,
        problemSolvingScore: input.problemSolvingScore,
        cultureFitScore: input.cultureFitScore,
        overallScore,
        recommendation: input.recommendation,
        summary: input.summary,
        strengths: input.strengths || null,
        concerns: input.concerns || null,
        privateNotes: input.privateNotes || null,
      },
      create: {
        interviewId: input.interviewId,
        interviewerId: perms.userId,
        resumeId: input.resumeId || null,
        positionId: input.positionId || null,
        stageIndex: input.stageIndex ?? null,
        technicalScore: input.technicalScore,
        communicationScore: input.communicationScore,
        problemSolvingScore: input.problemSolvingScore,
        cultureFitScore: input.cultureFitScore,
        overallScore,
        recommendation: input.recommendation,
        summary: input.summary,
        strengths: input.strengths || null,
        concerns: input.concerns || null,
        privateNotes: input.privateNotes || null,
      },
    });

    if (input.resumeId) {
      revalidatePath(`/org-admin/candidates/${input.resumeId}/intelligence`);
    }
    if (input.positionId) {
      revalidatePath(`/org-admin/positions/${input.positionId}`);
    }

    return { success: true, feedback };
  } catch (err: any) {
    console.error("[PanelistScorecard] Submit failed:", err);
    return { success: false, error: err.message };
  }
}
