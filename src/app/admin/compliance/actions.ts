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

export async function getComplianceRules() {
  await requireSysAdmin();
  return prisma.complianceRule.findMany({
    orderBy: [{ country: "asc" }, { state: "asc" }, { city: "asc" }],
  });
}

export async function createComplianceRule(data: {
  country: string;
  state?: string;
  city?: string;
  ruleType: string;
  ruleKey: string;
  ruleValue: any;
  description: string;
  isAutoApplied: boolean;
}) {
  await requireSysAdmin();
  return prisma.complianceRule.create({
    data: {
      country: data.country,
      state: data.state || null,
      city: data.city || null,
      ruleType: data.ruleType,
      ruleKey: data.ruleKey,
      ruleValue: data.ruleValue,
      description: data.description,
      isAutoApplied: data.isAutoApplied,
    },
  });
}

export async function updateComplianceRule(
  id: string,
  data: Partial<{
    isActive: boolean;
    description: string;
    ruleValue: any;
    isAutoApplied: boolean;
  }>
) {
  await requireSysAdmin();
  await prisma.complianceRule.update({
    where: { id },
    data,
  });
  revalidatePath("/admin/compliance");
}

export async function deleteComplianceRule(id: string) {
  await requireSysAdmin();
  await prisma.complianceRule.delete({ where: { id } });
  revalidatePath("/admin/compliance");
}

// ── Global Config Update ──────────────────────────────────────────────────

export async function updateBgvRoutingConfig(countryCode: string, vendor: string) {
  const { userId } = await requireSysAdmin();
  const config = await prisma.platformConfig.findUnique({ where: { id: "GLOBAL" } });
  
  const currentRouting = (config?.bgvVendorRouting as Record<string, string>) || {};
  
  const updatedRouting = {
    ...currentRouting,
    [countryCode]: vendor
  };

  await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL", bgvVendorRouting: updatedRouting, updatedBy: userId },
    update: { bgvVendorRouting: updatedRouting, updatedBy: userId },
  });
  
  revalidatePath("/admin/compliance");
}

// ── Manual Cost Entry ────────────────────────────────────────────────────────

export async function createManualCostEntry(data: {
  organizationId?: string;
  category: string;
  amount: number;
  description: string;
  periodStart: string;
  periodEnd: string;
}) {
  const { userId } = await requireSysAdmin();
  return prisma.manualCostEntry.create({
    data: {
      organizationId: data.organizationId || null,
      category: data.category,
      amount: data.amount,
      description: data.description,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      enteredBy: userId,
    },
  });
}

export async function getManualCostEntries(filters?: {
  organizationId?: string;
  category?: string;
}) {
  await requireSysAdmin();
  return prisma.manualCostEntry.findMany({
    where: {
      ...(filters?.organizationId ? { organizationId: filters.organizationId } : {}),
      ...(filters?.category ? { category: filters.category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
