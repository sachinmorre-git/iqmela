"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) throw new Error("Unauthorized");
  return { userId, sysRole };
}

export async function getAiConfig() {
  await requireSysAdmin();
  return prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL" },
    update: {},
  });
}

export async function updateAiProvider(
  data: Partial<{
    defaultAiProvider: string;
    extractionProvider: string;
    rankingProvider: string;
    judgmentProvider: string;
    interviewScoreProvider: string;
    jdAnalysisProvider: string;
    codingGenProvider: string;
  }>
) {
  const { userId } = await requireSysAdmin();
  await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL", ...data, updatedBy: userId },
    update: { ...data, updatedBy: userId },
  });
  revalidatePath("/admin/ai-config");
}

export async function updateInterviewMode(mode: string) {
  const { userId } = await requireSysAdmin();
  await prisma.platformConfig.update({
    where: { id: "GLOBAL" },
    data: { defaultInterviewMode: mode, updatedBy: userId },
  });
  revalidatePath("/admin/ai-config");
}

export async function updateExecutionBackend(
  backend: string,
  endpoint?: string
) {
  const { userId } = await requireSysAdmin();
  await prisma.platformConfig.update({
    where: { id: "GLOBAL" },
    data: {
      codeExecutionBackend: backend,
      pistonEndpoint: endpoint || null,
      updatedBy: userId,
    },
  });
  revalidatePath("/admin/ai-config");
}
