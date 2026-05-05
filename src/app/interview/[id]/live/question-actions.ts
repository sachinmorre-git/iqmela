"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/** Fetch questions for the coderpad picker — available to any org member */
export async function fetchQuestionsForCoderpad(search?: string) {
  const { orgId } = await auth();
  if (!orgId) return [];

  const where: any = { organizationId: orgId };
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { tags: { has: search.trim().toLowerCase() } },
    ];
  }

  return prisma.interviewQuestion.findMany({
    where,
    orderBy: { usageCount: "desc" },
    take: 50,
    select: {
      id: true, type: true, title: true, description: true,
      difficulty: true, category: true, tags: true, language: true,
      starterCode: true, sampleInput: true, expectedOutput: true,
      options: true, explanation: true, attachmentUrl: true,
      attachmentName: true, usageCount: true,
    },
  });
}

/** Increment usage count when a question is loaded into coderpad */
export async function trackQuestionUsage(questionId: string) {
  try {
    await prisma.interviewQuestion.update({
      where: { id: questionId },
      data: { usageCount: { increment: 1 } },
    });
  } catch { /* non-critical */ }
}
