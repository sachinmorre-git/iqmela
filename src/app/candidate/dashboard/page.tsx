import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CountdownHero } from "./CountdownHero";
import { RoleBriefCard } from "./RoleBriefCard";
import { RoundTracker } from "./RoundTracker";
import { TechCheck } from "./TechCheck";
import { PrepCoach } from "./PrepCoach";
import { CalendarX2 } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/locale-utils"

export const metadata: Metadata = {
  title: "My Interviews — IQMela",
  description: "Your interview briefing room. Prepare, check your setup, and join with confidence.",
};

export default async function CandidateDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  // Upcoming interviews — soonest first
  const upcoming = await prisma.interview.findMany({
    where: { candidateId: userId, status: "SCHEDULED" },
    orderBy: { scheduledAt: "asc" },
    include: {
      position: { select: { id: true, title: true, description: true, jdText: true } },
      interviewer: { select: { name: true } },
      panelists: { include: { interviewer: { select: { name: true } } } },
    },
  });

  // Completed interviews for round tracker
  const completed = await prisma.interview.findMany({
    where: { candidateId: userId, status: "COMPLETED" },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      stageIndex: true,
      roundLabel: true,
      positionId: true,
      scheduledAt: true,
    },
  });

  // Recent AI sessions
  const aiSessions = await prisma.aiInterviewSession.findMany({
    where: { candidateId: userId },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      status: true,
      overallScore: true,
      magicLinkToken: true,
      position: { select: { title: true } },
      createdAt: true,
    },
  });

  const nextInterview = upcoming[0] ?? null;

  // Collect interviewer/panelist names for next interview
  const interviewerNames: string[] = [];
  if (nextInterview?.interviewer?.name) interviewerNames.push(nextInterview.interviewer.name);
  nextInterview?.panelists?.forEach((p) => {
    if (p.interviewer.name && !interviewerNames.includes(p.interviewer.name))
      interviewerNames.push(p.interviewer.name);
  });

  // Round tracker: completed rounds for the same position
  const completedForPosition = nextInterview?.positionId
    ? completed.filter((c) => c.positionId === nextInterview.positionId)
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-rose-700/15 via-pink-700/8 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-sm font-medium">Welcome back</p>
            <h1 className="text-2xl font-black tracking-tight text-white">{user?.name ?? "Candidate"}</h1>
          </div>
          {nextInterview && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-600">Next up</p>
              <p className="text-sm font-bold text-white truncate max-w-[200px]">
                {nextInterview.position?.title ?? nextInterview.title}
              </p>
            </div>
          )}
        </div>

        {/* Countdown Hero */}
        <CountdownHero
          scheduledAt={nextInterview?.scheduledAt?.toISOString() ?? null}
          interviewId={nextInterview?.id ?? null}
          durationMinutes={nextInterview?.durationMinutes ?? 60}
          positionTitle={nextInterview?.position?.title ?? nextInterview?.title ?? null}
        />

        {nextInterview ? (
          <>
            {/* Role Brief + Prep Coach */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <RoleBriefCard
                positionTitle={nextInterview.position?.title ?? nextInterview.title}
                roundLabel={nextInterview.roundLabel ?? "Interview"}
                interviewerNames={interviewerNames}
                durationMinutes={nextInterview.durationMinutes}
                scheduledAt={nextInterview.scheduledAt.toISOString()}
                completedRounds={completedForPosition.length}
                totalRounds={completedForPosition.length + upcoming.length}
              />
              <PrepCoach
                interviewId={nextInterview.id}
                positionTitle={nextInterview.position?.title ?? nextInterview.title}
                jdSnippet={nextInterview.position?.jdText?.slice(0, 800) ?? nextInterview.position?.description ?? null}
                roundLabel={nextInterview.roundLabel ?? "Interview"}
              />
            </div>

            {/* Round Tracker — only show if multiple rounds */}
            {(completedForPosition.length > 0 || upcoming.length > 1) && (
              <RoundTracker
                completedRounds={completedForPosition.map((r) => ({
                  label: r.roundLabel ?? `Round ${(r.stageIndex ?? 0) + 1}`,
                  stageIndex: r.stageIndex ?? 0,
                }))}
                currentStageIndex={nextInterview.stageIndex ?? 0}
                currentLabel={nextInterview.roundLabel ?? `Round ${(nextInterview.stageIndex ?? 0) + 1}`}
                upcomingRounds={upcoming.slice(1).map((u) => ({
                  label: u.roundLabel ?? `Round ${(u.stageIndex ?? 0) + 1}`,
                  stageIndex: u.stageIndex ?? 0,
                }))}
              />
            )}

            {/* Tech Check */}
            <TechCheck />
          </>
        ) : (
          /* Empty state */
          <div className="border border-dashed border-zinc-800 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <CalendarX2 className="w-7 h-7 text-zinc-600" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">No interviews scheduled</h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
              You&apos;re all clear. When a recruiter schedules your interview, this page becomes your personal mission control.
            </p>
          </div>
        )}

        {/* AI Session History */}
        {aiSessions.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">AI Interview History</h2>
            <div className="space-y-2">
              {aiSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{s.position?.title ?? "AI Interview"}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {formatDate(new Date(s.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.overallScore != null && (
                      <span className={`text-sm font-black ${
                        s.overallScore >= 70 ? "text-emerald-400" : s.overallScore >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>{s.overallScore}%</span>
                    )}
                    {s.status === "IN_PROGRESS" && s.magicLinkToken && (
                      <Link href={`/ai-interview/${s.magicLinkToken}`}
                        className="text-xs font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 transition-colors">
                        Continue →
                      </Link>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                      s.status === "COMPLETED"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
