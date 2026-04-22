"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

/**
 * Exclusively for Local Development.
 * Bypasses missing Ngrok Webhook pipelines by forcing a direct pull from Clerk APIs.
 */
export async function forceSyncClerkLocalDb() {
  const perms = await getCallerPermissions();
  if (!perms || !perms.orgId) throw new Error("Unauthorized");

  const client = await clerkClient();
  const orgMemberships = await client.organizations.getOrganizationMembershipList({
    organizationId: perms.orgId,
    limit: 100,
  });

  const users = orgMemberships.data.map(m => m.publicUserData);

  let syncedCount = 0;

  for (const clerkUser of users) {
    if (!clerkUser || !clerkUser.userId || !clerkUser.identifier) continue;

    // Build Name
    const firstName = clerkUser.firstName || "";
    const lastName = clerkUser.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || clerkUser.identifier.split("@")[0];

    // Force synchronize the User model
    await prisma.user.upsert({
      where: { id: clerkUser.userId },
      update: {
        organizationId: perms.orgId, // Ensure they are mapped to the active testing org
        email: clerkUser.identifier,
        name: fullName,
      },
      create: {
        id: clerkUser.userId,
        email: clerkUser.identifier,
        name: fullName,
        organizationId: perms.orgId,
        roles: ["B2B_INTERVIEWER"], // Give them a default local mapped role so they appear safely
      }
    });

    syncedCount++;
  }

  revalidatePath("/org-admin/team");
  
  return { success: true, count: syncedCount };
}
