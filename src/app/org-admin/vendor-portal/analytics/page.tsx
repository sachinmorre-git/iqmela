import { VendorStage } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import Link from "next/link"
import { ArrowLeft, BarChart3, TrendingUp, Users, Target, Award } from "lucide-react"

export const metadata = {
  title: "Vendor Analytics | IQMela",
  description: "Performance analytics for your vendor submissions across all client organizations.",
}

const STAGE_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  SCREENING: "Screening",
  ROUND_1: "Round 1",
  ROUND_2: "Round 2",
  ROUND_3: "Round 3",
  ROUND_4: "Round 4",
  ROUND_5: "Round 5",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
}

export default async function VendorAnalyticsPage() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")

  const orgId = perms.orgId

  // ── Fetch all resumes submitted by this vendor org ──────────────────────
  const stageBreakdown = await prisma.resume.groupBy({
    by: ["vendorStage"],
    where: { vendorOrgId: orgId },
    _count: { id: true },
  })

  const totalSubmitted = stageBreakdown.reduce((sum, s) => sum + s._count.id, 0)

  // Build funnel data
  const funnelStages: VendorStage[] = [
    "SUBMITTED", "SCREENING", "ROUND_1", "ROUND_2", "ROUND_3",
    "ROUND_4", "ROUND_5", "OFFERED", "HIRED",
  ]
  const stageMap = new Map(stageBreakdown.map((s) => [s.vendorStage || "SUBMITTED", s._count.id]))
  const rejected = stageMap.get("REJECTED") || 0

  // Calculate "at or past" each stage (cumulative forward count)
  // For a funnel, we show how many candidates reached each stage
  const funnelData = funnelStages.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: stageMap.get(stage) || 0,
  }))

  // Per-client breakdown
  const clientBreakdown = await prisma.resume.groupBy({
    by: ["positionId"],
    where: { vendorOrgId: orgId },
    _count: { id: true },
  })

  const positionIds = clientBreakdown.map((c) => c.positionId)
  const positions = positionIds.length > 0
    ? await prisma.position.findMany({
        where: { id: { in: positionIds } },
        select: { id: true, title: true, organizationId: true },
      })
    : []

  const positionMap = new Map(positions.map((p) => [p.id, p]))

  // Get org names
  const orgIds = [...new Set(positions.map((p) => p.organizationId).filter(Boolean))] as string[]
  const orgs = orgIds.length > 0
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      })
    : []
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]))

  // Placement rate
  const hired = stageMap.get("HIRED") || 0
  const offered = stageMap.get("OFFERED") || 0
  const placementRate = totalSubmitted > 0 ? Math.round(((hired + offered) / totalSubmitted) * 100) : 0

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto p-4 md:p-8 w-full">
      {/* Back */}
      <Link
        href="/org-admin/vendor-portal"
        className="text-sm font-medium text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 flex items-center transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Vendor Portal
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          Vendor Analytics
        </h2>
        <p className="text-gray-500 dark:text-zinc-400 mt-2">
          Performance overview across all client organizations.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
          <Users className="w-5 h-5 text-rose-500 mb-2" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">{totalSubmitted}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Total Submitted</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
          <TrendingUp className="w-5 h-5 text-pink-500 mb-2" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {funnelData.filter((f) => ["ROUND_1", "ROUND_2", "ROUND_3", "ROUND_4", "ROUND_5"].includes(f.stage)).reduce((sum, f) => sum + f.count, 0)}
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">In Interview Rounds</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
          <Award className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{hired + offered}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Offers + Hires</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
          <Target className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-3xl font-black text-gray-900 dark:text-white">{placementRate}%</p>
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mt-1">Placement Rate</p>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-6">
          Candidate Funnel
        </h3>
        <div className="space-y-2">
          {funnelData.map((f) => {
            const widthPct = totalSubmitted > 0 ? Math.max(4, (f.count / totalSubmitted) * 100) : 0
            return (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium text-gray-500 dark:text-zinc-500 text-right shrink-0">
                  {f.label}
                </div>
                <div className="flex-1 h-8 bg-gray-50 dark:bg-zinc-900 rounded-xl overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl transition-all duration-700 flex items-center px-3"
                    style={{ width: `${widthPct}%` }}
                  >
                    {f.count > 0 && (
                      <span className="text-xs font-bold text-white">{f.count}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {rejected > 0 && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <div className="w-20 text-xs font-medium text-red-500 text-right shrink-0">Rejected</div>
              <div className="flex-1 h-8 bg-gray-50 dark:bg-zinc-900 rounded-xl overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-xl transition-all duration-700 flex items-center px-3"
                  style={{ width: `${Math.max(4, (rejected / totalSubmitted) * 100)}%` }}
                >
                  <span className="text-xs font-bold text-white">{rejected}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-Position Breakdown */}
      {clientBreakdown.length > 0 && (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Per-Position Breakdown
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {clientBreakdown.map((cb) => {
              const pos = positionMap.get(cb.positionId)
              if (!pos) return null
              const clientName = pos.organizationId ? orgMap.get(pos.organizationId) : null
              return (
                <Link
                  key={cb.positionId}
                  href={`/org-admin/vendor-portal/${cb.positionId}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {pos.title}
                    </p>
                    {clientName && (
                      <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">{clientName}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    {cb._count.id} résumé{cb._count.id !== 1 ? "s" : ""}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
