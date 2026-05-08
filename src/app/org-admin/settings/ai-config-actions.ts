"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateModelRouterCache } from "@/lib/ai/model-router";
import type { ModelChain } from "@/lib/ai/models";

async function requireOrgAdmin() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) throw new Error("Not authenticated or no org");
  if (orgRole !== "org:admin") throw new Error("Unauthorized — org admin required");
  return { userId, orgId };
}

/**
 * Get the org-level AI config. Returns null if no overrides exist.
 */
export async function getOrgAiConfig() {
  const { orgId } = await requireOrgAdmin();
  return prisma.orgAiConfig.findUnique({ where: { organizationId: orgId } });
}

/**
 * Update a single task's model chain for the current org.
 */
export async function updateOrgTaskModelChain(taskKey: string, chain: ModelChain) {
  const { userId, orgId } = await requireOrgAdmin();

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
  revalidatePath("/org-admin/settings");
}

/**
 * Reset the org's AI config back to platform defaults (delete all overrides).
 */
export async function resetOrgAiConfig() {
  const { orgId } = await requireOrgAdmin();

  await prisma.orgAiConfig.deleteMany({ where: { organizationId: orgId } });

  invalidateModelRouterCache(orgId);
  revalidatePath("/org-admin/settings");
}
