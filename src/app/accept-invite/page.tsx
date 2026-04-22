import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AcceptInvitePage(props: { searchParams: Promise<{ token?: string }> }) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-rose-100 dark:border-rose-900/50">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Invite Link</h1>
          <p className="text-gray-500 dark:text-zinc-400">This team invitation link is invalid or is missing its security token.</p>
        </div>
      </div>
    );
  }

  // Find the exact invite
  const invite = await prisma.teamInvite.findUnique({
    where: { token }
  });

  if (!invite) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-rose-100 dark:border-rose-900/50">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invite Not Found</h1>
          <p className="text-gray-500 dark:text-zinc-400">We couldn't locate this invitation. It may have expired or been revoked by the admin.</p>
        </div>
      </div>
    );
  }

  if (invite.status === "ACCEPTED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-blue-100 dark:border-blue-900/50">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Already Accepted</h1>
          <p className="text-gray-500 dark:text-zinc-400">This invitation has already been accepted. You can head straight to your dashboard.</p>
        </div>
      </div>
    );
  }

  if (new Date() > invite.expiresAt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-amber-100 dark:border-amber-900/50">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invitation Expired</h1>
          <p className="text-gray-500 dark:text-zinc-400">This invitation link has expired. Please contact your organization administrator to request a new one.</p>
        </div>
      </div>
    );
  }

  const { userId } = await auth();

  // If they are not logged in, Clerk middleware should ideally catch them, but if they hit this unprotected:
  if (!userId) {
    redirect(`/sign-up?redirect_url=/accept-invite?token=${token}`);
  }

  // --- Proceed with Acceptance ---
  try {
    const client = await clerkClient();

    // 1. Add them to the Clerk Organization bucket
    try {
      const clerkRole = invite.roles.includes("ORG_ADMIN") ? "org:admin" : "org:member";
      await client.organizations.createOrganizationMembership({
        organizationId: invite.organizationId,
        userId: userId,
        role: clerkRole, 
      });
    } catch (clerkError: any) {
      // If they are already a member, Clerk will throw an error. We can ignore it if it's uniquely "already present"
      console.warn("Clerk Membership Error", clerkError.errors?.[0]?.message);
    }

    // 2. Fetch or create Postgres user
    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: invite.email,
      }
    });

    // 3. Connect roles and departments
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: invite.organizationId,
        roles: {
          set: invite.roles // Overwrite or append based on your logic, setting here.
        },
        departments: {
          connect: invite.departmentIds.map(id => ({ id }))
        }
      }
    });

    // 4. Mark invite as accepted
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" }
    });

    // 5. Set publicMetadata.role so middleware routing works consistently
    try {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { role: "admin" },
      });
    } catch (metaErr) {
      console.warn("Clerk metadata update warning:", metaErr);
    }

  } catch (error) {
    console.error("Failed to accept team invite:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-rose-100 dark:border-rose-900/50">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Processing Error</h1>
          <p className="text-gray-500 dark:text-zinc-400">A technical error occurred while trying to link your account to the organization. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Redirect to org activation — invited users already have roles assigned,
  // so they skip the role selection cards and go straight to org activation.
  redirect("/select-org");
}
