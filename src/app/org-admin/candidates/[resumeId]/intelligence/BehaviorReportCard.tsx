"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime } from "@/lib/locale-utils"
import {
  Microscope, ChevronDown, ChevronUp, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, ShieldCheck, TrendingUp, Brain, Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BehaviorReport {
  id:              string;
  integrityScore:  number | null;
  confidenceScore: number | null;
  composureScore:  number | null;
  engagementScore: number | null;
  answerQualityAvg: number | null;
  perAnswerScores:  { question: string; score: number; rationale: string }[] | null;
  resumeFlags:      { claim: string; verdict: "CONSISTENT" | "INCONSISTENT" | "UNVERIFIED"; evidence: string }[] | null;
  behaviorFlags:    { type: string; timestamp: string; severity: "LOW" | "MEDIUM" | "HIGH"; description: string }[] | null;
  topStrengths:    string[] | null;
  generatedAt:     string;
}

type LoadState = "idle" | "loading" | "pending" | "loaded" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// Score tile colour helpers
// ─────────────────────────────────────────────────────────────────────────────
function scoreColor(score: number | null) {
  if (score === null) return { text: "text-zinc-400", bg: "bg-zinc-800", bar: "bg-zinc-600" };
  if (score >= 80)   return { text: "text-emerald-400", bg: "bg-emerald-900/30", bar: "bg-emerald-500" };
  if (score >= 60)   return { text: "text-amber-400",   bg: "bg-amber-900/30",   bar: "bg-amber-500"   };
  return               { text: "text-red-400",     bg: "bg-red-900/30",     bar: "bg-red-500"     };
}

function scoreLabel(score: number | null) {
  if (score === null) return "—";
  if (score >= 80)    return "High";
  if (score >= 60)    return "Good";
  if (score >= 40)    return "Fair";
  return                     "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// BehaviorReportCard
// ─────────────────────────────────────────────────────────────────────────────
export function BehaviorReportCard({
  interviewId,
  roundLabel,
  hasBehaviorReport,
}: {
  interviewId:      string;
  roundLabel:       string;
  hasBehaviorReport: boolean;
}) {
  const [loadState, setLoadState] = useState<LoadState>(hasBehaviorReport ? "idle" : "idle");
  const [report, setReport]       = useState<BehaviorReport | null>(null);
  const [expanded, setExpanded]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/behavior-report/${interviewId}`);
      if (res.status === 202) {
        setLoadState("pending");
        return;
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setReport(data.report);
      setLoadState("loaded");
      setExpanded(true);
      stopPolling();
    } catch (e: any) {
      setError(e.message ?? "Failed to load report");
      setLoadState("error");
      stopPolling();
    }
  };

  const load = async () => {
    setLoadState("loading");
    setError(null);
    await fetchReport();
  };

  // Auto-poll every 60s while pending
  useEffect(() => {
    if (loadState === "pending") {
      pollRef.current = setInterval(fetchReport, 60_000);
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [loadState]);

  // ── Idle / Trigger ───────────────────────────────────────────────────────
  if (loadState === "idle") {
    return (
      <div className="mt-4 border border-dashed border-zinc-700 rounded-2xl p-4 flex items-center justify-between bg-zinc-900/20">
        <div className="flex items-center gap-3">
          <Microscope className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-white">AI Behavioral Report</p>
            <p className="text-xs text-zinc-500">{hasBehaviorReport ? "Report available" : "Generated 3–5 min after session"}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20"
        >
          Load Report
        </button>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadState === "loading") {
    return (
      <div className="mt-4 border border-zinc-800 rounded-2xl p-6 flex items-center justify-center gap-3 bg-zinc-900/20">
        <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
        <span className="text-sm text-zinc-400">Loading report…</span>
      </div>
    );
  }

  // ── Pending (still generating) ───────────────────────────────────────────
  if (loadState === "pending") {
    return (
      <div className="mt-4 border border-rose-500/20 rounded-2xl p-4 bg-rose-950/20">
        <div className="flex items-center gap-3 mb-2">
          <Loader2 className="w-4 h-4 text-rose-400 animate-spin shrink-0" />
          <p className="text-sm font-bold text-rose-300">Generating AI Analysis…</p>
        </div>
        <p className="text-xs text-rose-400/70 pl-7">This typically takes 3–5 minutes after the session ends. Checking automatically every 60s.</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (loadState === "error") {
    return (
      <div className="mt-4 border border-red-500/20 rounded-2xl p-4 bg-red-950/10 flex items-center justify-between">
        <p className="text-xs text-red-400 font-medium">{error}</p>
        <button onClick={load} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────────────────
  if (!report) return null;

  const scores = [
    { key: "integrityScore",   label: "Integrity",   icon: ShieldCheck,   value: report.integrityScore  },
    { key: "confidenceScore",  label: "Confidence",  icon: TrendingUp,    value: report.confidenceScore },
    { key: "composureScore",   label: "Composure",   icon: Brain,         value: report.composureScore  },
    { key: "engagementScore",  label: "Engagement",   icon: Zap,           value: report.engagementScore },
  ];

  return (
    <div className="mt-4 border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30 animate-in fade-in duration-500">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Microscope className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-bold text-white">AI Behavioral Report</span>
          <span className="text-[10px] text-zinc-500 font-medium">
            {formatTime(new Date(report.generatedAt), { showTimezone: false })}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">

          {/* ── Score Tiles ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2">
            {scores.map(({ key, label, icon: Icon, value }) => {
              const c = scoreColor(value);
              return (
                <div key={key} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border border-zinc-800 ${c.bg}`}>
                  <Icon className={`w-4 h-4 ${c.text}`} />
                  <span className={`text-lg font-black ${c.text}`}>{value ?? "—"}</span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">{label}</span>
                  <span className={`text-[9px] font-semibold ${c.text}`}>{scoreLabel(value)}</span>
                </div>
              );
            })}
          </div>

          {/* ── Answer Quality ───────────────────────────────────────────── */}
          {report.perAnswerScores && report.perAnswerScores.length > 0 && (
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mb-2">Answer Quality</h4>
              <div className="space-y-2">
                {report.perAnswerScores.map((a, i) => {
                  const c = scoreColor(a.score);
                  return (
                    <div key={i} className="bg-black/30 rounded-xl p-3 border border-zinc-800/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-zinc-300 font-medium leading-snug flex-1 pr-2 line-clamp-1">{a.question}</p>
                        <span className={`text-xs font-black shrink-0 ${c.text}`}>{a.score}</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${c.bar}`} style={{ width: `${a.score}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Resume Consistency ───────────────────────────────────────── */}
          {report.resumeFlags && report.resumeFlags.length > 0 && (
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mb-2">Resume Consistency</h4>
              <div className="space-y-2">
                {report.resumeFlags.map((f, i) => (
                  <div key={i} className="flex gap-2.5 bg-black/30 rounded-xl p-3 border border-zinc-800/60">
                    {f.verdict === "CONSISTENT"
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${f.verdict === "INCONSISTENT" ? "text-red-400" : "text-amber-400"}`} />
                    }
                    <div>
                      <p className="text-xs font-bold text-zinc-300">{f.claim}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{f.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Behavioral Flags ─────────────────────────────────────────── */}
          {report.behaviorFlags && report.behaviorFlags.length > 0 && (
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mb-2">Behavioral Signals</h4>
              <div className="space-y-1.5">
                {report.behaviorFlags.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs ${
                    f.severity === "HIGH"
                      ? "border-red-500/20 bg-red-900/10 text-red-300"
                      : f.severity === "MEDIUM"
                      ? "border-amber-500/20 bg-amber-900/10 text-amber-300"
                      : "border-zinc-700/40 bg-zinc-900/30 text-zinc-400"
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><span className="font-bold">{f.timestamp}</span> — {f.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top Strengths ────────────────────────────────────────────── */}
          {report.topStrengths && report.topStrengths.length > 0 && (
            <div>
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 mb-2">Top Strengths</h4>
              <div className="flex flex-wrap gap-2">
                {report.topStrengths.map((s, i) => (
                  <span key={i} className="px-2.5 py-1 bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer disclaimer ─────────────────────────────────────────── */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-950/20 rounded-xl border border-amber-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-500/70 leading-relaxed">
              AI behavioral estimate — for interviewer reference only. Not an automated hiring decision.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
