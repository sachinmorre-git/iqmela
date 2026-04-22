"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { makeHiringDecisionAction } from "../../decision-actions";
import { RecordingPlayer } from "./RecordingPlayer";
import { TranscriptViewer } from "./TranscriptViewer";
import { BehaviorReportCard } from "./BehaviorReportCard";

// ── Type helpers ───────────────────────────────────────────────────────────────
type ResumeData = any; // full prisma include

const REC_CONFIG = {
  STRONG_HIRE:    { label: "Strong Hire",    emoji: "🚀", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/50" },
  HIRE:           { label: "Hire",           emoji: "✅", bg: "bg-teal-50 dark:bg-teal-900/20",     text: "text-teal-700 dark:text-teal-300",     border: "border-teal-200 dark:border-teal-800/50"    },
  NO_HIRE:        { label: "No Hire",        emoji: "⚠️", bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   border: "border-amber-200 dark:border-amber-800/50"  },
  STRONG_NO_HIRE: { label: "Strong No Hire", emoji: "🚫", bg: "bg-red-50 dark:bg-red-900/20",       text: "text-red-700 dark:text-red-300",       border: "border-red-200 dark:border-red-800/50"      },
} as const;

const STATUS_CONFIG = {
  ACTIVE:        { label: "Active",        color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-900/20",    dot: "bg-teal-500" },
  ON_HOLD:       { label: "On Hold",       color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",  dot: "bg-amber-500" },
  REJECTED:      { label: "Rejected",      color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20",      dot: "bg-red-500" },
  OFFER_PENDING: { label: "Offer Pending", color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-900/20",dot: "bg-violet-500" },
  HIRED:         { label: "Hired",         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", dot: "bg-emerald-500 animate-pulse" },
  WITHDRAWN:     { label: "Withdrawn",     color: "text-gray-500",    bg: "bg-gray-50 dark:bg-gray-900/20",    dot: "bg-gray-400" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function ScoreDial({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const pct = score / 100;
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} className="dark:stroke-zinc-800" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px`, fill: color, fontSize: size * 0.22, fontWeight: 800 }}>
          {score}
        </text>
      </svg>
      {label && <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 text-center">{label}</p>}
    </div>
  );
}

function DimensionBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">{label}</span>
        <span className="text-[10px] font-bold text-gray-700 dark:text-zinc-300">{value}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────
export function IntelligenceHubClient({
  resume,
  canReject,
  canOffer,
  userRoles,
}: {
  resume: ResumeData;
  canReject: boolean;
  canOffer: boolean;
  userRoles: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [decisionNote, setDecisionNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeRound, setActiveRound] = useState<number | null>(null);

  const status = resume.pipelineStatus as keyof typeof STATUS_CONFIG;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACTIVE;
  const latestAiSession = resume.aiInterviewSessions?.[0];

  // ── Aggregate all panelist feedbacks across all rounds
  const allFeedbacks = resume.panelistFeedbacks ?? [];
  const avgOverall = allFeedbacks.length > 0
    ? Math.round(allFeedbacks.reduce((s: number, f: any) => s + f.overallScore, 0) / allFeedbacks.length)
    : null;

  const recCounts = allFeedbacks.reduce((acc: Record<string, number>, f: any) => {
    acc[f.recommendation] = (acc[f.recommendation] || 0) + 1;
    return acc;
  }, {});

  const hasConflict = Object.keys(recCounts).length > 1 &&
    (recCounts["STRONG_HIRE"] || recCounts["HIRE"]) &&
    (recCounts["NO_HIRE"] || recCounts["STRONG_NO_HIRE"]);

  const stages = resume.position?.interviewPlan?.stages ?? [];
  const totalStages = stages.length || 3;

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleDecision(action: string) {
    if (action === "REJECT" || action === "OFFER") {
      setConfirmAction(action);
      return;
    }
    executeDecision(action);
  }

  function executeDecision(action: string) {
    startTransition(async () => {
      const res = await makeHiringDecisionAction({
        resumeId: resume.id,
        positionId: resume.positionId,
        action: action as any,
        note: decisionNote || undefined,
        totalStages,
      });
      setConfirmAction(null);
      if (res.success) {
        showToast(
          action === "ADVANCE" ? "Candidate advanced to next stage ✓" :
          action === "REJECT"  ? "Candidate marked as rejected" :
          action === "HOLD"    ? "Candidate placed on hold" :
          action === "OFFER"   ? "Offer extended! 🎉" :
          "Decision recorded");
      } else {
        showToast(res.error || "Decision failed", "error");
      }
    });
  }

  const isTerminal = ["REJECTED", "HIRED", "WITHDRAWN"].includes(status);
  const canAdvance = !isTerminal && status !== "OFFER_PENDING";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-black/10 border flex items-center gap-2 animate-in slide-in-from-top-3 duration-200 ${
          toast.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700"
            : "bg-red-50 dark:bg-red-900/80 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700"
        }`}>
          {toast.type === "success" ? "✓" : "✕"} {toast.message}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-gray-100 dark:border-zinc-800 animate-in zoom-in-90 duration-200">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 ${confirmAction === "REJECT" ? "bg-red-50" : "bg-violet-50"}`}>
              {confirmAction === "REJECT" ? "✕" : "📬"}
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">
              {confirmAction === "REJECT" ? "Reject this candidate?" : "Extend offer?"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              {confirmAction === "REJECT"
                ? "This will mark them as rejected. You can reactivate later if needed."
                : "This will move the candidate to 'Offer Pending' and notify the team."}
            </p>
            <textarea
              value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Add a note (optional)..."
              className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 px-3 py-2 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
              rows={2}
            />
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => executeDecision(confirmAction)}
                disabled={isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  confirmAction === "REJECT" ? "bg-red-600 hover:bg-red-700" : "bg-violet-600 hover:bg-violet-700"
                }`}
              >
                {isPending ? "…" : `Confirm ${confirmAction === "REJECT" ? "Rejection" : "Offer"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Layout ── */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Back nav ── */}
        <div className="flex items-center gap-3">
          <Link href={`/org-admin/positions/${resume.positionId}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Pipeline
          </Link>
          <span className="text-gray-200 dark:text-zinc-700">/</span>
          <span className="text-sm text-gray-500 font-semibold truncate max-w-48">{resume.position?.title}</span>
        </div>

        {/* ── Hero Header ── */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-8 pt-8 pb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/30 backdrop-blur-sm`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                  {hasConflict && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                      ⚡ Panel Conflict
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-black text-white mb-1">
                  {resume.candidateName || resume.overrideName || "Unnamed Candidate"}
                </h1>
                <p className="text-indigo-200 text-sm font-medium">
                  {resume.position?.title} · Stage {resume.pipelineStageIdx + 1} of {totalStages}
                </p>
                {resume.candidateEmail && (
                  <p className="text-indigo-300 text-xs mt-0.5">{resume.candidateEmail}</p>
                )}
              </div>

              {/* Aggregate scores */}
              <div className="flex items-center gap-4 flex-wrap">
                {resume.jdMatchScore != null && (
                  <ScoreDial score={resume.jdMatchScore} size={72} label="AI Match" />
                )}
                {avgOverall != null && (
                  <ScoreDial score={avgOverall} size={72} label="Panel Avg" />
                )}
                {latestAiSession?.overallScore != null && (
                  <ScoreDial score={latestAiSession.overallScore} size={72} label="AI Screen" />
                )}
              </div>
            </div>

            {/* Pipeline progress bar */}
            <div className="mt-6 space-y-2">
              <div className="flex gap-1.5">
                {stages.length > 0 ? stages.map((s: any, i: number) => (
                  <div key={i} className="flex-1 space-y-1">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${
                      i < resume.pipelineStageIdx ? "bg-white" :
                      i === resume.pipelineStageIdx ? "bg-white/60" :
                      "bg-white/20"
                    }`} />
                    <p className="text-[8px] text-white/60 font-semibold uppercase tracking-wider truncate">{s.roundLabel}</p>
                  </div>
                )) : [0,1,2].map((i) => (
                  <div key={i} className="flex-1">
                    <div className={`h-1.5 rounded-full ${i < resume.pipelineStageIdx ? "bg-white" : i === resume.pipelineStageIdx ? "bg-white/60" : "bg-white/20"}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-zinc-800">
            {[
              { label: "AI Match Score", value: resume.jdMatchScore != null ? `${resume.jdMatchScore}%` : "—", sub: resume.jdMatchLabel || "" },
              { label: "Panel Feedbacks", value: String(allFeedbacks.length), sub: allFeedbacks.length === 0 ? "None yet" : "submitted" },
              { label: "Total Interviews", value: String(resume.interviews?.length ?? 0), sub: "rounds completed" },
              { label: "Decision History", value: String(resume.hiringDecisions?.length ?? 0), sub: "actions recorded" },
            ].map((stat) => (
              <div key={stat.label} className="px-5 py-4">
                <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-black text-gray-900 dark:text-white mt-0.5">{stat.value}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI Screen Report ── */}
        {latestAiSession && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-violet-50/60 to-transparent dark:from-violet-900/10">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-base">🤖</div>
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">AI Screen Report</h2>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">Tavus AI Avatar · Round 0</p>
              </div>
              {latestAiSession.overallScore != null && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className={`text-xl font-black ${
                    latestAiSession.overallScore >= 80 ? "text-emerald-600" :
                    latestAiSession.overallScore >= 60 ? "text-amber-600" : "text-red-500"
                  }`}>{latestAiSession.overallScore}</div>
                  <div className="text-xs text-gray-300 dark:text-zinc-600">/100</div>
                </div>
              )}
            </div>
            <div className="p-6 space-y-4">
              {latestAiSession.recommendation && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  (REC_CONFIG[latestAiSession.recommendation as keyof typeof REC_CONFIG] || REC_CONFIG.HIRE).border
                } ${(REC_CONFIG[latestAiSession.recommendation as keyof typeof REC_CONFIG] || REC_CONFIG.HIRE).bg}
                   ${(REC_CONFIG[latestAiSession.recommendation as keyof typeof REC_CONFIG] || REC_CONFIG.HIRE).text}`}>
                  {(REC_CONFIG[latestAiSession.recommendation as keyof typeof REC_CONFIG] || { emoji: "✅" }).emoji}
                  {latestAiSession.recommendation.replace(/_/g, " ")}
                </div>
              )}
              {latestAiSession.summary && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed border-l-2 border-violet-200 dark:border-violet-800 pl-3 italic">
                  {latestAiSession.summary}
                </p>
              )}
              <Link href={`/org-admin/ai-interview/${latestAiSession.id}/scorecard`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors">
                View full AI scorecard
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
            </div>
          </div>
        )}

        {/* ── Round Cards ── */}
        {resume.interviews?.map((interview: any) => {
          const feedbacks: any[] = interview.panelistFeedbacks ?? [];
          const panelists = interview.panelists ?? [];
          const stageFeedbacks = feedbacks;
          const avgScore = stageFeedbacks.length > 0
            ? Math.round(stageFeedbacks.reduce((s: number, f: any) => s + f.overallScore, 0) / stageFeedbacks.length)
            : null;
          const isExpanded = activeRound === interview.id;
          const pendingCount = panelists.length - stageFeedbacks.length;

          return (
            <div key={interview.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveRound(isExpanded ? null : interview.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors border-b border-gray-100 dark:border-zinc-800 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-black text-indigo-600 dark:text-indigo-400">
                  R{(interview.stageIndex ?? 0) + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{interview.roundLabel || interview.title}</h3>
                    {interview.roundType && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        {interview.roundType.replace(/_/g, " ")}
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                        {pendingCount} pending
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                    {stageFeedbacks.length} / {panelists.length || "?"} panelists responded ·{" "}
                    {new Date(interview.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {avgScore != null && (
                    <div className={`text-lg font-black ${avgScore >= 80 ? "text-emerald-600" : avgScore >= 60 ? "text-amber-600" : "text-red-500"}`}>
                      {avgScore}<span className="text-xs text-gray-300 dark:text-zinc-600">/100</span>
                    </div>
                  )}
                  <svg width="14" height="14" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "currentColor" }}
                    className="text-gray-300 dark:text-zinc-700"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {/* Expanded panelist scorecards */}
              {isExpanded && (
                <div className="p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  {stageFeedbacks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-zinc-500">
                      <div className="text-3xl mb-2">🕐</div>
                      <p className="text-sm font-semibold">No scorecards submitted yet</p>
                      <p className="text-xs mt-1">Waiting for {panelists.length || "panelists"} to complete their evaluations</p>
                    </div>
                  ) : (
                    <>
                      {/* Panel consensus banner */}
                      {stageFeedbacks.length > 1 && (
                        <div className={`rounded-2xl p-4 ${hasConflict ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30" : "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30"}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">{hasConflict ? "⚡" : "✓"}</span>
                            <p className={`text-xs font-bold ${hasConflict ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                              {hasConflict ? "Panel conflict — requires your decision" : "Panel consensus achieved"}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(recCounts).map(([rec, count]) => {
                              const cfg = REC_CONFIG[rec as keyof typeof REC_CONFIG];
                              return cfg ? (
                                <span key={rec} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                                  {cfg.emoji} {cfg.label} ×{count as number}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      {/* Individual scorecards */}
                      <div className="space-y-3">
                        {stageFeedbacks.map((fb: any) => {
                          const recCfg = REC_CONFIG[fb.recommendation as keyof typeof REC_CONFIG] || REC_CONFIG.HIRE;
                          return (
                            <div key={fb.id} className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                                    {(fb.interviewer?.name || "?")[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-gray-800 dark:text-white">{fb.interviewer?.name || "Interviewer"}</p>
                                    <p className="text-[9px] text-gray-400">{new Date(fb.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${recCfg.bg} ${recCfg.text} ${recCfg.border}`}>
                                    {recCfg.emoji} {recCfg.label}
                                  </span>
                                  <div className={`text-sm font-black ${fb.overallScore >= 80 ? "text-emerald-600" : fb.overallScore >= 60 ? "text-amber-600" : "text-red-500"}`}>
                                    {fb.overallScore}/100
                                  </div>
                                </div>
                              </div>

                              {/* Dimension bars */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                <DimensionBar label="Technical" value={fb.technicalScore} color="bg-blue-500" />
                                <DimensionBar label="Communication" value={fb.communicationScore} color="bg-teal-500" />
                                <DimensionBar label="Problem Solving" value={fb.problemSolvingScore} color="bg-violet-500" />
                                <DimensionBar label="Culture Fit" value={fb.cultureFitScore} color="bg-amber-500" />
                              </div>

                              {fb.summary && (
                                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed border-l-2 border-indigo-200 dark:border-indigo-800 pl-2.5 italic">
                                  "{fb.summary}"
                                </p>
                              )}

                              <div className="flex gap-3 flex-wrap">
                                {fb.strengths && (
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold text-emerald-600 mb-0.5">Strengths</p>
                                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 leading-relaxed">{fb.strengths}</p>
                                  </div>
                                )}
                                {fb.concerns && (
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold text-red-500 mb-0.5">Concerns</p>
                                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 leading-relaxed">{fb.concerns}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                    )}
                </div>
              )}

              {/* ── Recording Player + Transcript + Behavior Report — role-gated ────────────── */}
              {isExpanded && userRoles.some((r) =>
                ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "INTERVIEWER"].includes(r)
              ) && (
                <div className="px-6 pb-6 space-y-4">
                  <RecordingPlayer
                    interviewId={interview.id}
                    roundLabel={interview.roundLabel || interview.title}
                  />
                  <TranscriptViewer
                    interviewId={interview.id}
                    roundLabel={interview.roundLabel || interview.title}
                    hasRecording={!!interview.recordingUrl}
                  />
                  <BehaviorReportCard
                    interviewId={interview.id}
                    roundLabel={interview.roundLabel || interview.title}
                    hasBehaviorReport={!!(interview as any).behaviorReport}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Decision Panel ── */}
        {!isTerminal && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">Make a Decision</h2>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">This action updates the pipeline and notifies the team</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Decision note */}
              <textarea
                value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Add a decision note (optional)…"
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow dark:text-white"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {canAdvance && (
                  <button
                    onClick={() => handleDecision("ADVANCE")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-extrabold shadow-sm shadow-teal-500/20 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    ▶ Advance
                  </button>
                )}
                <button
                  onClick={() => handleDecision("HOLD")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-extrabold hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  ⏸ Hold
                </button>
                {canReject && (
                  <button
                    onClick={() => handleDecision("REJECT")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 text-xs font-extrabold hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                )}
                {canOffer && status === "ACTIVE" && (
                  <button
                    onClick={() => handleDecision("OFFER")}
                    disabled={isPending}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-extrabold shadow-sm shadow-violet-500/20 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    📬 Offer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Terminal state banner */}
        {isTerminal && (
          <div className={`rounded-3xl p-6 flex items-center gap-4 border ${
            status === "HIRED" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40" :
            status === "REJECTED" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40" :
            "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
          }`}>
            <div className="text-3xl">{status === "HIRED" ? "🎉" : status === "REJECTED" ? "✕" : "↩"}</div>
            <div>
              <p className={`text-sm font-extrabold ${status === "HIRED" ? "text-emerald-700 dark:text-emerald-300" : status === "REJECTED" ? "text-red-700 dark:text-red-300" : "text-gray-600 dark:text-zinc-300"}`}>
                {status === "HIRED" ? "Hired — pipeline complete" : status === "REJECTED" ? "Rejected — pipeline closed" : "Withdrawn"}
              </p>
              {resume.lastDecisionNote && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{resume.lastDecisionNote}</p>}
            </div>
          </div>
        )}

        {/* ── Decision History ── */}
        {resume.hiringDecisions?.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4">Decision History</h3>
            <div className="space-y-2">
              {resume.hiringDecisions.map((d: any) => (
                <div key={d.id} className="flex items-start gap-3 text-xs">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                    d.action === "ADVANCE" ? "bg-teal-500" :
                    d.action === "REJECT" ? "bg-red-500" :
                    d.action === "HOLD" ? "bg-amber-500" :
                    d.action === "OFFER" ? "bg-violet-500" :
                    d.action === "HIRE" ? "bg-emerald-500" :
                    "bg-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-800 dark:text-white">{d.action}</span>
                    {d.note && <span className="text-gray-500 dark:text-zinc-400"> — {d.note}</span>}
                  </div>
                  <div className="text-gray-400 dark:text-zinc-500 shrink-0 text-[9px]">
                    {d.decidedBy?.name || "System"} · {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
