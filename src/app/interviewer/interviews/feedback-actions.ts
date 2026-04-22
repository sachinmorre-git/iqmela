"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCallerPermissions } from "@/lib/rbac";

export async function submitInterviewFeedbackAction(formData: FormData) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || (!perms.canConductInterview && !perms.canSubmitFeedback)) {
      throw new Error("Unauthorized: You do not have permission to submit interview feedback.");
    }

    const interviewId = formData.get("interviewId") as string;
    const ratingStr = formData.get("rating") as string;
    const recommendation = formData.get("recommendation") as string;
    const notes = formData.get("notes") as string;
    const summary = formData.get("summary") as string;

    if (!interviewId || !ratingStr || !recommendation || !summary) {
      throw new Error("Missing required feedback fields.");
    }

    const rating = parseInt(ratingStr, 10);
    if (isNaN(rating) || rating < 0 || rating > 100) {
       throw new Error("Rating must be a valid number between 0 and 100.");
    }

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId }
    });

    if (!interview) {
      throw new Error("Interview not found.");
    }

    // RBAC: They must either be the designated interviewer OR an Org Admin / Dept Admin
    if (interview.interviewerId !== perms.userId && !perms.canManagePositions) {
      throw new Error("Forbidden: You are not assigned to review this interview.");
    }

    // Wrap the operations in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark interview as completed
      if (interview.status !== "COMPLETED") {
        await tx.interview.update({
          where: { id: interviewId },
          data: { status: "COMPLETED" }
        });
      }

      // 2. Upsert the feedback record
      await tx.interviewFeedback.upsert({
        where: { interviewId },
        update: {
          rating,
          recommendation,
          notes: notes || null,
          summary
        },
        create: {
          interviewId,
          interviewerId: perms.userId,
          rating,
          recommendation,
          notes: notes || null,
          summary
        }
      });
    });

    revalidatePath("/interviewer/interviews");
    
    if (interview.positionId) {
      revalidatePath(`/org-admin/positions/${interview.positionId}`);
      revalidatePath("/org-admin/reviews");
    }

    return { success: true };
  } catch (err: any) {
    console.error("[submitInterviewFeedbackAction] Error:", err);
    return { success: false, error: err.message || "Failed to submit feedback." };
  }
}
