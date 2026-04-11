"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function submitInterviewFeedback(interviewId: string, data: { rating: number, recommendation: string, summary: string, notes: string }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  // Verify strictly that the user is the explicit interviewer for this room
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview || interview.interviewerId !== userId) {
    throw new Error("Forbidden: Only the assigned interviewer can submit feedback.");
  }

  // Create the Feedback and automatically transition the Interview status to COMPLETED
  await prisma.$transaction([
    prisma.interviewFeedback.create({
      data: {
        interviewId,
        interviewerId: userId,
        rating: data.rating,
        recommendation: data.recommendation,
        summary: data.summary,
        notes: data.notes
      }
    }),
    prisma.interview.update({
      where: { id: interviewId },
      data: { status: "COMPLETED" }
    })
  ]);
}
