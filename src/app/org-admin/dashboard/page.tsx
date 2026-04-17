import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export const metadata = {
  title: 'Org Admin Dashboard | IQMela',
  description: 'Manage your organisation\'s hiring pipeline.',
}

export default async function OrgAdminDashboard() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // ── Real-time stats ────────────────────────────────────────────────────────
  const [
    openPositions,
    uploadedResumes,
    shortlisted,
    invitesSent,
    aiCompleted,
    aiPending,
    needsReview,
    recentBatchRuns,
  ] = await Promise.all([
    prisma.position.count({ where: { organizationId: orgId } }),
    prisma.resume.count({ where: { position: { organizationId: orgId } } }),
    prisma.resume.count({ where: { position: { organizationId: orgId }, isShortlisted: true } }),
    prisma.interviewInvite.count({ where: { position: { organizationId: orgId }, status: "SENT" } }),
    // Step 228: AI interview metrics
    prisma.aiInterviewSession.count({ where: { position: { organizationId: orgId }, status: "COMPLETED" } }),
    prisma.aiInterviewSession.count({ where: { position: { organizationId: orgId }, status: "IN_PROGRESS" } }),
    prisma.aiInterviewSession.count({
      where: {
        position: { organizationId: orgId },
        status: "COMPLETED",
        recommendation: { in: ["NEEDS_HUMAN_REVIEW", "MAYBE"] },
        reviewedAt: null,
      }
    }),
    prisma.positionBatchRun.findMany({
      where: { position: { organizationId: orgId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { actionType: true, status: true, totalProcessed: true, succeeded: true, createdAt: true, positionId: true, position: { select: { title: true } } },
    }),
  ]);

  // Step 228: Average AI score across all completed sessions for this admin
  const avgScoreResult = await prisma.aiInterviewSession.aggregate({
    where: { position: { organizationId: orgId }, status: "COMPLETED", overallScore: { not: null } },
    _avg: { overallScore: true },
  });
  const avgScore = avgScoreResult._avg.overallScore != null
    ? Math.round(avgScoreResult._avg.overallScore)
    : null;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'}. Here&apos;s your hiring pipeline.
          </p>
        </div>
        <Link href="/org-admin/positions/new">
          <Button className="shrink-0 rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform">
            + Post New Position
          </Button>
        </Link>
      </div>

      {/* KPI Stats Grid — Hiring Pipeline */}
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          Hiring Pipeline
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="bg-teal-600 border-none text-white shadow-lg shadow-teal-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-teal-100">Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mt-1">{openPositions}</div>
            </CardContent>
          </Card>

          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uploaded Resumes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{uploadedResumes}</div>
            </CardContent>
          </Card>

          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shortlisted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{shortlisted}</div>
            </CardContent>
          </Card>

          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invites Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{invitesSent}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step 228 — AI Interview KPIs */}
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          AI Interview Analytics
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 border-none text-white shadow-lg shadow-violet-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-violet-100">AI Interviews Done</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mt-1">{aiCompleted}</div>
              <p className="text-xs text-violet-200 mt-1">completed sessions</p>
            </CardContent>
          </Card>

          <Card className="border-violet-100 dark:border-violet-900/40 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg AI Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-5xl font-black mt-1 ${avgScore == null ? "text-gray-300 dark:text-zinc-600" : avgScore >= 70 ? "text-teal-600 dark:text-teal-400" : avgScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                {avgScore != null ? avgScore : "—"}
              </div>
              {avgScore != null && <p className="text-xs text-gray-400 mt-1">out of 100</p>}
            </CardContent>
          </Card>

          <Card className={`shadow-sm transition-shadow hover:shadow-md ${needsReview > 0 ? "border-amber-200 dark:border-amber-800/40" : "border-gray-100 dark:border-zinc-800"}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${needsReview > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                Needs Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-5xl font-black mt-1 ${needsReview > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
                {needsReview}
              </div>
              <p className="text-xs text-gray-400 mt-1">unreviewed candidates</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{aiPending}</div>
              <p className="text-xs text-gray-400 mt-1">in progress</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity + Pipeline Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-2">
        {/* Recent Activity */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[360px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {recentBatchRuns.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                  No activity yet. Start by posting an open position.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                {recentBatchRuns.map((run, i) => (
                  <li key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                        {run.actionType.replace(/_/g, " ")}
                        <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">
                          {run.position?.title}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                        {new Date(run.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      run.status === "COMPLETED"
                        ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                        : run.status === "PARTIAL_SUCCESS"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {run.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Status */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[360px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Hiring Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-5">
            {[
              { stage: "Uploaded", count: uploadedResumes, max: uploadedResumes || 1, color: "bg-gray-300 dark:bg-zinc-600" },
              { stage: "Shortlisted", count: shortlisted, max: uploadedResumes || 1, color: "bg-teal-300 dark:bg-teal-700" },
              { stage: "Invited", count: invitesSent, max: uploadedResumes || 1, color: "bg-teal-500" },
              { stage: "Interviewed", count: aiCompleted, max: uploadedResumes || 1, color: "bg-violet-500" },
            ].map((row) => (
              <div key={row.stage} className="flex items-center gap-4">
                <span className="w-24 text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0">
                  {row.stage}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                    style={{ width: `${Math.round((row.count / row.max) * 100)}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm font-black text-gray-900 dark:text-white">
                  {row.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
