// ── Client-safe RBAC utilities ───────────────────────────────────────────────
// These functions have ZERO server-side dependencies (no Prisma, no Clerk auth).
// They can be safely imported in both Server and Client Components.

// ── Rank system for privilege escalation prevention ──────────────────────────
const ROLE_RANK: Record<string, number> = {
  ORG_ADMIN:        100,
  ADMIN:            100,
  DEPT_ADMIN:        80,
  HIRING_MANAGER:    60,
  RECRUITER:         60,
  B2B_INTERVIEWER:   40,
  PUBLIC_INTERVIEWER: 40,
  VENDOR:            20,
  PUBLIC_CANDIDATE:  10,
};

/** Returns the highest rank among a set of roles */
export function getRank(roles: string[]): number {
  return Math.max(0, ...roles.map(r => ROLE_RANK[r] ?? 0));
}

/**
 * Can the caller modify the target user?
 * Rules:
 *  - Cannot modify yourself
 *  - Cannot modify someone of equal or higher rank
 *  - Org Admin can modify anyone except other Org Admins
 */
export function canModifyTarget(
  callerRoles: string[],
  targetRoles: string[],
  callerUserId: string,
  targetUserId: string
): boolean {
  if (callerUserId === targetUserId) return false; // self-edit prevention
  const callerRank = getRank(callerRoles);
  const targetRank = getRank(targetRoles);
  return callerRank > targetRank;
}
