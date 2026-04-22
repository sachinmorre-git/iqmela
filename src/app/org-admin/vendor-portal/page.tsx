import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import Link from "next/link"
import { Building2, FileStack, Users, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react"

export const metadata = {
  title: "Vendor Portal | IQMela",
  description: "Track dispatched positions and submitted candidates across all client organizations.",
}

// ── Stage color mapping ──────────────────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  SUBMITTED: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  SCREENING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ROUND_1: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ROUND_2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  ROUND_3: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  ROUND_4: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ROUND_5: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  OFFERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  HIRED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

export default async function VendorPortalDashboard() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")

  const orgId = perms.orgId

  // ── Fetch all dispatched positions for this vendor org ─────────────────
  const dispatches = await prisma.positionVendor.findMany({
    where: {
      vendorOrgId: orgId,
      status: "ACTIVE",
    },
    include: {
      position: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          status: true,
          organizationId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // ── Get unique client org names ────────────────────────────────────────
  const clientOrgIds = [...new Set(dispatches.map((d) => d.position.organizationId).filter(Boolean))] as string[]
  const clientOrgs = clientOrgIds.length > 0
    ? await prisma.organization.findMany({
        where: { id: { in: clientOrgIds } },
        select: { id: true, name: true },
      })
    : []
  const clientOrgMap = new Map(clientOrgs.map((o) => [o.id, o.name]))

  // ── Get resume stats per position ──────────────────────────────────────
  const positionIds = dispatches.map((d) => d.positionId)
  const resumeStats = positionIds.length > 0
    ? await prisma.resume.groupBy({
        by: ["positionId", "vendorStage"],
        where: {
          positionId: { in: positionIds },
          vendorOrgId: orgId,
        },
        _count: { id: true },
      })
    : []

  // Build a map: positionId → { total, inRounds, offered, hired }
  const statsMap = new Map<string, { total: number; inRounds: number; offered: number; hired: number; rejected: number; furthestStage: string }>()
  for (const stat of resumeStats) {
    const existing = statsMap.get(stat.positionId) || { total: 0, inRounds: 0, offered: 0, hired: 0, rejected: 0, furthestStage: "SUBMITTED" }
    existing.total += stat._count.id
    const stage = stat.vendorStage || "SUBMITTED"
    if (["ROUND_1", "ROUND_2", "ROUND_3", "ROUND_4", "ROUND_5"].includes(stage)) existing.inRounds += stat._count.id
    if (stage === "OFFERED") existing.offered += stat._count.id
    if (stage === "HIRED") existing.hired += stat._count.id
    if (stage === "REJECTED") existing.rejected += stat._count.id
    // Track furthest stage
    const stageOrder = ["SUBMITTED", "SCREENING", "ROUND_1", "ROUND_2", "ROUND_3", "ROUND_4", "ROUND_5", "OFFERED", "HIRED"]
    if (stageOrder.indexOf(stage) > stageOrder.indexOf(existing.furthestStage)) {
      existing.furthestStage = stage
    }
    statsMap.set(stat.positionId, existing)
  }

  // ── Aggregate totals ──────────────────────────────────────────────────
  const totalResumes = Array.from(statsMap.values()).reduce((sum, s) => sum + s.total, 0)
  const totalInRounds = Array.from(statsMap.values()).reduce((sum, s) => sum + s.inRounds, 0)
  const totalOffered = Array.from(statsMap.values()).reduce((sum, s) => sum + s.offered, 0)
  const totalHired = Array.from(statsMap.values()).reduce((sum, s) => sum + s.hired, 0)

  // ── Group dispatches by client org ────────────────────────────────────
  const groupedByClient = new Map<string, typeof dispatches>()
  for (const d of dispatches) {
    const clientId = d.position.organizationId || "unknown"
    const existing = groupedByClient.get(clientId) || []
    existing.push(d)
    groupedByClient.set(clientId, existing)
  }

  return (
    <div className="flex-1 space-y-8 max-w-6xl mx-auto p-4 md:p-8 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            Vendor Portal
          </h2>
          <p className="text-gray-500 dark:text-zinc-400 mt-2 text-base">
            Track your dispatched positions and candidate submissions across all client organizations.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{clientOrgIds.length}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Clients</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{dispatches.length}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Positions</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{totalResumes}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Submitted</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{totalInRounds}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">In Rounds</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalOffered + totalHired}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Offers / Hires</p>
        </div>
      </div>

      {/* Dispatched Positions — Grouped by Client */}
      {dispatches.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
          <FileStack className="w-12 h-12 text-gray-300 dark:text-zinc-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Dispatched Positions</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm">
            When a client organization dispatches a position to your agency, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groupedByClient.entries()).map(([clientId, clientDispatches]) => (
            <div key={clientId} className="space-y-3">
              {/* Client Org Header */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-gray-600 dark:text-zinc-300 font-bold text-xs">
                  {(clientOrgMap.get(clientId) || "?").charAt(0).toUpperCase()}
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  {clientOrgMap.get(clientId) || `Client ${clientId.slice(0, 8)}...`}
                </h3>
                <span className="text-xs text-gray-400 dark:text-zinc-600">
                  {clientDispatches.length} position{clientDispatches.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Position Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {clientDispatches.map(({ position }) => {
                  const stats = statsMap.get(position.id)
                  return (
                    <Link
                      key={position.id}
                      href={`/org-admin/vendor-portal/${position.id}`}
                      className="group block"
                    >
                      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 h-full transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-900/50">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight line-clamp-2 flex-1 mr-3">
                            {position.title}
                          </h4>
                          {stats && stats.furthestStage !== "SUBMITTED" && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${STAGE_COLORS[stats.furthestStage] || STAGE_COLORS.SUBMITTED}`}>
                              {stats.furthestStage.replace("_", " ")}
                            </span>
                          )}
                        </div>

                        {position.department && (
                          <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-3">
                            {position.department} {position.location ? `· ${position.location}` : ""}
                          </p>
                        )}

                        {/* Stats Row */}
                        <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-zinc-500 pt-3 border-t border-gray-100 dark:border-zinc-800">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {stats?.total || 0} sent
                          </span>
                          {(stats?.inRounds || 0) > 0 && (
                            <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {stats!.inRounds} in rounds
                            </span>
                          )}
                          {(stats?.offered || 0) > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {stats!.offered} offered
                            </span>
                          )}
                          <span className="ml-auto text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
                            View <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
