"use server"

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { OrgPlanTier } from "@prisma/client"
import { revalidatePath } from "next/cache"

/**
 * Ensure a Prisma Organization record exists for a Clerk org.
 * If it doesn't exist, create one with the given name and default PLUS tier.
 */
export async function ensureOrgRecord(orgId: string, orgName: string) {
  const { sessionClaims } = await auth()
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString()
  if (!sysRole?.startsWith("sys:")) throw new Error("Unauthorized")

  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: orgName,
      planTier: "PLUS",
    },
  })

  revalidatePath(`/admin/orgs/${orgId}`)
  revalidatePath("/admin/dashboard")
  return { success: true }
}

/**
 * Update an organization's plan tier.
 */
export async function updateOrgPlanTier(orgId: string, planTier: OrgPlanTier) {
  const { sessionClaims } = await auth()
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString()
  if (sysRole !== "sys:superadmin" && sysRole !== "sys:support") {
    throw new Error("Only Super Admin or Support can change plan tiers.")
  }

  // Ensure the record exists
  await prisma.organization.upsert({
    where: { id: orgId },
    update: { planTier },
    create: { id: orgId, name: orgId, planTier },
  })

  console.log(`[admin] Plan tier updated: ${orgId} → ${planTier}`)

  revalidatePath(`/admin/orgs/${orgId}`)
  revalidatePath("/admin/dashboard")
  return { success: true, planTier }
}

/**
 * Update an organization's default AI Generation Strategy.
 */
export async function updateOrgAiStrategy(orgId: string, strategy: any) {
  const { sessionClaims } = await auth()
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString()
  if (!sysRole?.startsWith("sys:")) throw new Error("Unauthorized")

  await prisma.organization.update({
    where: { id: orgId },
    data: { defaultAiGenerationStrategy: strategy },
  })

  revalidatePath(`/admin/orgs/${orgId}`)
  return { success: true }
}
