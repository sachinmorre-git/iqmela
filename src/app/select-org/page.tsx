import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PendingInviteCard } from "./PendingInviteCard";
import { OrgSelector } from "./OrgSelector";
import { AutoActivateOrg } from "./AutoActivateOrg";
import { Building2, Mail, ShieldAlert, Clock } from "lucide-react";

export const metadata = {
  title: "Select Workspace | IQMela",
};

export default async function SelectOrgPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const client = await clerkClient();

  // 1. Get the user's actual Clerk org memberships
  const membershipList = await client.users.getOrganizationMembershipList({ userId });
  const memberships = membershipList.data || [];

  // ── DIAGNOSTIC LOGGING ──
  const clerkUserForLog = await client.users.getUser(userId);
  const emailForLog = clerkUserForLog.emailAddresses?.[0]?.emailAddress;
  console.log(`\n========== [SELECT-ORG DIAGNOSTICS] ==========`);
  console.log(`  Clerk userId:     ${userId}`);
  console.log(`  Clerk email:      ${emailForLog}`);
  console.log(`  Clerk memberships: ${memberships.length}`);
  
  // Check DB
  const dbById = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, organizationId: true, roles: true } });
  const dbByEmail = emailForLog ? await prisma.user.findUnique({ where: { email: emailForLog }, select: { id: true, email: true, organizationId: true, roles: true } }) : null;
  console.log(`  DB user (by id):   ${dbById ? JSON.stringify(dbById) : 'NOT FOUND'}`);
  console.log(`  DB user (by email): ${dbByEmail ? JSON.stringify(dbByEmail) : 'NOT FOUND'}`);
  
  // Check pending invites
  const inviteCount = emailForLog ? await prisma.teamInvite.count({ where: { email: { equals: emailForLog, mode: "insensitive" } } }) : 0;
  const sentInviteCount = emailForLog ? await prisma.teamInvite.count({ where: { email: { equals: emailForLog, mode: "insensitive" }, status: "SENT" } }) : 0;
  console.log(`  Total TeamInvites: ${inviteCount}`);
  console.log(`  SENT TeamInvites:  ${sentInviteCount}`);
  console.log(`  isDev:             ${process.env.NODE_ENV === "development"}`);
  console.log(`==============================================\n`);

  // ── CASE: 1 membership → auto-activate via client-side setActive ────────
  // We can't do a server-side redirect here because the org isn't "active"
  // in the Clerk session yet. Middleware would bounce us back, causing a loop.
  if (memberships.length === 1) {
    const singleOrg = memberships[0].organization;
    return <AutoActivateOrg orgId={singleOrg.id} orgName={singleOrg.name} />;
  }

  // ── CASE: 2+ memberships → show org selector ──────────────────────────────
  if (memberships.length > 1) {
    const orgList = memberships.map((m) => ({
      id: m.id,
      orgId: m.organization.id,
      orgName: m.organization.name,
      orgImageUrl: m.organization.imageUrl || null,
      role: m.role,
    }));

    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        {/* Background ambient glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-rose-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Select Workspace</h1>
            <p className="text-zinc-500 mt-1 text-sm">Choose an organization to continue.</p>
          </div>

          <OrgSelector memberships={orgList} />
        </div>
      </div>
    );
  }

  // ── CASE: 0 memberships → auto-heal OR check for pending invites ─────────
  const isDev = process.env.NODE_ENV === "development";

  // Get the user's email from Clerk
  const clerkUser = await client.users.getUser(userId);
  const userEmail = clerkUser.emailAddresses?.[0]?.emailAddress;

  // ── AUTO-HEAL: User in Postgres with an org, but missing from Clerk ────────
  // This handles legacy data created before instant provisioning was implemented.
  // We check BOTH by id AND by email, because legacy users may have been seeded
  // with old Clerk IDs that don't match the current session.
  if (userEmail) {
    let dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, roles: true },
    });

    // Fallback: look up by email if id didn't match
    if (!dbUser) {
      dbUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, organizationId: true, roles: true },
      });
    }

    if (dbUser?.organizationId) {
      console.log(`[select-org] Auto-healing: ${userEmail} (DB id: ${dbUser.id}, Clerk id: ${userId}) is in Postgres org ${dbUser.organizationId} but has 0 Clerk memberships. Syncing...`);
      try {
        const roles = dbUser.roles as string[];
        const clerkRole = roles.includes("ORG_ADMIN") || roles.includes("ADMIN") ? "org:admin" : "org:member";
        
        await client.organizations.createOrganizationMembership({
          organizationId: dbUser.organizationId,
          userId: userId,
          role: clerkRole,
        });

        // Set publicMetadata for middleware routing
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { role: "admin" },
        });

        // If the Postgres ID doesn't match the Clerk ID, re-link the record
        if (dbUser.id !== userId) {
          console.log(`[select-org] Re-linking Postgres record from old ID ${dbUser.id} to new Clerk ID ${userId}`);
          // Delete old record and create new one with correct ID
          const oldUser = await prisma.user.findUnique({
            where: { id: dbUser.id },
            include: { departments: { select: { id: true } } },
          });
          if (oldUser) {
            await prisma.user.delete({ where: { id: dbUser.id } });
            await prisma.user.create({
              data: {
                id: userId,
                email: userEmail,
                name: oldUser.name,
                organizationId: oldUser.organizationId,
                roles: oldUser.roles,
                departments: { connect: oldUser.departments.map(d => ({ id: d.id })) },
              },
            });
          }
        }

        console.log(`[select-org] Auto-heal complete for ${userEmail}. Activating org...`);
        
        // Get the org name for AutoActivateOrg
        let orgName = "Your Workspace";
        try {
          const org = await client.organizations.getOrganization({ organizationId: dbUser.organizationId });
          orgName = org.name;
        } catch {}

        return <AutoActivateOrg orgId={dbUser.organizationId} orgName={orgName} />;
      } catch (healErr: any) {
        console.warn("[select-org] Auto-heal failed:", healErr.errors?.[0]?.message || healErr);
      }
    }
  }

  let pendingInvites: {
    id: string;
    organizationId: string;
    orgName: string;
    roles: string[];
    createdAt: string;
  }[] = [];

  if (userEmail) {
    const invites = await prisma.teamInvite.findMany({
      where: {
        email: { equals: userEmail, mode: "insensitive" },
        status: "SENT",
      },
      orderBy: { createdAt: "desc" },
    });

    // Look up org names from Clerk for each invite
    const orgsCache: Record<string, string> = {};
    for (const invite of invites) {
      if (!orgsCache[invite.organizationId]) {
        try {
          const org = await client.organizations.getOrganization({
            organizationId: invite.organizationId,
          });
          orgsCache[invite.organizationId] = org.name;
        } catch {
          orgsCache[invite.organizationId] = "Unknown Organization";
        }
      }
    }

    pendingInvites = invites.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      orgName: orgsCache[inv.organizationId],
      roles: inv.roles as string[],
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  // ── DEV MODE: Show pending invites inline ──────────────────────────────────
  if (isDev && pendingInvites.length > 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        {/* Background ambient glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Pending Invitations</h1>
            <p className="text-zinc-500 mt-1 text-sm">
              You have {pendingInvites.length} pending invite{pendingInvites.length > 1 ? "s" : ""}. Accept to join.
            </p>
            {/* Dev badge */}
            <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              DEV MODE — No email required
            </div>
          </div>

          <div className="space-y-4">
            {pendingInvites.map((invite) => (
              <PendingInviteCard key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── PROD MODE (or dev with no invites): Locked wall ────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>

          <h1 className="text-xl font-bold text-white mb-2">No Organization Found</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Your account is not currently linked to any organization. To access your workspace,
            you need an invitation from your organization administrator.
          </p>

          <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-3 text-left">
            <Mail className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-zinc-300">Check your email</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                If you&apos;ve been invited, look for an email with a link to join your organization.
              </p>
            </div>
          </div>

          {/* Show pending invites in prod too, if they exist */}
          {pendingInvites.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-zinc-400">Or accept a pending invite:</p>
              {pendingInvites.map((invite) => (
                <PendingInviteCard key={invite.id} invite={invite} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
