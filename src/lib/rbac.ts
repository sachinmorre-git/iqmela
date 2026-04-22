import { auth } from '@clerk/nextjs/server';
import { prisma } from './prisma';

// Re-export client-safe RBAC utilities so existing server-side imports don't break
export { getRank, canModifyTarget } from './rbac-shared';

// ── Role hierarchy tiers ─────────────────────────────────────────────────────
const PIPELINE_ROLES = ["ORG_ADMIN", "ADMIN", "DEPT_ADMIN", "RECRUITER", "HIRING_MANAGER"];
const ALL_ORG_ROLES  = [...PIPELINE_ROLES, "B2B_INTERVIEWER", "VENDOR"];

export async function getCallerPermissions() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true, departments: { select: { id: true } } }
  });

  if (!user) return null;

  const roles = user.roles as string[];
  const isOrgAdmin      = roles.includes("ORG_ADMIN") || roles.includes("ADMIN");
  const isDeptAdmin     = roles.includes("DEPT_ADMIN");
  const isRecruiter     = roles.includes("RECRUITER");
  const isHiringManager = roles.includes("HIRING_MANAGER");
  const isInterviewer   = roles.includes("B2B_INTERVIEWER");
  const isVendor        = roles.includes("VENDOR");
  const isPipeline      = roles.some(r => PIPELINE_ROLES.includes(r));
  const isOrgMember     = roles.some(r => ALL_ORG_ROLES.includes(r));
  const deptIds         = user.departments.map(d => d.id);

  return {
    // ── Identity ──
    userId,
    orgId,
    roles,
    isOrgAdmin,
    isDeptAdmin,
    isRecruiter,
    isHiringManager,
    isInterviewer,
    isVendor,

    // ── Scoping ──
    scopedDeptIds: isOrgAdmin ? null : deptIds, // null = ALL departments

    // ── Team & Org Management ──
    canInvite:            (isOrgAdmin || isDeptAdmin) && !isVendor,
    canManageTeam:        (isOrgAdmin || isDeptAdmin) && !isVendor,
    canCreateDepartment:  isOrgAdmin && !isVendor,
    canManageDepartments: isOrgAdmin && !isVendor,
    canManageBilling:     isOrgAdmin && !isVendor,
    canManageSettings:    isOrgAdmin && !isVendor,
    canViewActivity:      isOrgAdmin && !isVendor,
    canManageInvites:     (isOrgAdmin || isDeptAdmin) && !isVendor,

    // ── Hiring Pipeline ──
    canViewPositions:     isPipeline || isVendor,
    canManagePositions:   isPipeline && !isVendor,
    canUploadResumes:     isPipeline || isVendor,
    canRunAI:             isPipeline && !isVendor,
    canViewReviews:       isPipeline && !isVendor,
    canMakeHireDecision:  isPipeline && !isVendor,

    // ── Interview Scheduling ──
    canScheduleInterview:   isPipeline && !isVendor,
    canScheduleAiInterview: isPipeline && !isVendor,

    // ── Interview Conducting — all except Vendor ──
    canConductInterview: isOrgMember && !isVendor,
    canSubmitFeedback:   isOrgMember && !isVendor,

    // ── Role assignment ──
    assignableRoles: getAssignableRoles(roles),
  };
}

export function getAssignableRoles(callerRoles: string[]): string[] {
  if (callerRoles.includes("ORG_ADMIN") || callerRoles.includes("ADMIN")) {
    // Org Admin can assign ORG_ADMIN (promote others) + all lower roles
    return ["ORG_ADMIN", "DEPT_ADMIN", "RECRUITER", "HIRING_MANAGER", "B2B_INTERVIEWER", "VENDOR"];
  }
  if (callerRoles.includes("DEPT_ADMIN")) {
    // Dept Admin can only assign roles below their rank
    return ["RECRUITER", "HIRING_MANAGER", "B2B_INTERVIEWER", "VENDOR"];
  }
  return [];
}

// ── Helper: type for the return value ──
export type CallerPermissions = NonNullable<Awaited<ReturnType<typeof getCallerPermissions>>>;
