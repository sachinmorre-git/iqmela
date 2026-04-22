import { RoleCards } from "./RoleCards"
import { getCallerPermissions } from "@/lib/rbac"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export const metadata = {
  title: 'Select Role | Interview Platform',
  description: 'Choose your role to continue.',
}

/**
 * /select-role routing decision tree:
 * 
 * 1. System staff (sysRole) → /admin/dashboard
 * 2. Already has active org + role cookie → /org-admin/dashboard
 * 3. Has Clerk org memberships but no active session → /select-org (activate org first)
 * 4. No org memberships (marketplace user) → Show role cards
 * 
 * ONLY marketplace users (Lane 3) should ever see the role selection cards.
 * Client Org users (Lane 2) get their roles from the invite, never from these cards.
 */
export default async function SelectRolePage() {
  const { userId, orgId, sessionClaims } = await auth();

  // Gate: Not logged in
  if (!userId) {
    redirect("/sign-in");
  }

  // Gate 1: System staff → admin dashboard
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (sysRole?.startsWith("sys:")) {
    redirect("/admin/dashboard");
  }

  const c = await import("next/headers").then(m => m.cookies());
  const hasCookie = c.has("user_role");

  // Gate 2: Already in an active org with a role cookie → go to dashboard
  if (orgId && hasCookie) {
    redirect("/org-admin/dashboard");
  }

  // Gate 3: Check if user has Clerk org memberships (even if not active yet)
  // If they do, they are a Client Org user — send to /select-org to activate.
  // They should NEVER see the marketplace role cards.
  const client = await clerkClient();
  const membershipList = await client.users.getOrganizationMembershipList({ userId });
  const memberships = membershipList.data || [];

  if (memberships.length > 0) {
    redirect("/select-org");
  }

  // Gate 4: Check if they have pending invites (they might have been invited but not yet accepted)
  // In that case, they should also go to /select-org which shows the pending invite cards.
  const { prisma } = await import("@/lib/prisma");
  const clerkUser = await client.users.getUser(userId);
  const userEmail = clerkUser.emailAddresses?.[0]?.emailAddress;

  if (userEmail) {
    const pendingInviteCount = await prisma.teamInvite.count({
      where: {
        email: { equals: userEmail, mode: "insensitive" },
        status: "SENT",
      },
    });

    if (pendingInviteCount > 0) {
      redirect("/select-org");
    }
  }

  // ── LANE 3: Marketplace User — Show role cards ─────────────────────────────
  // Only users with ZERO org memberships AND ZERO pending invites reach here.
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[75vh] py-16 px-4 w-full">
      <div className="w-full max-w-3xl text-center mb-12">
        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">How do you want to use the platform?</h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">Select your primary role to customize your dashboard experience.</p>
      </div>
      
      <RoleCards />

    </div>
  )
}
