import { prisma } from "@/lib/prisma"
import { clerkClient } from "@clerk/nextjs/server"
import { formatTierName } from "@/lib/plan-limits"
import Link from "next/link"
import { Building2, Users, FileText, Briefcase, Zap, TrendingUp } from "lucide-react"

export const metadata = {
  title: "Global Overview | IQMela Admin"
}

export default async function AdminDashboardPage() {
  // ── Global Aggregations ────────────────────────────────────────────────
  const [
    totalResumes,
    totalAiSessions,
    totalTokens,
    totalUsers,
    totalPositions,
  ] = await Promise.all([
    prisma.resume.count(),
    prisma.aiInterviewSession.count(),
    prisma.aiUsageLog.aggregate({ _sum: { totalTokens: true } }),
    prisma.user.count(),
    prisma.position.count(),
  ])

  // ── Fetch all Clerk organizations ──────────────────────────────────────
  const client = await clerkClient()
  const clerkOrgs = await client.organizations.getOrganizationList({ limit: 100 })
  const allOrgs = clerkOrgs.data || []

  // ── Fetch Prisma Organization metadata (planTier, domain) ──────────────
  const prismaOrgs = await prisma.organization.findMany({
    select: { id: true, planTier: true, domain: true, createdAt: true },
  })
  const prismaOrgMap = new Map(prismaOrgs.map(o => [o.id, o]))

  // ── Aggregate stats per org ────────────────────────────────────────────
  const [usersByOrg, positionsByOrg, resumesByOrg, aiSessionsByOrg] = await Promise.all([
    prisma.user.groupBy({ by: ["organizationId"], _count: { id: true } }),
    prisma.position.groupBy({ by: ["organizationId"], _count: { id: true }, where: { isDeleted: false } }),
    prisma.resume.groupBy({ by: ["organizationId"], _count: { id: true } }),
    prisma.aiInterviewSession.groupBy({ by: ["organizationId"], _count: { id: true } }),
  ])

  const userCountMap = new Map(usersByOrg.map(u => [u.organizationId, u._count.id]))
  const posCountMap = new Map(positionsByOrg.map(p => [p.organizationId, p._count.id]))
  const resumeCountMap = new Map(resumesByOrg.map(r => [r.organizationId, r._count.id]))
  const aiCountMap = new Map(aiSessionsByOrg.map(a => [a.organizationId, a._count.id]))

  // ── Build enriched org list ────────────────────────────────────────────
  const orgs = allOrgs.map(org => {
    const prismaData = prismaOrgMap.get(org.id)
    return {
      id: org.id,
      name: org.name,
      imageUrl: org.imageUrl,
      createdAt: org.createdAt,
      membersCount: org.membersCount || 0,
      planTier: prismaData?.planTier || null,
      domain: prismaData?.domain || null,
      dbUsers: userCountMap.get(org.id) || 0,
      positions: posCountMap.get(org.id) || 0,
      resumes: resumeCountMap.get(org.id) || 0,
      aiSessions: aiCountMap.get(org.id) || 0,
    }
  }).sort((a, b) => {
    // Sort by activity (positions + resumes) desc
    const aActivity = a.positions + a.resumes
    const bActivity = b.positions + b.resumes
    return bActivity - aActivity
  })

  // ── Tier distribution for summary ──────────────────────────────────────
  const tierCounts = orgs.reduce((acc, org) => {
    const tier = org.planTier || "UNLINKED"
    acc[tier] = (acc[tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // ── Recently active positions ──────────────────────────────────────────
  const recentPositions = await prisma.position.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      status: true,
      organizationId: true,
      createdAt: true,
      createdBy: { select: { email: true } },
      _count: { select: { resumes: true, aiInterviewSessions: true } },
    },
  })

  // Map org names for recent positions
  const orgNameMap = new Map(allOrgs.map(o => [o.id, o.name]))

  const TIER_COLORS: Record<string, string> = {
    VENDOR_FREE: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    FREE:        "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    PLUS:        "text-teal-400 bg-teal-500/10 border-teal-500/20",
    ULTRA:       "text-violet-400 bg-violet-500/10 border-violet-500/20",
    ENTERPRISE:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    UNLINKED:    "text-zinc-500 bg-zinc-800 border-zinc-700",
  }

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Platform Overview</h1>
        <p className="text-zinc-400 mt-2">Monitor all organizations, usage metrics, and platform health across the entire IQMela ecosystem.</p>
      </div>

      {/* ── Global KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Orgs</span>
          </div>
          <div className="text-3xl font-black text-white">{allOrgs.length}</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Users</span>
          </div>
          <div className="text-3xl font-black text-white">{totalUsers}</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Positions</span>
          </div>
          <div className="text-3xl font-black text-white">{totalPositions}</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Resumes</span>
          </div>
          <div className="text-3xl font-black text-white">{totalResumes}</div>
        </div>

        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Sessions</span>
          </div>
          <div className="text-3xl font-black text-indigo-100 relative z-10">{totalAiSessions}</div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tokens</span>
          </div>
          <div className="text-2xl font-black text-white">{((totalTokens._sum.totalTokens || 0) / 1000).toFixed(1)}k</div>
        </div>
      </div>

      {/* ── Tier Distribution ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(tierCounts).map(([tier, count]) => (
          <div key={tier} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${TIER_COLORS[tier] || TIER_COLORS.UNLINKED}`}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {tier === "UNLINKED" ? "No Prisma Record" : formatTierName(tier as any)} — {count}
          </div>
        ))}
      </div>

      {/* ── All Organizations Table ───────────────────────────────────────── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              All Organizations
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">{allOrgs.length} total workspaces across the platform</p>
          </div>
        </div>

        {orgs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No organizations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Organization</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Plan</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Members</th>
                  <th className="px-4 py-3.5 font-semibold text-center">DB Users</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Positions</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Resumes</th>
                  <th className="px-4 py-3.5 font-semibold text-center">AI Sessions</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {orgs.map((org) => {
                  const tier = org.planTier || "UNLINKED"
                  const tierStyle = TIER_COLORS[tier] || TIER_COLORS.UNLINKED
                  return (
                    <tr key={org.id} className="hover:bg-zinc-800/30 transition-colors group cursor-pointer">
                      <td className="px-6 py-4">
                        <Link href={`/admin/orgs/${org.id}`} className="flex items-center gap-3">
                          {org.imageUrl ? (
                            <img src={org.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-zinc-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold border border-zinc-700">
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white group-hover:text-purple-300 transition-colors">{org.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-zinc-600">{org.id.slice(0, 20)}…</span>
                              {org.domain && (
                                <span className="text-[10px] text-zinc-500">· {org.domain}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${tierStyle}`}>
                          {tier === "UNLINKED" ? "—" : formatTierName(org.planTier as any)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-blue-400 font-bold">{org.membersCount}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-zinc-300 font-medium">{org.dbUsers}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${org.positions > 0 ? "text-emerald-400" : "text-zinc-600"}`}>{org.positions}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${org.resumes > 0 ? "text-teal-400" : "text-zinc-600"}`}>{org.resumes}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${org.aiSessions > 0 ? "text-indigo-400" : "text-zinc-600"}`}>{org.aiSessions}</span>
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-zinc-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Recent Positions</h2>
          <p className="text-sm text-zinc-500">Latest positions created across all workspaces.</p>
        </div>

        {recentPositions.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No activity yet.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Position</th>
                <th className="px-4 py-3.5 font-semibold">Organization</th>
                <th className="px-4 py-3.5 font-semibold">Creator</th>
                <th className="px-4 py-3.5 font-semibold text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-center">Resumes</th>
                <th className="px-4 py-3.5 font-semibold text-center">AI</th>
                <th className="px-4 py-3.5 font-semibold text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {recentPositions.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-white">{p.title}</td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400">{orgNameMap.get(p.organizationId || "") || p.organizationId?.slice(0, 16) || "—"}</td>
                  <td className="px-4 py-3.5 text-xs text-zinc-500">{p.createdBy?.email || "—"}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === "OPEN" ? "bg-emerald-900/40 text-emerald-400" :
                      p.status === "DRAFT" ? "bg-zinc-800 text-zinc-400" :
                      "bg-red-900/30 text-red-400"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-teal-400">{p._count.resumes}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-indigo-400">{p._count.aiInterviewSessions}</td>
                  <td className="px-4 py-3.5 text-right text-xs text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
