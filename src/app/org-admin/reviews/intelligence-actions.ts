"use server";

import { gradeInterviewTranscriptOffensive } from "@/lib/ai/interview-grader";
import { revalidatePath } from "next/cache";

export async function processIntelligenceReport(interviewId: string) {
  try {
     const result = await gradeInterviewTranscriptOffensive(interviewId);
     if (!result.success) throw new Error(result.error);

     revalidatePath("/org-admin/reviews");
     return { success: true };
  } catch (error: any) {
     return { success: false, error: error.message };
  }
}
