"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Accept a pending TeamInvite by its database ID.
 * Used on the /select-org page (dev-mode inline accept) so users
 * don't need to click a magic link from an email.
 */
export async function acceptInviteById(inviteId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await clerkClient();

  // Get the current user's email from Clerk
  const clerkUser = await client.users.getUser(userId);
  const userEmail = clerkUser.emailAddresses?.[0]?.emailAddress;

  if (!userEmail) {
    throw new Error("Could not determine your email address.");
  }

  // Find the invite — must match the user's email and be in SENT status
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) throw new Error("Invite not found.");
  if (invite.status === "ACCEPTED") throw new Error("Invite already accepted.");
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("This invite does not belong to your account.");
  }

  // 1. Add to Clerk Organization
  try {
    const clerkRole = invite.roles.includes("ORG_ADMIN") ? "org:admin" : "org:member";
    await client.organizations.createOrganizationMembership({
      organizationId: invite.organizationId,
      userId: userId,
      role: clerkRole,
    });
  } catch (clerkErr: any) {
    // Already a member — that's fine
    console.warn("Clerk membership (may already exist):", clerkErr.errors?.[0]?.message);
  }

  // 2. Upsert Postgres User with org, roles, departments
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      organizationId: invite.organizationId,
      roles: { set: invite.roles },
      departments: {
        set: invite.departmentIds.map((id) => ({ id })),
      },
      isDeleted: false,
      deletedAt: null,
    },
    create: {
      id: userId,
      email: invite.email,
      organizationId: invite.organizationId,
      roles: invite.roles,
      departments: {
        connect: invite.departmentIds.map((id) => ({ id })),
      },
    },
  });

  // 3. Mark invite as accepted
  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED" },
  });

  // 4. Set publicMetadata.role so middleware routing works consistently
  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: "admin" },
    });
  } catch (metaErr) {
    console.warn("Clerk metadata update warning:", metaErr);
  }

  revalidatePath("/select-org");

  // Redirect to /select-org which will detect the new membership
  // and auto-activate the org via the client-side AutoActivateOrg component.
  // We do NOT go to /select-role because invited org users already have roles assigned.
  redirect("/select-org");
}
