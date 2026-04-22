"use server"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateOrgInput {
  orgName: string
}

interface CreateOrgResult {
  success: boolean
  orgId?: string
  orgName?: string
  error?: string
}

// ── Main Service ─────────────────────────────────────────────────────────────

/**
 * Creates a self-serve org for the currently authenticated user.
 *
 * Atomic flow:
 * 1. Validate inputs
 * 2. Check rate limit (max 2 admin orgs per user)
 * 3. Check duplicate org name
 * 4. Create Clerk org
 * 5. Create Prisma Organization (planTier: FREE)
 * 6. Add user as org:admin in Clerk
 * 7. Upsert Prisma User (APPEND ORG_ADMIN role)
 * 8. Set Clerk metadata + HTTP cookie
 *
 * If step 5+ fails after Clerk org is created → rollback by deleting Clerk org.
 */
export async function createSelfServeOrg({ orgName }: CreateOrgInput): Promise<CreateOrgResult> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Not authenticated. Please sign in first." }

  const client = await clerkClient()

  // ── 1. Validate org name ───────────────────────────────────────────────
  const trimmed = orgName.trim()
  if (trimmed.length < 2) return { success: false, error: "Organization name must be at least 2 characters." }
  if (trimmed.length > 50) return { success: false, error: "Organization name must be 50 characters or fewer." }

  // ── 2. Rate limit: max 2 orgs where user is admin ─────────────────────
  const membershipList = await client.users.getOrganizationMembershipList({ userId })
  const memberships = membershipList.data || []
  const adminOrgs = memberships.filter(m => m.role === "org:admin")

  if (adminOrgs.length >= 2) {
    return {
      success: false,
      error: "You can manage up to 2 organizations. Please contact support if you need more.",
    }
  }

  // ── 3. Duplicate org name check ────────────────────────────────────────
  const existingOrgsResult = await client.organizations.getOrganizationList({ query: trimmed })
  const existingOrgs = ("data" in existingOrgsResult ? existingOrgsResult.data : existingOrgsResult) as any[]
  const isDuplicate = existingOrgs.some(
    (org) => org.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (isDuplicate) {
    return { success: false, error: `An organization named "${trimmed}" already exists. Try a different name.` }
  }

  // ── 4. Create Clerk organization ───────────────────────────────────────
  let clerkOrg: any
  try {
    clerkOrg = await client.organizations.createOrganization({
      name: trimmed,
      createdBy: userId,
    })
    console.log(`[create-org] Clerk org created: ${clerkOrg.id} — "${trimmed}"`)
  } catch (err: any) {
    console.error("[create-org] Clerk org creation failed:", err)
    return { success: false, error: err.errors?.[0]?.longMessage || "Failed to create organization. Please try again." }
  }

  // ── 5–8: Prisma + membership + metadata (with rollback on failure) ────
  try {
    // 5. Create Prisma Organization record
    const clerkUser = await client.users.getUser(userId)
    const userEmail = clerkUser.emailAddresses?.[0]?.emailAddress || ""
    const domain = userEmail.includes("@") ? userEmail.split("@")[1] : null

    await prisma.organization.create({
      data: {
        id: clerkOrg.id,
        name: trimmed,
        domain,
        planTier: "FREE",
      },
    })
    console.log(`[create-org] Prisma Organization created — tier: FREE, domain: ${domain}`)

    // 6. Add user as org:admin
    await client.organizations.createOrganizationMembership({
      organizationId: clerkOrg.id,
      userId,
      role: "org:admin",
    })
    console.log(`[create-org] Clerk membership added — userId: ${userId}, role: org:admin`)

    // 7. Upsert Prisma User — APPEND ORG_ADMIN (don't overwrite existing roles)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    })

    const existingRoles = (existingUser?.roles as string[]) || []
    const newRoles = existingRoles.includes("ORG_ADMIN")
      ? existingRoles
      : [...existingRoles, "ORG_ADMIN"]

    const userName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        organizationId: clerkOrg.id,
        roles: { set: newRoles as any },
      },
      create: {
        id: userId,
        email: userEmail,
        name: userName || undefined,
        organizationId: clerkOrg.id,
        roles: ["ORG_ADMIN"],
      },
    })
    console.log(`[create-org] Prisma User upserted — roles: ${newRoles.join(", ")}`)

    // OrgAdminProfile
    await prisma.orgAdminProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })

    // 8. Set Clerk metadata + cookie
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: "admin" as const },
    })

    const cookieStore = await cookies()
    cookieStore.set("user_role", "org-admin", { path: "/" })
    console.log(`[create-org] Metadata + cookie set ✅`)

    return {
      success: true,
      orgId: clerkOrg.id,
      orgName: trimmed,
    }
  } catch (err: any) {
    // ── ROLLBACK: Delete the Clerk org since Prisma/membership setup failed ──
    console.error("[create-org] Post-Clerk setup failed, rolling back Clerk org:", err)
    try {
      await client.organizations.deleteOrganization(clerkOrg.id)
      console.log(`[create-org] Rollback: Clerk org ${clerkOrg.id} deleted`)
    } catch (rollbackErr) {
      console.error("[create-org] CRITICAL: Rollback failed — orphaned Clerk org:", clerkOrg.id, rollbackErr)
    }

    return {
      success: false,
      error: err.message || "Failed to set up your workspace. Please try again.",
    }
  }
}
