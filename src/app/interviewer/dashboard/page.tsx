import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TodayTimeline } from "./TodayTimeline";
import { StatsRings } from "./StatsRings";
import { FeedbackQueue } from "./FeedbackQueue";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { StreakBadge } from "./StreakBadge";
import { maskName } from "@/lib/pii-redact";
import { formatDate, formatTime } from "@/lib/locale-utils"
import { BadgeCheck, ArrowRight, Link as LinkIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Interviewer Dashboard — IQMela",
  description: "Your daily interview schedule, feedback queue, and performance at a glance.",
};

export default async function InterviewerDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const now   = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd    = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const heatmapStart = new Date(now); heatmapStart.setDate(heatmapStart.getDate() - 83); // 12 weeks

  // Today's interviews — as lead OR panelist
  const todayInterviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: todayStart, lte: todayEnd },
      OR: [
        { interviewerId: userId },
        { panelists: { some: { interviewerId: userId } } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      candidate: { select: { name: true } },
      position:  { select: { title: true } },
      panelists: { include: { interviewer: { select: { name: true } } } },
    },
  });

  // Upcoming (next 7 days, excluding today)
  const upcomingInterviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gt: todayEnd, lte: weekEnd },
      OR: [
        { interviewerId: userId },
        { panelists: { some: { interviewerId: userId } } },
      ],
      status: "SCHEDULED",
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
    include: {
      candidate: { select: { name: true } },
      position:  { select: { title: true } },
    },
  });

  // Interviews needing feedback (completed, this interviewer hasn't submitted PanelistFeedback)
  const completedInterviews = await prisma.interview.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { interviewerId: userId },
        { panelists: { some: { interviewerId: userId } } },
      ],
      NOT: { panelistFeedbacks: { some: { interviewerId: userId } } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 10,
    include: {
      candidate: { select: { name: true } },
      position:  { select: { title: true, id: true } },
    },
  });

  // Stats: total conducted, avg score, on-time feedback rate
  const totalConducted = await prisma.panelistFeedback.count({
    where: { interviewerId: userId },
  });

  const avgScoreResult = await prisma.panelistFeedback.aggregate({
    where: { interviewerId: userId },
    _avg: { overallScore: true },
  });

  // On-time rate: feedbacks submitted within 48h of interview
  const allFeedbacks = await prisma.panelistFeedback.findMany({
    where: { interviewerId: userId },
    select: { submittedAt: true, interviewId: true },
  });
  const interviewTimes = await prisma.interview.findMany({
    where: { id: { in: allFeedbacks.map((f) => f.interviewId) } },
    select: { id: true, scheduledAt: true },
  });
  const timeMap = Object.fromEntries(interviewTimes.map((i) => [i.id, i.scheduledAt]));
  const onTimeCount = allFeedbacks.filter((f) => {
    const iv = timeMap[f.interviewId];
    if (!iv) return false;
    return f.submittedAt.getTime() - iv.getTime() <= 48 * 60 * 60 * 1000;
  }).length;
  const onTimeRate = allFeedbacks.length > 0
    ? Math.round((onTimeCount / allFeedbacks.length) * 100)
    : 100;

  // Streak: consecutive on-time feedbacks from most recent
  const sortedFeedbacks = [...allFeedbacks].sort(
    (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
  );
  let streak = 0;
  for (const f of sortedFeedbacks) {
    const iv = timeMap[f.interviewId];
    if (!iv) break;
    if (f.submittedAt.getTime() - iv.getTime() <= 48 * 60 * 60 * 1000) streak++;
    else break;
  }

  // Heatmap data (last 12 weeks)
  const heatmapInterviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: heatmapStart },
      OR: [
        { interviewerId: userId },
        { panelists: { some: { interviewerId: userId } } },
      ],
    },
    select: { scheduledAt: true },
  });

  const heatmapCounts: Record<string, number> = {};
  heatmapInterviews.forEach(({ scheduledAt }) => {
    const key = scheduledAt.toISOString().split("T")[0];
    heatmapCounts[key] = (heatmapCounts[key] ?? 0) + 1;
  });

  // ── Fetch Referral Flags ───────────────────────────────────────────────────
  const platformConfig = await prisma.platformConfig.findUnique({ where: { id: "GLOBAL" } });
  const showInterviewerReferrals = platformConfig?.referralsEnabled && platformConfig?.interviewerReferralsEnabled;
  let interviewerReward = { amount: 100, currency: "USD", rewardType: "CASH" };
  if (platformConfig?.referralRewardRules) {
    try {
      const rules = platformConfig.referralRewardRules as any[];
      const rule = rules.find((r) => r.type === "INTERVIEWER" && r.country === "GLOBAL");
      if (rule) interviewerReward = rule;
    } catch (e) {}
  }

  const formatReward = (reward: any) => {
    const curr = reward.currency === "USD" ? "$" : reward.currency + " ";
    return `${curr}${reward.amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[700px] h-[400px] bg-rose-700/10 blur-3xl rounded-full" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-pink-700/8 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-sm font-medium">Good day,</p>
            <h1 className="text-2xl font-black tracking-tight text-white">{user?.name ?? "Interviewer"}</h1>
          </div>
          <StreakBadge streak={streak} />
        </div>

        {/* Top row: Stats + Today Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <TodayTimeline
              interviews={todayInterviews.map((iv) => ({
                id:             iv.id,
                scheduledAt:    iv.scheduledAt.toISOString(),
                durationMinutes: iv.durationMinutes,
                status:         iv.status,
                candidateName:  maskName(iv.candidate?.name ?? iv.candidateName),
                positionTitle:  iv.position?.title ?? iv.title,
              }))}
              upcomingCount={upcomingInterviews.length}
            />
          </div>
          <StatsRings
            totalConducted={totalConducted}
            avgScore={Math.round((avgScoreResult._avg.overallScore ?? 0) * 10) / 10}
            onTimeRate={onTimeRate}
          />
        </div>

        {/* Feedback Queue */}
        {completedInterviews.length > 0 && (
          <FeedbackQueue
            interviews={completedInterviews.map((iv) => ({
              id:            iv.id,
              candidateName: maskName(iv.candidate?.name ?? iv.candidateName),
              positionTitle: iv.position?.title ?? iv.title,
              positionId:    iv.position?.id ?? "",
              scheduledAt:   iv.scheduledAt.toISOString(),
            }))}
          />
        )}

        {/* Upcoming Interviews (next 7 days) */}
        {upcomingInterviews.length > 0 && (
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">
              Upcoming This Week
            </h2>
            <div className="space-y-2">
              {upcomingInterviews.map((iv) => {
                const d = new Date(iv.scheduledAt);
                return (
                  <div key={iv.id}
                    className="flex items-center justify-between px-5 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {iv.candidate?.name ?? iv.candidateName ?? "Candidate"}
                        <span className="text-zinc-500 font-normal"> · {iv.position?.title ?? iv.title}</span>
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {formatDate(d)}
                        {" at "}
                        {formatTime(d, { showTimezone: false })}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                      Scheduled
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Invite an Expert Referral Module ─────────────────────────────── */}
        {showInterviewerReferrals && (
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-900/40 to-blue-900/20 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-sky-500/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shrink-0">
                <BadgeCheck className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Grow the Elite Peer Network. Earn {formatReward(interviewerReward)}.</h3>
                <p className="text-sm text-sky-200">
                  Great engineers know great engineers. Invite a peer expert to interview on IQMela, and both of you get a {formatReward(interviewerReward)} bonus when they complete 5 paid interviews.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <input 
                readOnly 
                value={`https://iqmela.com/expert/apply?ref=${userId}`} 
                className="flex-1 md:w-64 bg-zinc-950/50 border border-sky-500/30 rounded-xl px-4 py-2.5 text-sm text-sky-300 font-mono focus:outline-none"
              />
              <button className="shrink-0 rounded-xl shadow-lg shadow-sky-600/20 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Copy Link
              </button>
            </div>
          </div>
        )}

        {/* Activity Heatmap */}
        <ActivityHeatmap countsByDate={heatmapCounts} startDate={heatmapStart.toISOString()} />
      </div>
    </div>
  );
}
