import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { OrganizationSwitcher } from '@clerk/nextjs'
import { getCallerPermissions } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ── Role Guard ───────────────────────────────────────────────────────
  const { userId, orgId } = await auth()
  
  if (!userId) redirect('/select-role')
  if (!orgId) redirect('/select-org')

  const perms = await getCallerPermissions();

  if (!perms) {
    redirect('/select-role')
  }

  // ── Vendor Portal Gating ──────────────────────────────────────────────
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { planTier: true },
  })

  const isVendorFreeOrg = org?.planTier === "VENDOR_FREE"
  const isFreeOrg   = org?.planTier === "FREE" || !org?.planTier
  const isFreeTier  = isVendorFreeOrg || isFreeOrg
  
  const vendorDispatchCount = await prisma.positionVendor.count({
    where: { vendorOrgId: orgId, status: "ACTIVE" },
  })
  
  const showVendorPortal = isVendorFreeOrg || vendorDispatchCount > 0

  // For free tiers: VENDOR_FREE hides pipeline entirely, PLUS shows Positions + Reviews (limited)
  const showPipeline = !isVendorFreeOrg
  const showFullPipeline = !isFreeTier // AI features, Interviews Pipeline, Departments
  // ── End Vendor Portal Gating ──────────────────────────────────────────
  
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/40 py-6 flex flex-col gap-6">
        
        {/* Workspace Switcher */}
        <div className="px-4">
          <OrganizationSwitcher 
            hidePersonal 
            afterSelectOrganizationUrl="/org-admin/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "flex w-full justify-between rounded-xl border border-gray-200 dark:border-zinc-700 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors",
                organizationPreviewMainIdentifier: "text-sm font-bold dark:text-white",
                organizationPreviewSecondaryIdentifier: "text-zinc-500",
              }
            }}
          />
          {/* Role Label */}
          <div className="mt-2 px-1 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">
              {getRoleLabel(perms.roles)} Dashboard
            </span>
            {isFreeTier && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isVendorFreeOrg ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30' : 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/30'}`}>
                {isVendorFreeOrg ? 'Vendor' : 'Starter'}
              </span>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 px-4 h-full">
          {/* Dashboard — always visible */}
          <Link href="/org-admin/dashboard" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            Dashboard
          </Link>

          {/* ── VENDOR PORTAL Section ── */}
          {showVendorPortal && (
            <>
              <div className="mt-3 mb-1 px-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                  Vendor Portal
                </span>
              </div>

              <Link href="/org-admin/vendor-portal" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>
                Dispatched Positions
                {vendorDispatchCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                    {vendorDispatchCount}
                  </span>
                )}
              </Link>

              <Link href="/org-admin/vendor-portal/analytics" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                Analytics
              </Link>
            </>
          )}

          {/* ── Pipeline Section ── */}
          {showPipeline && (
            <>
              {showVendorPortal && (
                <div className="mt-3 mb-1 px-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
                    Hiring Pipeline
                  </span>
                </div>
              )}

              {perms.canViewPositions && (
                <Link href="/org-admin/positions" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                  Positions
                </Link>
              )}

              {perms.canViewPositions && !perms.isVendor && showFullPipeline && (
                <Link href="/org-admin/interviews" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Interviews Pipeline
                </Link>
              )}

              {perms.canConductInterview && showFullPipeline && (
                <Link href="/interviewer/interviews" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  My Interviews
                </Link>
              )}

              {perms.canViewReviews && (
                <Link href="/org-admin/reviews" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Reviews
                </Link>
              )}
            </>
          )}

          {/* ── Free tier locked features hint ── */}
          {isFreeTier && (
            <>
              <div className="mt-3 mb-1 px-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
                  {isVendorFreeOrg ? 'Your Hiring' : 'Pro Features'}
                </span>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-900/40 border border-dashed border-gray-200 dark:border-zinc-800">
                <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed">
                  {isVendorFreeOrg
                    ? '🔒 Positions, AI Pipeline, Interviews, and more are available when you upgrade to a full plan.'
                    : '🔒 AI Pipeline, Interviews, Departments, and advanced features unlock with Professional.'}
                </p>
                <button className="mt-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Upgrade to Professional →
                </button>
              </div>
            </>
          )}

          {/* ── Management Section ── */}
          {perms.canManageTeam && (
            <Link href="/org-admin/team" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Team Settings
            </Link>
          )}

          {!isFreeTier && perms.canManageDepartments && (
            <Link href="/org-admin/departments" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
              Departments
            </Link>
          )}

          {!isFreeTier && perms.canManageInvites && (
            <Link href="/org-admin/invites" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Invites
            </Link>
          )}

          {!isFreeTier && perms.canViewActivity && (
            <Link href="/org-admin/activity" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Activity Log
            </Link>
          )}

          {/* Spacer */}
          <div className="mt-auto"></div>

          {/* System Settings — ORG_ADMIN only */}
          {perms.canManageSettings && (
            <Link href="/org-admin/settings" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              System Settings
            </Link>
          )}

          {/* Billing — ORG_ADMIN only */}
          {perms.canManageBilling && (
            <Link href="/org-admin/billing" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Billing
            </Link>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

/** Maps Prisma role enums to human-readable dashboard labels */
function getRoleLabel(roles: string[]): string {
  // Priority order — show the highest-ranked role
  if (roles.includes("ORG_ADMIN") || roles.includes("ADMIN")) return "Org Admin";
  if (roles.includes("DEPT_ADMIN")) return "Dept Admin";
  if (roles.includes("RECRUITER")) return "Recruiter";
  if (roles.includes("HIRING_MANAGER")) return "Hiring Manager";
  if (roles.includes("B2B_INTERVIEWER")) return "Interviewer";
  if (roles.includes("VENDOR")) return "Vendor";
  return "Member";
}
