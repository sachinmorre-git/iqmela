"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateModelRouterCache } from "@/lib/ai/model-router";
import type { ModelChain } from "@/lib/ai/models";

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

/**
 * Update the model chain for a specific task type (global defaults).
 */
export async function updateTaskModelChain(
  taskKey: string,
  chain: ModelChain
) {
  const { userId } = await requireSysAdmin();

  const FIELD_MAP: Record<string, string> = {
    extraction:       "extractionModels",
    ranking:          "rankingModels",
    judgment:         "judgmentModels",
    jdAnalysis:       "jdAnalysisModels",
    interviewScore:   "interviewScoreModels",
    codingGen:        "codingGenModels",
    interviewPrep:    "interviewPrepModels",
    redFlags:         "redFlagModels",
    candidateSummary: "candidateSummaryModels",
  };

  const field = FIELD_MAP[taskKey];
  if (!field) throw new Error(`Unknown task key: ${taskKey}`);

  await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL", [field]: chain, updatedBy: userId },
    update: { [field]: chain, updatedBy: userId },
  });

  invalidateModelRouterCache();
  revalidatePath("/admin/ai-config");
}

// ── Per-Organization Override Actions (Admin-only) ───────────────────────────

/**
 * List all organizations for the org selector dropdown.
 */
export async function listOrganizations() {
  await requireSysAdmin();
  return prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Get a specific org's AI config overrides.
 */
export async function getOrgAiConfig(orgId: string) {
  await requireSysAdmin();
  return prisma.orgAiConfig.findUnique({ where: { organizationId: orgId } });
}

/**
 * Update a single task's model chain for a specific org (admin-controlled).
 */
export async function updateOrgTaskModelChain(orgId: string, taskKey: string, chain: ModelChain) {
  const { userId } = await requireSysAdmin();

  const FIELD_MAP: Record<string, string> = {
    extraction:       "extractionModels",
    ranking:          "rankingModels",
    judgment:         "judgmentModels",
    jdAnalysis:       "jdAnalysisModels",
    interviewScore:   "interviewScoreModels",
    codingGen:        "codingGenModels",
    interviewPrep:    "interviewPrepModels",
    redFlags:         "redFlagModels",
    candidateSummary: "candidateSummaryModels",
  };

  const field = FIELD_MAP[taskKey];
  if (!field) throw new Error(`Unknown task key: ${taskKey}`);

  await prisma.orgAiConfig.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      [field]: chain,
      updatedBy: userId,
    },
    update: {
      [field]: chain,
      updatedBy: userId,
    },
  });

  invalidateModelRouterCache(orgId);
  revalidatePath("/admin/ai-config");
}

/**
 * Reset an org's AI config back to platform defaults.
 */
export async function resetOrgAiConfig(orgId: string) {
  await requireSysAdmin();
  await prisma.orgAiConfig.deleteMany({ where: { organizationId: orgId } });
  invalidateModelRouterCache(orgId);
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
