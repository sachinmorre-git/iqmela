"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) throw new Error("Unauthorized");
  return { userId, sysRole };
}

// ── Platform Config ──────────────────────────────────────────────────────────

export async function getPlatformConfig() {
  await requireSysAdmin();
  // Upsert ensures the GLOBAL row always exists
  return prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL" },
    update: {},
  });
}

export async function updatePlatformConfig(
  data: Partial<{
    aiPipelineEnabled: boolean;
    aiInterviewsEnabled: boolean;
    vendorDispatchEnabled: boolean;
    bgvEnabled: boolean;
    offersEnabled: boolean;
    jobDistributionEnabled: boolean;
  }>
) {
  const { userId } = await requireSysAdmin();
  await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL", ...data, updatedBy: userId },
    update: { ...data, updatedBy: userId },
  });
  revalidatePath("/admin/config");
}

// ── Org Feature Overrides ────────────────────────────────────────────────────

export async function getOrgOverrides(organizationId: string) {
  await requireSysAdmin();
  return prisma.orgFeatureOverride.findMany({
    where: { organizationId },
    orderBy: { featureKey: "asc" },
  });
}

export async function setOrgFeatureOverride(
  organizationId: string,
  featureKey: string,
  enabled: boolean,
  note?: string
) {
  const { userId } = await requireSysAdmin();
  await prisma.orgFeatureOverride.upsert({
    where: { organizationId_featureKey: { organizationId, featureKey } },
    create: { organizationId, featureKey, enabled, overriddenBy: userId, note },
    update: { enabled, overriddenBy: userId, note },
  });
  revalidatePath("/admin/config");
}

export async function resetOrgFeatureOverride(
  organizationId: string,
  featureKey: string
) {
  await requireSysAdmin();
  await prisma.orgFeatureOverride.deleteMany({
    where: { organizationId, featureKey },
  });
  revalidatePath("/admin/config");
}

// ── Org Search ───────────────────────────────────────────────────────────────

export async function searchOrganizations(query: string) {
  await requireSysAdmin();
  // Search Prisma orgs (we have org name in Clerk but not Prisma directly)
  // For simplicity, return all org IDs and let client-side filter
  const orgs = await prisma.organization.findMany({
    select: { id: true, planTier: true, domain: true },
    take: 50,
  });
  return orgs;
}
