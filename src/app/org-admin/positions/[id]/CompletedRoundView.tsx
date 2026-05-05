"use client";

import { useState, useEffect, useTransition } from "react";
import {
  CheckCircle, ChevronDown, ChevronUp, AlertTriangle,
  Shield, Brain, Smile, Activity, Play, Sparkles, Clock,
  ThumbsUp, ThumbsDown, Pause, ArrowRight, Loader2, MessageSquare,
} from "lucide-react";
import { fetchRoundIntelligenceAction, type RoundIntelligence } from "./round-intelligence-action";
import { makeHiringDecisionAction } from "@/app/org-admin/candidates/decision-actions";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompletedRoundViewProps {
  interviewId: string;
  resumeId: string;
  positionId: string;
  candidateName: string;
  stageIndex: number;
  roundLabel: string | null;
  totalStages: number;
  onAdvanceComplete?: (nextStageIndex: number) => void;
  onDecisionComplete?: () => void;
}

const REC_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  STRONG_HIRE:    { bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", label: "Strong Hire" },
  HIRE:           { bg: "bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400", label: "Hire" },
  NO_HIRE:        { bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", label: "No Hire" },
  STRONG_NO_HIRE: { bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", label: "Strong No Hire" },
  MAYBE:          { bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", label: "Maybe" },
  NEEDS_HUMAN_REVIEW: { bg: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", label: "Needs Review" },
};

// ── Component ────────────────────────────────────────────────────────────────

export function CompletedRoundView({
  interviewId,
  resumeId,
  positionId,
  candidateName,
  stageIndex,
  roundLabel,
  totalStages,
  onAdvanceComplete,
  onDecisionComplete,
}: CompletedRoundViewProps) {
  const [data, setData] = useState<RoundIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPanelist, setExpandedPanelist] = useState<number>(0); // First auto-expanded
  const [behaviorExpanded, setBehaviorExpanded] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // ── Fetch intelligence on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRoundIntelligenceAction(interviewId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [interviewId]);

  // ── Decision timer ─────────────────────────────────────────────────────
  const [elapsedText, setElapsedText] = useState("");
  const [timerColor, setTimerColor] = useState("text-emerald-500");

  useEffect(() => {
    if (!data?.interview.completedAt) return;

    function update() {
      const completed = new Date(data!.interview.completedAt!).getTime();
      const now = Date.now();
      const diffMs = now - completed;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;

      if (days > 0) {
        setElapsedText(`${days}d ${remainingHours}h since interview`);
      } else {
        setElapsedText(`${hours}h since interview`);
      }

      if (hours < 24) setTimerColor("text-emerald-500");
      else if (hours < 72) setTimerColor("text-amber-500");
      else setTimerColor("text-red-500");
    }

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [data?.interview.completedAt]);

  // ── Decision Handlers ──────────────────────────────────────────────────
  const handleDecision = (action: "ADVANCE" | "REJECT" | "HOLD") => {
    setDecisionError(null);
    startTransition(async () => {
      const res = await makeHiringDecisionAction({
        resumeId,
        positionId,
        action,
        note: decisionNote || undefined,
        totalStages,
      });

      if (res.success) {
        if (action === "ADVANCE" && onAdvanceComplete) {
          setDecisionSuccess("Advanced! Loading next round...");
          setTimeout(() => onAdvanceComplete(stageIndex + 1), 800);
        } else {
          const msgs: Record<string, string> = {
            ADVANCE: "✅ Candidate Advanced",
            REJECT: "❌ Candidate Rejected",
            HOLD: "⏸ Candidate On Hold",
          };
          setDecisionSuccess(msgs[action] ?? "Decision Saved");
          onDecisionComplete?.();
        }
      } else {
        setDecisionError(res.error ?? "Decision failed");
      }
    });
  };

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Score ring skeleton */}
        <div className="flex items-center justify-center py-6">
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-zinc-800" />
        </div>
        {/* Consensus skeleton */}
        <div className="h-8 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
        {/* Panelist card skeletons */}
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
        ))}
        {/* Brief skeleton */}
        <div className="h-20 bg-gray-100 dark:bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
          Failed to load round data
        </p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchRoundIntelligenceAction(interviewId).then((res) => {
              if (res.success) setData(res.data);
              else setError(res.error);
              setLoading(false);
            });
          }}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Decision success state
  if (decisionSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{decisionSuccess}</p>
      </div>
    );
  }

  const { compositeScore, consensusSummary, panelistScores, behaviorReport, recording, aiBrief, aiSession, aiConfidence, keyInsights, skillRadar } = data;
  const scoreColor = (compositeScore ?? 0) >= 80 ? "emerald" : (compositeScore ?? 0) >= 60 ? "amber" : "red";
  const isLastStage = stageIndex >= totalStages - 1;

  // Consensus label
  const positiveCount = consensusSummary.strongHire + consensusSummary.hire;
  const negativeCount = consensusSummary.noHire + consensusSummary.strongNoHire;
  const consensusLabel =
    consensusSummary.total === 0 ? null :
    negativeCount === 0 ? "Unanimous Positive" :
    positiveCount === 0 ? "Unanimous Negative" :
    "Split Opinion";

  return (
    <div className="space-y-4">
      {/* ═══ Section 1: Score Summary Ring ═══ */}
      <div className="flex flex-col items-center py-4">
        <div className="relative w-24 h-24">
          {/* Background ring */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
              className="stroke-gray-100 dark:stroke-zinc-800" />
            {compositeScore != null && (
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                strokeDasharray={`${compositeScore * 2.64} 264`}
                strokeLinecap="round"
                className={`stroke-${scoreColor}-500 transition-all duration-1000 ease-out`}
                style={{
                  strokeDashoffset: 0,
                  stroke: scoreColor === "emerald" ? "#10b981" : scoreColor === "amber" ? "#f59e0b" : "#ef4444",
                }}
              />
            )}
          </svg>
          {/* Center number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black text-${scoreColor}-600 dark:text-${scoreColor}-400`}
              style={{ color: scoreColor === "emerald" ? "#059669" : scoreColor === "amber" ? "#d97706" : "#dc2626" }}>
              {compositeScore ?? "—"}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-zinc-500 font-semibold">/100</span>
          </div>
        </div>
        <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 mt-2 uppercase tracking-wider">
          Composite Score
        </p>
      </div>

      {/* ═══ Section 2: Consensus Bar ═══ */}
      {consensusSummary.total > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-3">
          {/* Segmented bar */}
          <div className="flex h-3 rounded-full overflow-hidden mb-2.5">
            {consensusSummary.strongHire > 0 && (
              <div className="bg-emerald-500" style={{ width: `${(consensusSummary.strongHire / consensusSummary.total) * 100}%` }} />
            )}
            {consensusSummary.hire > 0 && (
              <div className="bg-rose-400" style={{ width: `${(consensusSummary.hire / consensusSummary.total) * 100}%` }} />
            )}
            {consensusSummary.noHire > 0 && (
              <div className="bg-amber-400" style={{ width: `${(consensusSummary.noHire / consensusSummary.total) * 100}%` }} />
            )}
            {consensusSummary.strongNoHire > 0 && (
              <div className="bg-red-500" style={{ width: `${(consensusSummary.strongNoHire / consensusSummary.total) * 100}%` }} />
            )}
          </div>
          {/* Counts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              {consensusSummary.strongHire > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Strong Hire: {consensusSummary.strongHire}
                </span>
              )}
              {consensusSummary.hire > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Hire: {consensusSummary.hire}
                </span>
              )}
              {consensusSummary.noHire > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  No Hire: {consensusSummary.noHire}
                </span>
              )}
              {consensusSummary.strongNoHire > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Strong No: {consensusSummary.strongNoHire}
                </span>
              )}
            </div>
            {consensusLabel && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                consensusLabel === "Unanimous Positive" ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                consensusLabel === "Unanimous Negative" ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" :
                "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
              }`}>
                {consensusLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══ Section 2b: AI Hiring Confidence Gauge ═══ */}
      {aiConfidence && (
        <div className="bg-gradient-to-br from-rose-50/50 to-pink-50/50 dark:from-rose-900/10 dark:to-pink-900/10 rounded-xl border border-rose-200/60 dark:border-rose-800/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">AI Hiring Confidence</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Arc gauge */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className="stroke-gray-100 dark:stroke-zinc-800" />
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6"
                  strokeDasharray={`${aiConfidence.confidence * 2.51} 251`}
                  strokeLinecap="round"
                  style={{
                    stroke: aiConfidence.confidence >= 75 ? "#10b981" : aiConfidence.confidence >= 50 ? "#f59e0b" : "#ef4444",
                    transition: "stroke-dasharray 1.5s ease-out",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-black ${aiConfidence.confidence >= 75 ? "text-emerald-600" : aiConfidence.confidence >= 50 ? "text-amber-600" : "text-red-500"}`}>
                  {aiConfidence.confidence}%
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed italic">
                &ldquo;{aiConfidence.justification}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Section 2c: AI vs Panelist Score Comparison ═══ */}
      {aiSession && aiSession.overallScore != null && panelistScores.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-3">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">AI vs Panelist Comparison</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <p className="text-[9px] font-bold text-pink-500 uppercase mb-0.5">AI Score</p>
              <span className={`text-lg font-black ${(aiSession.overallScore ?? 0) >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                {aiSession.overallScore}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              {(() => {
                const delta = (compositeScore ?? 0) - (aiSession.overallScore ?? 0);
                return (
                  <>
                    <span className={`text-[10px] font-black ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {delta >= 0 ? "+" : ""}{delta}
                    </span>
                    <span className="text-[8px] text-gray-400 uppercase">delta</span>
                  </>
                );
              })()}
            </div>
            <div className="flex-1 text-center">
              <p className="text-[9px] font-bold text-blue-500 uppercase mb-0.5">Panel Avg</p>
              <span className={`text-lg font-black ${(compositeScore ?? 0) >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                {compositeScore}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Section 2d: Skill Dimension Radar Chart ═══ */}
      {skillRadar && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Brain className="w-3 h-3" /> Skill Radar
          </p>
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-44 h-44">
              {/* Grid lines */}
              {[20, 40, 60, 80, 100].map((r) => (
                <polygon key={r} fill="none" strokeWidth="0.5"
                  className="stroke-gray-200 dark:stroke-zinc-700"
                  points={[0, 1, 2, 3].map((i) => {
                    const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                    return `${100 + r * 0.8 * Math.cos(angle)},${100 + r * 0.8 * Math.sin(angle)}`;
                  }).join(" ")}
                />
              ))}
              {/* Axes */}
              {[0, 1, 2, 3].map((i) => {
                const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                return (
                  <line key={i} x1="100" y1="100"
                    x2={100 + 80 * Math.cos(angle)} y2={100 + 80 * Math.sin(angle)}
                    strokeWidth="0.5" className="stroke-gray-200 dark:stroke-zinc-700"
                  />
                );
              })}
              {/* Data polygon */}
              <polygon fill="rgba(244,63,94,0.15)" strokeWidth="2"
                className="stroke-rose-500"
                points={[
                  { v: skillRadar.technical, i: 0 },
                  { v: skillRadar.communication, i: 1 },
                  { v: skillRadar.problemSolving, i: 2 },
                  { v: skillRadar.cultureFit, i: 3 },
                ].map(({ v, i }) => {
                  const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                  const r = (v / 100) * 80;
                  return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                }).join(" ")}
              />
              {/* Data points */}
              {[
                { v: skillRadar.technical, i: 0 },
                { v: skillRadar.communication, i: 1 },
                { v: skillRadar.problemSolving, i: 2 },
                { v: skillRadar.cultureFit, i: 3 },
              ].map(({ v, i }) => {
                const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                const r = (v / 100) * 80;
                return <circle key={i} cx={100 + r * Math.cos(angle)} cy={100 + r * Math.sin(angle)} r="3" className="fill-rose-500" />;
              })}
              {/* Labels */}
              {[
                { label: "Technical", i: 0, dx: 0, dy: -10 },
                { label: "Communication", i: 1, dx: 10, dy: 0 },
                { label: "Problem Solving", i: 2, dx: 0, dy: 12 },
                { label: "Culture Fit", i: 3, dx: -10, dy: 0 },
              ].map(({ label, i, dx, dy }) => {
                const angle = (i * Math.PI * 2) / 4 - Math.PI / 2;
                const lr = 92;
                return (
                  <text key={label}
                    x={100 + lr * Math.cos(angle) + dx}
                    y={100 + lr * Math.sin(angle) + dy}
                    textAnchor="middle"
                    className="fill-gray-400 dark:fill-zinc-500 text-[8px] font-bold"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* ═══ Section 2e: Key AI Insights Cards ═══ */}
      {keyInsights && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-pink-500" /> Key AI Insights
          </p>
          <div className="grid gap-1.5">
            {/* Top Strength */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/40">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 text-sm shrink-0 mt-0.5">✦</span>
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Top Strength</p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">{keyInsights.topStrength}</p>
                </div>
              </div>
            </div>
            {/* Biggest Risk */}
            <div className="p-3 rounded-xl bg-red-50/70 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/40">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-sm shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-0.5">Biggest Risk</p>
                  <p className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed font-medium">{keyInsights.biggestRisk}</p>
                </div>
              </div>
            </div>
            {/* Next Round Suggestion */}
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-sm shrink-0 mt-0.5">→</span>
                <div>
                  <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Next Round Focus</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">{keyInsights.nextRoundSuggestion}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Section 3: Panelist Scorecard Cards ═══ */}
      {panelistScores.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <ThumbsUp className="w-3 h-3" />
            Panelist Scorecards ({panelistScores.length})
          </p>
          {panelistScores.map((ps, i) => {
            const isExpanded = expandedPanelist === i;
            const rec = REC_COLORS[ps.recommendation] || REC_COLORS.HIRE;
            const initials = ps.interviewerName.slice(0, 2).toUpperCase();

            return (
              <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden transition-all duration-300">
                {/* Collapsed header */}
                <button
                  type="button"
                  onClick={() => setExpandedPanelist(isExpanded ? -1 : i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{ps.interviewerName}</p>
                    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${rec.bg} ${rec.text}`}>
                      {rec.label}
                    </span>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${
                    ps.overallScore >= 80 ? "text-emerald-600" : ps.overallScore >= 60 ? "text-amber-600" : "text-red-500"
                  }`}>
                    {ps.overallScore}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-50 dark:border-zinc-800 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* 4 dimension bars */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { label: "Technical", val: ps.technicalScore, color: "bg-blue-500" },
                        { label: "Communication", val: ps.communicationScore, color: "bg-rose-500" },
                        { label: "Problem Solving", val: ps.problemSolvingScore, color: "bg-pink-500" },
                        { label: "Culture Fit", val: ps.cultureFitScore, color: "bg-amber-500" },
                      ].map((d) => (
                        <div key={d.label} className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-400 w-16 shrink-0 truncate">{d.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                            <div className={`h-full ${d.color} rounded-full transition-all duration-500`} style={{ width: `${d.val * 10}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-gray-600 dark:text-zinc-300 w-4 text-right">{d.val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <p className="text-[11px] text-gray-600 dark:text-zinc-400 italic leading-relaxed line-clamp-3">
                      &ldquo;{ps.summary}&rdquo;
                    </p>

                    {/* Strengths & Concerns */}
                    {ps.strengths && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 text-[10px] mt-0.5">✓</span>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">{ps.strengths}</p>
                      </div>
                    )}
                    {ps.concerns && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-red-500 text-[10px] mt-0.5">⚠</span>
                        <p className="text-[10px] text-red-600 dark:text-red-400">{ps.concerns}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Section 3b: AI Session (for AI_SCREEN rounds) ═══ */}
      {aiSession && panelistScores.length === 0 && (
        <div className="bg-pink-50/50 dark:bg-pink-900/10 rounded-xl border border-pink-200 dark:border-pink-800/40 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-pink-500" />
            <p className="text-xs font-bold text-pink-800 dark:text-pink-300">AI Interview Results</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
              (aiSession.overallScore ?? 0) >= 70 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-zinc-800"
            }`}>
              <span className={`text-lg font-black ${(aiSession.overallScore ?? 0) >= 70 ? "text-emerald-600" : "text-gray-600"}`}>
                {aiSession.overallScore ?? "—"}
              </span>
              <span className="text-[7px] text-gray-400">/100</span>
            </div>
            <div className="flex-1 min-w-0">
              {aiSession.recommendation && (
                <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  (REC_COLORS[aiSession.recommendation] || REC_COLORS.MAYBE).bg
                } ${(REC_COLORS[aiSession.recommendation] || REC_COLORS.MAYBE).text}`}>
                  {(REC_COLORS[aiSession.recommendation] || REC_COLORS.MAYBE).label}
                </span>
              )}
              <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                {aiSession.questionCount} questions answered
              </p>
            </div>
          </div>
          {aiSession.executiveSummary && (
            <p className="text-[11px] text-pink-700 dark:text-pink-400 italic leading-relaxed border-l-2 border-pink-300 dark:border-pink-700 pl-2">
              &ldquo;{aiSession.executiveSummary}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* ═══ Section 4: AI Behavior Report ═══ */}
      {behaviorReport && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setBehaviorExpanded(!behaviorExpanded)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-pink-500" />
              <span className="text-[10px] font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                AI Behavior Analysis
              </span>
              {behaviorReport.behaviorFlags.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
                  {behaviorReport.behaviorFlags.length} flag{behaviorReport.behaviorFlags.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {behaviorExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>

          {behaviorExpanded && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-50 dark:border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* 4 mini indicators */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Integrity", val: behaviorReport.integrityScore, icon: Shield, color: "text-pink-500" },
                  { label: "Confidence", val: behaviorReport.confidenceScore, icon: Brain, color: "text-blue-500" },
                  { label: "Composure", val: behaviorReport.composureScore, icon: Smile, color: "text-rose-500" },
                  { label: "Engagement", val: behaviorReport.engagementScore, icon: Activity, color: "text-amber-500" },
                ].map((d) => (
                  <div key={d.label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                    <d.icon className={`w-3.5 h-3.5 ${d.color}`} />
                    <span className={`text-sm font-black ${
                      (d.val ?? 0) >= 80 ? "text-emerald-600" : (d.val ?? 0) >= 60 ? "text-amber-600" : "text-red-500"
                    }`}>
                      {d.val ?? "—"}
                    </span>
                    <span className="text-[7px] text-gray-400 font-bold uppercase tracking-wider">{d.label}</span>
                  </div>
                ))}
              </div>

              {/* Behavior flags */}
              {behaviorReport.behaviorFlags.length > 0 && (
                <div className="space-y-1">
                  {behaviorReport.behaviorFlags.map((flag, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className={`shrink-0 px-1 py-0.5 rounded font-bold uppercase ${
                        flag.severity === "HIGH" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        flag.severity === "MEDIUM" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {flag.severity}
                      </span>
                      <span className="text-gray-600 dark:text-zinc-400">{flag.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* View full report link */}
              <Link
                href={`/org-admin/candidates/${resumeId}/intelligence`}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 transition-colors"
              >
                View Full Report →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ═══ Section 5: Recording Player ═══ */}
      <div className="rounded-xl overflow-hidden bg-zinc-950 border border-gray-200 dark:border-zinc-800">
        {recording.hasRecording && recording.presignedUrl ? (
          <div className="relative">
            <video
              controls
              preload="metadata"
              className="w-full max-h-48 bg-black"
              src={recording.presignedUrl}
            />
            {recording.durationSecs != null && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[10px] font-bold backdrop-blur-sm">
                {Math.floor(recording.durationSecs / 60)}:{String(recording.durationSecs % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 gap-2">
            <Play className="w-4 h-4 text-zinc-600" />
            <p className="text-xs text-zinc-500 font-semibold">No recording available</p>
          </div>
        )}
      </div>

      {/* ═══ Section 6: AI Decision Brief ═══ */}
      {aiBrief && (
        <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-pink-500 via-rose-500 to-rose-500">
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-[11px] p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">
                AI Decision Brief
              </span>
            </div>
            <p className="text-[12px] text-gray-700 dark:text-zinc-300 leading-relaxed font-medium">
              {aiBrief}
            </p>
          </div>
        </div>
      )}

      {/* ═══ Section 7: Decision Action Bar ═══ */}
      <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 rounded-xl p-3 space-y-3 shadow-lg shadow-gray-200/50 dark:shadow-none">
        {/* Decision timer */}
        {elapsedText && (
          <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${timerColor}`}>
            <Clock className="w-3 h-3" />
            <span>⏱ {elapsedText}</span>
          </div>
        )}

        {/* Decision error */}
        {decisionError && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
            {decisionError}
          </div>
        )}

        {/* Optional note */}
        {showNoteInput ? (
          <textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            rows={2}
            placeholder="Add a note about your decision..."
            className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition resize-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNoteInput(true)}
            className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Add decision note
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDecision("HOLD")}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
            Hold
          </button>

          <button
            type="button"
            onClick={() => handleDecision("REJECT")}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            Reject
          </button>

          <button
            type="button"
            onClick={() => handleDecision("ADVANCE")}
            disabled={isPending}
            className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            {isLastStage ? "✓ Offer" : "Advance →"}
          </button>
        </div>
      </div>
    </div>
  );
}
