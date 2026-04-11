"use server"

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function saveInterviewNotes(interviewId: string, notes: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  // Verify strictly that the user is the explicit interviewer for this room
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview || interview.interviewerId !== userId) {
    throw new Error("Forbidden: Only the assigned interviewer can edit private notes.");
  }

  await prisma.interview.update({
    where: { id: interviewId },
    data: { notes }
  });
}
