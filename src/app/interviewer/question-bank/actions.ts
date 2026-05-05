"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createInterviewQuestion(data: {
  type: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  tags: string[];
  
  // Coding
  language?: string;
  starterCode?: string;
  sampleInput?: string;
  expectedOutput?: string;
  
  // MCQ
  options?: any;
  explanation?: string;

  // File Based
  attachmentUrl?: string;
  attachmentName?: string;
}) {
  const perms = await getCallerPermissions();
  if (!perms || !perms.userId || !perms.orgId) {
    throw new Error("Unauthorized");
  }

  const question = await prisma.interviewQuestion.create({
    data: {
      organizationId: perms.orgId,
      createdById: perms.userId,
      isFromSeedBank: false,
      usageCount: 0,
      
      type: data.type,
      title: data.title,
      description: data.description,
      difficulty: data.difficulty,
      category: data.category,
      tags: data.tags,

      language: data.language,
      starterCode: data.starterCode,
      sampleInput: data.sampleInput,
      expectedOutput: data.expectedOutput,

      options: data.options ? JSON.parse(JSON.stringify(data.options)) : undefined,
      explanation: data.explanation,

      attachmentUrl: data.attachmentUrl,
      attachmentName: data.attachmentName,
    }
  });

  revalidatePath("/interviewer/question-bank");
  return { success: true, question };
}
