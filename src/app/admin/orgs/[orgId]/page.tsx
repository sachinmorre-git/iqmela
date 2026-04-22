import { prisma } from "@/lib/prisma"
import { clerkClient, auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getPlanLimits, formatTierName, formatLimit } from "@/lib/plan-limits"
import { OrgManagementPanel } from "../OrgManagementPanel"
import Link from "next/link"
import { ArrowLeft, Building2, Users, Briefcase, FileText, Zap, Globe, Calendar } from "lucide-react"

export const metadata = {
  title: "Organization Detail | IQMela Admin",
}

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params

  // Auth guard
  const { sessionClaims } = await auth()
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString()
  if (!sysRole?.startsWith("sys:")) redirect("/select-role")

  // Fetch Clerk org
  const client = await clerkClient()
  let clerkOrg: any
  try {
    clerkOrg = await client.organizations.getOrganization({ organizationId: orgId })
  } catch {
    return (
      <div className="flex-1 w-full p-8 max-w-5xl mx-auto z-10 relative">
        <div className="text-center py-20">
          <p className="text-2xl font-bold text-white mb-2">Organization Not Found</p>
          <p className="text-zinc-500">Clerk org ID: {orgId}</p>
          <Link href="/admin/dashboard" className="text-indigo-400 hover:underline text-sm mt-4 inline-block">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  // Fetch Prisma org (may not exist yet)
  const prismaOrg = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { planTier: true, domain: true, createdAt: true },
  })

  // Fetch org stats
  const [userCount, positionCount, resumeCount, aiSessionCount, memberList] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.position.count({ where: { organizationId: orgId, isDeleted: false } }),
    prisma.resume.count({ where: { organizationId: orgId } }),
    prisma.aiInterviewSession.count({ where: { organizationId: orgId } }),
    client.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 50 }),
  ])

  const members = memberList.data || []
  const currentTier = prismaOrg?.planTier || null
  const limits = getPlanLimits(currentTier)

  // Build feature list from plan limits
  const features = [
    { key: "positions", label: "Positions", description: `Limit: ${formatLimit(limits.maxPositions)}`, enabled: limits.maxPositions !== 0 },
    { key: "resumes", label: "Resume Uploads", description: `Limit: ${formatLimit(limits.maxResumesPerPosition)}/position`, enabled: limits.maxResumesPerPosition !== 0 },
    { key: "team", label: "Team Members", description: `Limit: ${formatLimit(limits.maxTeamMembers)}`, enabled: limits.maxTeamMembers > 1 },
    { key: "ai", label: "AI Pipeline (Extract + Rank + Judge)", description: "AI text extraction, candidate ranking, advanced judgment", enabled: limits.hasAI },
    { key: "interviews", label: "AI Avatar Interviews", description: "Tavus-powered AI interview sessions", enabled: limits.hasInterviews },
    { key: "vendors", label: "Vendor Dispatch", description: "Dispatch positions to external vendor agencies", enabled: limits.hasVendorDispatch },
    { key: "departments", label: "Departments", description: "Departmental organization and scoping", enabled: limits.hasDepartments },
    { key: "activity", label: "Activity Log", description: "Audit trail of all org actions", enabled: limits.hasActivityLog },
  ]

  // Fetch recent positions for this org
  const recentPositions = await prisma.position.findMany({
    where: { organizationId: orgId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      _count: { select: { resumes: true } },
    },
  })

  // Fetch org users from Prisma
  const orgUsers = await prisma.user.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, email: true, name: true, roles: true, createdAt: true },
  })

  return (
    <div className="flex-1 w-full p-8 max-w-6xl mx-auto space-y-8 z-10 relative">
      {/* Back button */}
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-5 border-b border-zinc-800 pb-6">
        {clerkOrg.imageUrl ? (
          <img src={clerkOrg.imageUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-zinc-700 shadow-lg" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/20 flex items-center justify-center text-purple-300 text-2xl font-black shadow-lg">
            {clerkOrg.name.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{clerkOrg.name}</h1>
            {currentTier && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border border-purple-500/30 bg-purple-500/10 text-purple-400">
                {formatTierName(currentTier)}
              </span>
            )}
            {!currentTier && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border border-zinc-700 bg-zinc-800 text-zinc-500">
                No Prisma Record
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{prismaOrg?.domain || "No domain"}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{new Date(clerkOrg.createdAt).toLocaleDateString()}</span>
            <span className="font-mono text-[10px] text-zinc-600">{orgId}</span>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clerk Members</span>
          </div>
          <div className="text-2xl font-black text-white">{members.length}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">DB Users</span>
          </div>
          <div className="text-2xl font-black text-white">{userCount}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Positions</span>
          </div>
          <div className="text-2xl font-black text-white">{positionCount}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Resumes</span>
          </div>
          <div className="text-2xl font-black text-white">{resumeCount}</div>
        </div>
        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">AI Sessions</span>
          </div>
          <div className="text-2xl font-black text-indigo-100">{aiSessionCount}</div>
        </div>
      </div>

      {/* ── Plan & Features Management ────────────────────────────────────── */}
      <OrgManagementPanel
        orgId={orgId}
        orgName={clerkOrg.name}
        currentTier={currentTier}
        features={features}
      />

      {/* ── Two-Column Layout: Members + Positions ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Organization Members
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{members.length} Clerk members · {orgUsers.length} DB users</p>
          </div>
          {members.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No members found.</div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {members.map((m: any) => {
                const email = m.publicUserData?.identifier || "—"
                const name = [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || null
                const dbUser = orgUsers.find(u => u.email === email)
                return (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold shrink-0">
                        {(name || email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{name || email}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {dbUser && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {(dbUser.roles as string[]).join(", ")}
                        </span>
                      )}
                      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {m.role?.replace("org:", "")}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Positions Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-teal-400" />
              Recent Positions
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{positionCount} total · showing latest 5</p>
          </div>
          {recentPositions.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No positions created yet.</div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {recentPositions.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.title}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-teal-400 font-bold">{p._count.resumes} resumes</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === "OPEN" ? "bg-emerald-900/40 text-emerald-400" :
                      p.status === "DRAFT" ? "bg-zinc-800 text-zinc-400" :
                      "bg-red-900/30 text-red-400"
                    }`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
