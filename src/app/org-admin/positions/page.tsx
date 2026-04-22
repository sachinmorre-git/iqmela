import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PositionsTable } from "./PositionsTable"
import { getCallerPermissions } from "@/lib/rbac"

export const metadata = {
  title: "Positions | Org Admin | IQMela",
  description: "Manage your organisation's open positions.",
}

export default async function PositionsPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");
  if (!perms.canViewPositions) redirect("/org-admin/dashboard");

  const { canManagePositions } = perms;

  // Construct the WHERE clause
  const whereClause: any = { 
    organizationId: perms.orgId,
    isDeleted: false
  };

  // If scopedDeptIds is not null, filter by those departments
  // If the position has NO department, technically it's "unassigned" - should scoped admins see it? 
  // Let's explicitly restrict to their departments.
  if (perms.scopedDeptIds) {
    if (perms.scopedDeptIds.length === 0) {
      // Dept admin with no departments assigned yet
      whereClause.id = "none"; 
    } else {
      whereClause.departmentId = { in: perms.scopedDeptIds };
    }
  }

  const positions = await prisma.position.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      employmentType: true,
      status: true,
      createdAt: true,
    }
  })

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Positions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            {positions.length === 0
              ? "No positions yet. Post your first open role."
              : `${positions.length} position${positions.length !== 1 ? "s" : ""} in your pipeline.`}
          </p>
        </div>
        {canManagePositions && (
          <Button
            className="shrink-0 rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform"
            asChild
          >
            <Link href="/org-admin/positions/new">+ Post New Position</Link>
          </Button>
        )}
      </div>

      {positions.length === 0 ? (
        /* ── Empty State ─────────────────────────────────────── */
        <div className="rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-20 flex flex-col items-center text-center gap-5 bg-white dark:bg-zinc-900">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No positions yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs">
              Create your first open position to start building your hiring pipeline.
            </p>
          </div>
          {canManagePositions && (
            <Button
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white border-transparent shadow-md shadow-teal-600/20 hover:-translate-y-0.5 transition-transform"
              asChild
            >
              <Link href="/org-admin/positions/new">+ Post New Position</Link>
            </Button>
          )}
        </div>
      ) : (
        <PositionsTable initialPositions={positions} />
      )}
    </div>
  )
}
