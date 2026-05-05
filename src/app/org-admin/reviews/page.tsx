import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCallerPermissions } from "@/lib/rbac"
import Link from "next/link"
import { formatDate } from "@/lib/locale-utils"

export const metadata = {
  title: "Candidate Reviews | IQMela",
}

const REC_CONFIG: Record<string, { label: string; emoji: string; cls: string }> = {
  STRONG_HIRE:    { label: "Strong Hire",    emoji: "🚀", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40" },
  HIRE:           { label: "Hire",           emoji: "✅", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40" },
  NO_HIRE:        { label: "No Hire",        emoji: "⚠️", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40" },
  STRONG_NO_HIRE: { label: "Strong No Hire", emoji: "🚫", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40" },
}

export default async function ReviewsDashboard() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canViewReviews) redirect("/org-admin/dashboard")

  const orgFilter = perms.scopedDeptIds
    ? { position: { departmentId: { in: perms.scopedDeptIds } } }
    : {}

  // ── AI sessions needing human review ───────────────────────────────────────
  const [pendingAiSessions, otherAiSessions, panelistFeedbacks, needsDecisionCount] = await Promise.all([
    prisma.aiInterviewSession.findMany({
      where: {
        organizationId: perms.orgId,
        status: "COMPLETED",
        recommendation: { in: ["NEEDS_HUMAN_REVIEW", "MAYBE"] },
        reviewedAt: null,
        ...orgFilter,
      },
      include: {
        position: { select: { id: true, title: true } },
        candidate: { select: { name: true, email: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 50,
    }),

    prisma.aiInterviewSession.findMany({
      where: {
        organizationId: perms.orgId,
        status: "COMPLETED",
        NOT: { recommendation: { in: ["NEEDS_HUMAN_REVIEW", "MAYBE"] } },
        ...orgFilter,
      },
      include: {
        position: { select: { id: true, title: true } },
        candidate: { select: { name: true, email: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),

    // ── New: Panelist scorecards ─────────────────────────────────────────────
    prisma.panelistFeedback.findMany({
      where: {
        interview: {
          organizationId: perms.orgId,
          ...(perms.scopedDeptIds
            ? { position: { departmentId: { in: perms.scopedDeptIds } } }
            : {}),
        },
      },
      include: {
        interviewer: { select: { name: true, email: true } },
        interview: {
          select: {
            id: true,
            roundLabel: true,
            stageIndex: true,
            candidate: { select: { name: true, email: true } },
            position: { select: { id: true, title: true } },
            resume: { select: { id: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),

    // ── Needs decision count ─────────────────────────────────────────────────
    prisma.resume.count({
      where: {
        position: perms.scopedDeptIds
          ? { organizationId: perms.orgId, departmentId: { in: perms.scopedDeptIds } }
          : { organizationId: perms.orgId },
        pipelineStatus: "ACTIVE",
        isDeleted: false,
      },
    }),
  ])

  return (
    <div className="flex-1 space-y-10 max-w-5xl mx-auto w-full p-4 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Reviews & Decisions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
            AI interview reports, panelist scorecards, and final hiring decisions in one place.
          </p>
        </div>
        {needsDecisionCount > 0 && (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {needsDecisionCount} active candidates
          </span>
        )}
      </div>

      {/* ── Section 1: AI Needs Human Review ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-base font-extrabold text-gray-900 dark:text-white uppercase tracking-widest text-[11px]">
            AI Screen — Requires Human Review ({pendingAiSessions.length})
          </h2>
        </div>

        {pendingAiSessions.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-sm font-semibold text-gray-400 dark:text-zinc-500">All caught up — no pending AI reviews.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingAiSessions.map((session) => (
              <div key={session.id} className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">{session.position?.title}</p>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{session.candidate?.name || session.candidate?.email || "Candidate"}</h3>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                    ⚡ Needs Review
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                  AI flagged nuances requiring human judgment before the candidate can advance.
                </p>
                <div className="flex gap-2 mt-1">
                  <Link href={`/org-admin/ai-interview/${session.id}/scorecard`}
                    className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold text-center transition-colors shadow-sm shadow-amber-500/20">
                    View AI Report
                  </Link>
                  {session.resumeId && (
                    <Link href={`/org-admin/candidates/${session.resumeId}/intelligence`}
                      className="flex-1 py-2 rounded-xl bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-bold text-center border border-pink-200 dark:border-pink-800/40 transition-colors">
                      ⚡ Intel Hub
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Panelist Scorecards ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <h2 className="text-[11px] font-extrabold text-gray-900 dark:text-white uppercase tracking-widest">
            Panelist Scorecards — Human Interviews ({panelistFeedbacks.length})
          </h2>
        </div>

        {panelistFeedbacks.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-sm font-semibold text-gray-400 dark:text-zinc-500">No panelist scorecards submitted yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {panelistFeedbacks.map((fb) => {
              const recCfg = REC_CONFIG[fb.recommendation] || REC_CONFIG.HIRE;
              const resumeId = fb.interview.resume?.id;
              return (
                <div key={fb.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4">

                  {/* Score dial */}
                  <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-100 dark:border-pink-800/30 flex flex-col items-center justify-center">
                    <span className={`text-lg font-black ${fb.overallScore >= 80 ? "text-emerald-600" : fb.overallScore >= 60 ? "text-amber-600" : "text-red-500"}`}>
                      {fb.overallScore}
                    </span>
                    <span className="text-[8px] text-gray-400 dark:text-zinc-500">/100</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {fb.interview.candidate?.name || fb.interview.candidate?.email || "Candidate"}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${recCfg.cls}`}>
                        {recCfg.emoji} {recCfg.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wide">
                      {fb.interview.position?.title} · {fb.interview.roundLabel || `Round ${(fb.interview.stageIndex ?? 0) + 1}`}
                    </p>
                    {fb.summary && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 italic line-clamp-1">"{fb.summary}"</p>
                    )}

                    {/* Dimension mini bars */}
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      {[
                        { label: "Tech", val: fb.technicalScore, color: "bg-blue-500" },
                        { label: "Comms", val: fb.communicationScore, color: "bg-rose-500" },
                        { label: "PS", val: fb.problemSolvingScore, color: "bg-pink-500" },
                        { label: "Fit", val: fb.cultureFitScore, color: "bg-amber-500" },
                      ].map(d => (
                        <div key={d.label} className="flex items-center gap-1.5">
                          <span className="text-[9px] text-gray-400 w-7">{d.label}</span>
                          <div className="w-16 h-1 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                            <div className={`h-full ${d.color} rounded-full`} style={{ width: `${d.val * 10}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{d.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evaluator + actions */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Evaluated by</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{fb.interviewer?.name || "Interviewer"}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(new Date(fb.submittedAt), { style: "short" })}</p>
                    </div>
                    {resumeId && (
                      <Link href={`/org-admin/candidates/${resumeId}/intelligence`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 text-[10px] font-bold border border-pink-200 dark:border-pink-800/40 hover:bg-pink-100 dark:hover:bg-pink-900/30 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        Intel Hub
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Archived AI Decisions ── */}
      {otherAiSessions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[11px] font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
            Archived AI Decisions ({otherAiSessions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherAiSessions.map((session) => (
              <div key={session.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${session.overallScore != null && session.overallScore >= 70 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-zinc-800"}`}>
                  <span className={`text-base font-black ${session.overallScore != null && session.overallScore >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500"}`}>
                    {session.overallScore ?? "—"}
                  </span>
                  <span className="text-[8px] text-gray-400">/100</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{session.candidate?.name || session.candidate?.email}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wide">{session.position?.title}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Link href={`/org-admin/ai-interview/${session.id}/scorecard`}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors">
                    View Report →
                  </Link>
                  {session.resumeId && (
                    <Link href={`/org-admin/candidates/${session.resumeId}/intelligence`}
                      className="text-[10px] font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 transition-colors">
                      Intel Hub →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
