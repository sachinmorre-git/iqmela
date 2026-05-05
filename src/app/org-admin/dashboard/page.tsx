import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getCallerPermissions } from "@/lib/rbac"
import { formatDateTime } from "@/lib/locale-utils"
import { Share2, ArrowRight } from "lucide-react"

export const metadata = {
  title: 'Dashboard | IQMela',
  description: 'Manage your hiring pipeline.',
}

// ── Role-specific label for greeting ─────────────────────────────────────────
function getRoleDashboardTitle(perms: { isOrgAdmin: boolean; isDeptAdmin: boolean; isRecruiter: boolean; isHiringManager: boolean; isInterviewer: boolean; isVendor: boolean }) {
  if (perms.isOrgAdmin) return "Org Admin";
  if (perms.isDeptAdmin) return "Department Admin";
  if (perms.isRecruiter) return "Recruiter";
  if (perms.isHiringManager) return "Hiring Manager";
  if (perms.isInterviewer) return "Interviewer";
  if (perms.isVendor) return "Vendor";
  return "Team Member";
}

export default async function OrgAdminDashboard() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");

  const orgId = perms.orgId;

  const user = await prisma.user.findUnique({
    where: { id: perms.userId },
    select: { name: true },
  });

  const firstName = user?.name?.split(' ')[0] || 'there';
  const roleTitle = getRoleDashboardTitle(perms);

  // ══════════════════════════════════════════════════════════════════════════
  // INTERVIEWER-ONLY DASHBOARD — minimal view with "My Interviews" only
  // ══════════════════════════════════════════════════════════════════════════
  if (perms.isInterviewer && !perms.canManagePositions) {
    const [upcomingInterviews, completedCount, feedbackCount] = await Promise.all([
      prisma.interview.findMany({
        where: { interviewerId: perms.userId, status: "SCHEDULED" },
        include: {
          candidate: { select: { name: true, email: true } },
          position: { select: { title: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      }),
      prisma.interview.count({ where: { interviewerId: perms.userId, status: "COMPLETED" } }),
      prisma.panelistFeedback.count({ where: { interviewerId: perms.userId } }),
    ]);

    return (
      <div className="flex flex-col gap-8 w-full">
        <div className="border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            {roleTitle} Dashboard — here&apos;s your interview schedule.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 border-none text-white shadow-lg shadow-purple-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-purple-100">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mt-1">{upcomingInterviews.length}</div>
              <p className="text-xs text-purple-200 mt-1">scheduled interviews</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{completedCount}</div>
              <p className="text-xs text-gray-400 mt-1">interviews done</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feedbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{feedbackCount}</div>
              <p className="text-xs text-gray-400 mt-1">scorecards submitted</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming interviews list */}
        <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingInterviews.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-zinc-500">No upcoming interviews scheduled.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                {upcomingInterviews.map((iv) => (
                  <li key={iv.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {iv.candidate?.name || iv.candidate?.email || "Candidate"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                        {iv.position?.title} · {iv.scheduledAt ? formatDateTime(new Date(iv.scheduledAt), { showTimezone: false }) : "TBD"}
                      </p>
                    </div>
                    <Link
                      href={`/interview/${iv.id}/live`}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      Join →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VENDOR-ONLY DASHBOARD — dispatched positions & upload stats
  // ══════════════════════════════════════════════════════════════════════════
  if (perms.isVendor && !perms.canManagePositions) {
    const [dispatchedPositions, uploadedResumes] = await Promise.all([
      prisma.positionVendor.findMany({
        where: { vendorOrgId: orgId, status: "ACTIVE" },
        include: { position: { select: { id: true, title: true, department: true, location: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.resume.count({ where: { vendorOrgId: orgId } }),
    ]);

    return (
      <div className="flex flex-col gap-8 w-full">
        <div className="border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            {roleTitle} Dashboard — manage your sourcing assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card className="bg-gradient-to-br from-rose-600 to-pink-600 border-none text-white shadow-lg shadow-rose-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-100">Active Dispatches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mt-1">{dispatchedPositions.length}</div>
              <p className="text-xs text-rose-200 mt-1">positions assigned to you</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resumes Uploaded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-gray-900 dark:text-white mt-1">{uploadedResumes}</div>
              <p className="text-xs text-gray-400 mt-1">total sourced candidates</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Your Dispatched Positions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {dispatchedPositions.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-gray-400 dark:text-zinc-500">No positions dispatched yet. Your client will assign positions to you.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                {dispatchedPositions.map((d) => (
                  <li key={d.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{d.position.title}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                        {d.position.department}{d.position.location ? ` · ${d.position.location}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/org-admin/positions/${d.position.id}`}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      Upload Resumes →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FULL PIPELINE DASHBOARD — OrgAdmin, DeptAdmin, Recruiter, HiringMgr
  // ══════════════════════════════════════════════════════════════════════════

  // ── Department scoping for non-OrgAdmin roles ───────────────────────────────
  const deptFilter = perms.scopedDeptIds
    ? { departmentId: { in: perms.scopedDeptIds } }
    : {};
  const posOrgFilter = { organizationId: orgId, ...deptFilter };

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
    needsDecision,
  ] = await Promise.all([
    prisma.position.count({ where: posOrgFilter }),
    prisma.resume.count({ where: { position: posOrgFilter } }),
    prisma.resume.count({ where: { position: posOrgFilter, isShortlisted: true } }),
    prisma.interviewInvite.count({ where: { position: posOrgFilter, status: "SENT" } }),
    prisma.aiInterviewSession.count({ where: { position: posOrgFilter, status: "COMPLETED" } }),
    prisma.aiInterviewSession.count({ where: { position: posOrgFilter, status: "IN_PROGRESS" } }),
    prisma.aiInterviewSession.count({
      where: {
        position: posOrgFilter,
        status: "COMPLETED",
        recommendation: { in: ["NEEDS_HUMAN_REVIEW", "MAYBE"] },
        reviewedAt: null,
      }
    }),
    prisma.positionBatchRun.findMany({
      where: { position: posOrgFilter },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { actionType: true, status: true, totalProcessed: true, succeeded: true, createdAt: true, positionId: true, position: { select: { title: true } } },
    }),
    // Candidates that are ON_HOLD and need a decision
    prisma.resume.count({
      where: { position: posOrgFilter, pipelineStatus: "ON_HOLD", isDeleted: false },
    }),
  ]);

  // Step 228: Average AI score across completed sessions (scoped)
  const avgScoreResult = await prisma.aiInterviewSession.aggregate({
    where: { position: posOrgFilter, status: "COMPLETED", overallScore: { not: null } },
    _avg: { overallScore: true },
  });
  const avgScore = avgScoreResult._avg.overallScore != null
    ? Math.round(avgScoreResult._avg.overallScore)
    : null;

  // ── Fetch Referral Flags ───────────────────────────────────────────────────
  const platformConfig = await prisma.platformConfig.findUnique({ where: { id: "GLOBAL" } });
  const showB2bReferrals = platformConfig?.referralsEnabled && platformConfig?.b2bReferralsEnabled;
  let b2bReward = { amount: 1000, currency: "USD", rewardType: "CREDITS" };
  if (platformConfig?.referralRewardRules) {
    try {
      const rules = platformConfig.referralRewardRules as any[];
      const rule = rules.find((r) => r.type === "B2B" && r.country === "GLOBAL");
      if (rule) b2bReward = rule;
    } catch (e) {}
  }
  
  const formatReward = (reward: any) => {
    const curr = reward.currency === "USD" ? "$" : reward.currency + " ";
    const type = reward.rewardType === "CREDITS" ? "in AI Credits" : reward.rewardType === "AMAZON_GC" ? "Amazon Gift Card" : "Bonus";
    return `${curr}${reward.amount.toLocaleString()} ${type}`;
  };

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Welcome back, {firstName}. Here&apos;s your {roleTitle.toLowerCase()} pipeline.
          </p>
        </div>
        {perms.canManagePositions && (
          <Link href="/org-admin/positions/new">
            <Button className="shrink-0 rounded-xl shadow-md shadow-rose-600/20 bg-rose-600 hover:bg-rose-700 text-white border-transparent hover:-translate-y-0.5 transition-transform">
              + Post New Position
            </Button>
          </Link>
        )}
      </div>

      {/* KPI Stats Grid — Hiring Pipeline */}
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          Hiring Pipeline
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="bg-rose-600 border-none text-white shadow-lg shadow-rose-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-rose-100">Open Positions</CardTitle>
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
          <Card className="bg-gradient-to-br from-pink-600 to-rose-600 border-none text-white shadow-lg shadow-pink-600/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-pink-100">AI Interviews Done</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mt-1">{aiCompleted}</div>
              <p className="text-xs text-pink-200 mt-1">completed sessions</p>
            </CardContent>
          </Card>

          <Card className="border-pink-100 dark:border-pink-900/40 shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg AI Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-5xl font-black mt-1 ${avgScore == null ? "text-gray-300 dark:text-zinc-600" : avgScore >= 70 ? "text-rose-600 dark:text-rose-400" : avgScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
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

      {/* ── Needs Decision Banner ─────────────────────────────────────────── */}
      {needsDecision > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 p-5 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl">
              ⏸
            </div>
            <div>
              <p className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                {needsDecision} candidate{needsDecision !== 1 ? "s" : ""} on hold — awaiting your decision
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Visit the Reviews page or open the Intelligence Hub to advance, reject, or extend an offer.
              </p>
            </div>
          </div>
          <Link
            href="/org-admin/reviews"
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm shadow-amber-500/20 transition-colors"
          >
            Review Now →
          </Link>
        </div>
      )}

      {/* ── B2B Give & Get Referral Banner ───────────────────────────────── */}
      {showB2bReferrals && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-purple-900/20 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-500/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shrink-0">
              <Share2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Give 1 Month Free. Get {formatReward(b2bReward)}.</h3>
              <p className="text-sm text-indigo-200">
                Partner with us. Refer another company to IQMela and get {formatReward(b2bReward)} when they upgrade.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
            <input 
              readOnly 
              value={`https://iqmela.com/r/org-${orgId.substring(0, 8)}`} 
              className="flex-1 md:w-64 bg-zinc-950/50 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-sm text-indigo-300 font-mono focus:outline-none"
            />
            <Button className="shrink-0 rounded-xl shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-500 text-white border-transparent flex items-center gap-2">
              Copy Link <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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
                        {formatDateTime(new Date(run.createdAt), { showTimezone: false })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      run.status === "COMPLETED"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
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
              { stage: "Shortlisted", count: shortlisted, max: uploadedResumes || 1, color: "bg-rose-300 dark:bg-rose-700" },
              { stage: "Invited", count: invitesSent, max: uploadedResumes || 1, color: "bg-rose-500" },
              { stage: "Interviewed", count: aiCompleted, max: uploadedResumes || 1, color: "bg-pink-500" },
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
