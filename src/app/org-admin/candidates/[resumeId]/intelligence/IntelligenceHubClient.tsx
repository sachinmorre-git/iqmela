"use client";

import { useState, useMemo } from "react";
import { formatDate } from "@/lib/locale-utils"
import Link from "next/link";
import { RecordingPlayer } from "./RecordingPlayer";
import { TranscriptViewer } from "./TranscriptViewer";
import { BehaviorReportCard } from "./BehaviorReportCard";
import { CandidateFitCard } from "../../../positions/[id]/CandidateFitCard";
import { CandidateDecisionBar } from "@/components/ui/CandidateDecisionBar";
import { AiAuditDrawer } from "@/components/ui/AiAuditDrawer";
import { CompletedRoundView } from "../../../positions/[id]/CompletedRoundView";
// ── Type helpers ───────────────────────────────────────────────────────────────
type ResumeData = any; // full prisma include

const REC_CONFIG = {
  STRONG_HIRE:    { label: "Strong Hire",    emoji: "🚀", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/50" },
  HIRE:           { label: "Hire",           emoji: "✅", bg: "bg-rose-50 dark:bg-rose-900/20",     text: "text-rose-700 dark:text-rose-300",     border: "border-rose-200 dark:border-rose-800/50"    },
  NO_HIRE:        { label: "No Hire",        emoji: "⚠️", bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   border: "border-amber-200 dark:border-amber-800/50"  },
  STRONG_NO_HIRE: { label: "Strong No Hire", emoji: "🚫", bg: "bg-red-50 dark:bg-red-900/20",       text: "text-red-700 dark:text-red-300",       border: "border-red-200 dark:border-red-800/50"      },
} as const;

const STATUS_CONFIG = {
  ACTIVE:        { label: "Active",        color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-900/20",    dot: "bg-rose-500" },
  ON_HOLD:       { label: "On Hold",       color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",  dot: "bg-amber-500" },
  REJECTED:      { label: "Rejected",      color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20",      dot: "bg-red-500" },
  OFFER_PENDING: { label: "Offer Pending", color: "text-pink-600",  bg: "bg-pink-50 dark:bg-pink-900/20",dot: "bg-pink-500" },
  HIRED:         { label: "Hired",         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", dot: "bg-emerald-500 animate-pulse" },
  WITHDRAWN:     { label: "Withdrawn",     color: "text-gray-500",    bg: "bg-gray-50 dark:bg-gray-900/20",    dot: "bg-gray-400" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
import { ScoreDial } from "@/components/ui/ScoreDial";

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
  embeddedMode = false,
}: {
  resume: ResumeData;
  canReject: boolean;
  canOffer: boolean;
  userRoles: string[];
  embeddedMode?: boolean;
}) {
  // ── Auto-expand the latest (highest stageIndex) round on mount ────────
  const latestInterviewId = useMemo(() => {
    const interviews = resume.interviews ?? [];
    if (interviews.length === 0) return null;
    const sorted = [...interviews].sort((a: any, b: any) => (b.stageIndex ?? 0) - (a.stageIndex ?? 0));
    return sorted[0]?.id ?? null;
  }, [resume.interviews]);

  const [activeRound, setActiveRound] = useState<string | null>(latestInterviewId);

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

  const isTerminal = ["REJECTED", "HIRED", "WITHDRAWN"].includes(status);
  const canAdvance = !isTerminal && status !== "OFFER_PENDING";
  const canHold = canAdvance;
  const canHire = canOffer && status === "OFFER_PENDING";

  return (
    <div className={embeddedMode ? "" : "min-h-screen bg-gray-50 dark:bg-zinc-950"}>

      {/* ── Page Layout ── */}
      <div className={embeddedMode ? "space-y-6" : "max-w-5xl mx-auto px-4 py-8 space-y-6"}>

        {/* ── Back nav ── */}
        {!embeddedMode && (
          <div className="flex items-center gap-3">
            <Link href={`/org-admin/positions/${resume.positionId}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back to Pipeline
            </Link>
            <span className="text-gray-200 dark:text-zinc-700">/</span>
            <span className="text-sm text-gray-500 font-semibold truncate max-w-48">{resume.position?.title}</span>
          </div>
        )}

        {/* ── Candidate Identity Header ─────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-rose-500/20 shrink-0">
                {(resume.candidateName || "?")[0].toUpperCase()}
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {resume.candidateName || "Unknown Candidate"}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} border border-gray-100 dark:border-zinc-800`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                    <span className={statusCfg.color}>{statusCfg.label}</span>
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 font-medium">
                  {resume.position?.title || "Position"}
                  {resume.experienceYears != null && <span className="text-gray-300 dark:text-zinc-600"> · </span>}
                  {resume.experienceYears != null && <span>{resume.experienceYears}+ yrs experience</span>}
                  {resume.location && <span className="text-gray-300 dark:text-zinc-600"> · </span>}
                  {resume.location && <span>{resume.location}</span>}
                </p>

                {/* Quick links */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {resume.candidateEmail && (
                    <a href={`mailto:${resume.candidateEmail}`} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors uppercase tracking-wider">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      Email
                    </a>
                  )}
                  {resume.linkedinUrl && (
                    <a href={resume.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400 transition-colors uppercase tracking-wider">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>
                      LinkedIn
                    </a>
                  )}
                  {resume.phoneNumber && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {resume.phoneNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Score Dials & AI Audit */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="flex flex-col items-center gap-2">
                  {resume.jdMatchScore != null && (
                    <ScoreDial score={resume.aiOverrideScore ?? resume.jdMatchScore} size={72} label={resume.aiOverrideScore ? "Human Match" : "JD Match"} />
                  )}
                  {resume.jdMatchScore != null && (
                    <AiAuditDrawer 
                      resumeId={resume.id}
                      jdMatchScore={resume.jdMatchScore}
                      jdMatchLabel={resume.jdMatchLabel}
                      rankingExplanation={resume.rankingExplanation}
                      aiRecommendationRationale={resume.aiRecommendationRationale}
                      aiRedFlagsJson={resume.aiRedFlagsJson}
                      matchedSkillsJson={resume.matchedSkillsJson}
                      missingSkillsJson={resume.missingSkillsJson}
                      aiOverrideScore={resume.aiOverrideScore}
                      aiOverrideReason={resume.aiOverrideReason}
                    />
                  )}
                </div>
                {avgOverall != null && (
                  <ScoreDial score={avgOverall} size={72} label="Avg Score" />
                )}
              </div>
            </div>

            {/* Stage Progress Bar */}
            {totalStages > 1 && (
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Pipeline Progress</span>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">
                    Stage {Math.min(resume.pipelineStageIdx + 1, totalStages)} of {totalStages}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: totalStages }).map((_, i) => {
                    const isCompleted = i < resume.pipelineStageIdx;
                    const isCurrent = i === resume.pipelineStageIdx;
                    return (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                          isCompleted ? "bg-rose-500" :
                          isCurrent ? "bg-rose-400 animate-pulse" :
                          "bg-gray-100 dark:bg-zinc-800"
                        }`}
                      />
                    );
                  })}
                </div>
                {/* Stage labels */}
                <div className="flex gap-1.5 mt-1.5">
                  {stages.map((stage: any, i: number) => (
                    <div key={i} className="flex-1 text-center">
                      <span className={`text-[8px] font-bold uppercase tracking-wider ${
                        i <= resume.pipelineStageIdx ? "text-rose-500 dark:text-rose-400" : "text-gray-300 dark:text-zinc-700"
                      }`}>
                        {stage.label || stage.roundType?.replace(/_/g, " ") || `Stage ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Time-in-pipeline */}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Applied {formatDate(new Date(resume.createdAt))}
              </span>
              <span className="text-[10px] text-gray-300 dark:text-zinc-700">·</span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                {Math.max(0, Math.floor((Date.now() - new Date(resume.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} days in pipeline
              </span>
              {resume.candidateSource && (
                <>
                  <span className="text-[10px] text-gray-300 dark:text-zinc-700">·</span>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    Source: {resume.candidateSource.replace(/_/g, " ")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Advanced AI Fit Card ─────────────────────────────────────── */}
        {(resume.matchScore !== null || resume.aiInterviewFocusJson || resume.aiRedFlagsJson) && (
          <details className="group bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/60 shadow-sm rounded-3xl overflow-hidden">
            <summary className="cursor-pointer bg-gradient-to-r from-rose-50/50 to-rose-50/50 dark:from-rose-900/10 dark:to-rose-900/10 border-b border-transparent group-open:border-rose-100 dark:group-open:border-rose-900/20 px-6 py-4 select-none hover:bg-rose-50/80 transition-colors list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
               <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                 Deep AI Analysis Profile
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-zinc-500 group-open:hidden">Expand</span>
                 <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
               </div>
            </summary>
            <div className="border-t border-rose-100 dark:border-rose-900/20">
              <CandidateFitCard resume={resume} />
            </div>
          </details>
        )}

        {/* ── AI Screen Report ── */}
        {latestAiSession && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-pink-50/60 to-transparent dark:from-pink-900/10">
              <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-base">🤖</div>
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
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed border-l-2 border-pink-200 dark:border-pink-800 pl-3 italic">
                  {latestAiSession.summary}
                </p>
              )}
              <div className="pt-2">
                <CompletedRoundView
                  interviewId={latestAiSession.id}
                  resumeId={resume.id}
                  positionId={resume.positionId}
                  candidateName={resume.candidateName}
                  stageIndex={0}
                  roundLabel="AI Interview"
                  totalStages={totalStages}
                  hideDecisionActions={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Cross-Round Score Trend ── */}
        {resume.interviews?.length > 1 && (() => {
          const roundScores = (resume.interviews as any[])
            .filter((iv: any) => iv.panelistFeedbacks?.length > 0)
            .map((iv: any) => {
              const fbs = iv.panelistFeedbacks as any[];
              const avg = Math.round(fbs.reduce((s: number, f: any) => s + f.overallScore, 0) / fbs.length);
              return { label: iv.roundLabel || `R${(iv.stageIndex ?? 0) + 1}`, score: avg };
            });

          if (roundScores.length < 2) return null;

          const maxScore = Math.max(...roundScores.map(r => r.score), 100);
          const chartW = 300;
          const chartH = 120;
          const padX = 40;
          const padY = 20;
          const usableW = chartW - padX * 2;
          const usableH = chartH - padY * 2;

          const points = roundScores.map((r, i) => ({
            x: padX + (i / (roundScores.length - 1)) * usableW,
            y: padY + usableH - (r.score / maxScore) * usableH,
            ...r,
          }));

          const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

          return (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">Score Trend Across Rounds</h2>
              </div>
              <div className="flex items-center justify-center">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full max-w-xs">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map(v => {
                    const y = padY + usableH - (v / maxScore) * usableH;
                    return (
                      <g key={v}>
                        <line x1={padX} y1={y} x2={chartW - padX} y2={y} strokeWidth="0.5" className="stroke-gray-100 dark:stroke-zinc-800" />
                        <text x={padX - 6} y={y + 3} textAnchor="end" className="fill-gray-300 dark:fill-zinc-600 text-[7px]">{v}</text>
                      </g>
                    );
                  })}
                  {/* Gradient area */}
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${pathD} L ${points[points.length - 1].x} ${padY + usableH} L ${points[0].x} ${padY + usableH} Z`}
                    fill="url(#trendGrad)"
                  />
                  {/* Line */}
                  <path d={pathD} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-rose-500" />
                  {/* Points */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" className="fill-white dark:fill-zinc-900 stroke-rose-500" strokeWidth="2" />
                      <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-gray-500 dark:fill-zinc-400 text-[7px] font-bold">{p.score}</text>
                      <text x={p.x} y={padY + usableH + 12} textAnchor="middle" className="fill-gray-400 dark:fill-zinc-500 text-[7px] font-semibold">{p.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
              {/* Trend indicator */}
              {roundScores.length >= 2 && (() => {
                const first = roundScores[0].score;
                const last = roundScores[roundScores.length - 1].score;
                const delta = last - first;
                return (
                  <div className={`mt-3 flex items-center justify-center gap-1.5 text-xs font-bold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-gray-400"}`}>
                    {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta)} points {delta > 0 ? "improvement" : delta < 0 ? "decline" : "stable"} across {roundScores.length} rounds
                  </div>
                );
              })()}
            </div>
          );
        })()}

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
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-sm font-black text-rose-600 dark:text-rose-400">
                  R{(interview.stageIndex ?? 0) + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">{interview.roundLabel || interview.title}</h3>
                    {interview.roundType && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
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
                    {formatDate(new Date(interview.scheduledAt))}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {avgScore != null && (
                    <div className={`text-lg font-black ${avgScore >= 80 ? "text-emerald-600" : avgScore >= 60 ? "text-amber-600" : "text-red-500"}`}>
                      {avgScore}<span className="text-xs text-gray-300 dark:text-zinc-600">/100</span>
                    </div>
                  )}
                  <svg width="14" height="14"
                    className={`text-gray-300 dark:text-zinc-700 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
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
                                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs">
                                    {(fb.interviewer?.name || "?")[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-gray-800 dark:text-white">{fb.interviewer?.name || "Interviewer"}</p>
                                    <p className="text-[9px] text-gray-400">{formatDate(new Date(fb.submittedAt))}</p>
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
                                <DimensionBar label="Communication" value={fb.communicationScore} color="bg-rose-500" />
                                <DimensionBar label="Problem Solving" value={fb.problemSolvingScore} color="bg-pink-500" />
                                <DimensionBar label="Culture Fit" value={fb.cultureFitScore} color="bg-amber-500" />
                              </div>

                              {fb.summary && (
                                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed border-l-2 border-rose-200 dark:border-rose-800 pl-2.5 italic">
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

        {/* ── Decision Action Bar ── */}
        <CandidateDecisionBar
          resume={resume}
          canAdvance={canAdvance}
          canHold={canHold}
          canReject={canReject}
          canOffer={canOffer}
          canHire={canHire}
          status={status}
          totalStages={totalStages}
        />

        {/* ── Decision History Timeline ─────────────────────────────── */}
        {resume.hiringDecisions?.length > 0 && (
          <details className="group bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <summary className="cursor-pointer px-6 py-4 select-none hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">Decision History</span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {resume.hiringDecisions.length}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </summary>
            <div className="px-6 pb-6 pt-2">
              <div className="relative pl-5 border-l-2 border-gray-100 dark:border-zinc-800 space-y-4">
                {resume.hiringDecisions.map((d: any, i: number) => {
                  const actionCfg: Record<string, { emoji: string; color: string }> = {
                    ADVANCE: { emoji: "▶", color: "text-rose-600 dark:text-rose-400" },
                    HOLD:    { emoji: "⏸", color: "text-amber-600 dark:text-amber-400" },
                    REJECT:  { emoji: "✕", color: "text-red-600 dark:text-red-400" },
                    OFFER:   { emoji: "📬", color: "text-pink-600 dark:text-pink-400" },
                    HIRE:    { emoji: "🎉", color: "text-emerald-600 dark:text-emerald-400" },
                  };
                  const cfg = actionCfg[d.action] ?? { emoji: "•", color: "text-gray-500" };
                  return (
                    <div key={d.id || i} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                        i === 0 ? "bg-rose-500" : "bg-gray-300 dark:bg-zinc-600"
                      }`} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-extrabold ${cfg.color}`}>
                              {cfg.emoji} {d.action}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                              by {d.decidedBy?.name || d.decidedBy?.email || "System"}
                            </span>
                          </div>
                          {d.note && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed italic">
                              "{d.note}"
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-300 dark:text-zinc-600 font-mono shrink-0">
                          {formatDate(new Date(d.createdAt))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        )}

      </div>
    </div>
  );
}
