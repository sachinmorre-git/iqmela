import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InviteMemberForm } from './InviteMemberForm'
import { TeamMembersTable } from './TeamMembersTable'
import { updateMember, removeMember } from './actions'
import { getCallerPermissions } from '@/lib/rbac'
import { SyncClerkButton } from './SyncClerkButton'

export const metadata = {
  title: "Team & Workspace | Org Admin",
}

export default async function OrgTeamPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect('/select-role');
  if (!perms.canManageTeam) redirect('/org-admin/dashboard');

  const { orgId } = perms;

  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true }
  });

  const members = await prisma.user.findMany({
    where: { organizationId: orgId, isDeleted: false },
    select: {
      id: true,
      email: true,
      name: true,
      roles: true,
      departments: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const serializedMembers = members.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  // Server-side filter: Dept Admins see only members in their departments (+ unassigned)
  const visibleMembers = perms.scopedDeptIds
    ? serializedMembers.filter(m =>
        m.departments.length === 0 || m.departments.some(d => perms.scopedDeptIds!.includes(d.id))
      )
    : serializedMembers;

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Team & Workspace Settings
          </h2>
          <p className="text-muted-foreground mt-1 text-zinc-400">
            Manage your organization members, invite new teammates, and modify roles and departments.
          </p>
        </div>
        
        {/* Local Development Override */}
        {process.env.NODE_ENV === "development" && (
           <SyncClerkButton />
        )}
      </div>

      {perms.canInvite && (
        <InviteMemberForm 
          departments={departments} 
          assignableRoles={perms.assignableRoles}
          scopedDeptIds={perms.scopedDeptIds}
          canCreateDept={perms.canCreateDepartment}
        />
      )}

      <TeamMembersTable
        members={visibleMembers}
        departments={departments}
        assignableRoles={perms.assignableRoles}
        scopedDeptIds={perms.scopedDeptIds}
        callerUserId={perms.userId}
        callerRoles={perms.roles}
        updateMemberAction={updateMember}
        removeMemberAction={removeMember}
      />
    </div>
  );
}
