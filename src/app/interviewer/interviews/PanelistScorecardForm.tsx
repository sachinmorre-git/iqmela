"use client";

import { useState, useTransition } from "react";
import { submitPanelistScorecardAction } from "./scorecard-actions";

type Rec = "STRONG_HIRE" | "HIRE" | "NO_HIRE" | "STRONG_NO_HIRE";

const DIMENSIONS = [
  {
    key: "technicalScore" as const,
    label: "Technical",
    sublabel: "Depth & accuracy of knowledge",
    icon: "⚙️",
    color: "from-blue-500 to-indigo-600",
    trackColor: "bg-blue-500",
  },
  {
    key: "communicationScore" as const,
    label: "Communication",
    sublabel: "Clarity, listening & articulation",
    icon: "💬",
    color: "from-teal-500 to-emerald-600",
    trackColor: "bg-teal-500",
  },
  {
    key: "problemSolvingScore" as const,
    label: "Problem Solving",
    sublabel: "Reasoning, creativity & approach",
    icon: "🧩",
    color: "from-violet-500 to-purple-600",
    trackColor: "bg-violet-500",
  },
  {
    key: "cultureFitScore" as const,
    label: "Culture Fit",
    sublabel: "Team dynamics & values alignment",
    icon: "🤝",
    color: "from-amber-500 to-orange-600",
    trackColor: "bg-amber-500",
  },
] as const;

const RECOMMENDATIONS: { id: Rec; label: string; emoji: string; color: string; bg: string; border: string }[] = [
  {
    id: "STRONG_HIRE",
    label: "Strong Hire",
    emoji: "🚀",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    border: "border-emerald-400 dark:border-emerald-600",
  },
  {
    id: "HIRE",
    label: "Hire",
    emoji: "✅",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/30",
    border: "border-teal-400 dark:border-teal-600",
  },
  {
    id: "NO_HIRE",
    label: "No Hire",
    emoji: "⚠️",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-400 dark:border-amber-600",
  },
  {
    id: "STRONG_NO_HIRE",
    label: "Strong No Hire",
    emoji: "🚫",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-400 dark:border-red-600",
  },
];

export function PanelistScorecardForm({
  interviewId,
  candidateName,
  positionTitle,
  stageLabel,
  resumeId,
  positionId,
  stageIndex,
  onClose,
  onSubmitted,
}: {
  interviewId: string;
  candidateName: string;
  positionTitle?: string;
  stageLabel?: string;
  resumeId?: string;
  positionId?: string;
  stageIndex?: number;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);

  const [scores, setScores] = useState({
    technicalScore: 5,
    communicationScore: 5,
    problemSolvingScore: 5,
    cultureFitScore: 5,
  });
  const [recommendation, setRecommendation] = useState<Rec | "">("");
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");

  // Composite score: weighted average ×10
  const composite = Math.round(
    (scores.technicalScore * 0.35 +
      scores.communicationScore * 0.2 +
      scores.problemSolvingScore * 0.3 +
      scores.cultureFitScore * 0.15) *
      10
  );

  const compositeColor =
    composite >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : composite >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-500 dark:text-red-400";

  const handleSubmit = () => {
    if (!recommendation) { setError("Please select a recommendation."); return; }
    if (!summary.trim()) { setError("Please provide a summary."); return; }
    if ((recommendation === "NO_HIRE" || recommendation === "STRONG_NO_HIRE") && !concerns.trim()) {
      setError("Please document your concerns for a No Hire decision."); return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitPanelistScorecardAction({
        interviewId, resumeId, positionId, stageIndex,
        ...scores,
        recommendation,
        summary: summary.trim(),
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        privateNotes: privateNotes.trim() || undefined,
      });
      if (res.success) {
        setSubmitted(true);
        onSubmitted?.();
      } else {
        setError(res.error || "Submission failed. Please try again.");
      }
    });
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-md p-10 text-center border border-gray-100 dark:border-zinc-800 animate-in zoom-in-90 duration-300">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/20">
            ✓
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Scorecard Locked</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
            Your evaluation has been securely recorded. The hiring team will be notified.
          </p>
          <div className="flex items-center justify-center gap-2 text-3xl font-black mb-1">
            <span className={compositeColor}>{composite}</span>
            <span className="text-gray-300 dark:text-zinc-600 text-lg">/100</span>
          </div>
          <p className="text-xs text-gray-400 mb-8">Composite Score</p>
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm hover:opacity-90 transition-opacity">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto border-t sm:border border-gray-100 dark:border-zinc-800 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-0.5">
              {stageLabel || "Interview Evaluation"}
            </p>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">{candidateName}</h2>
            {positionTitle && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{positionTitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Live composite score */}
            <div className="text-right">
              <div className={`text-2xl font-black tabular-nums transition-all duration-300 ${compositeColor}`}>{composite}</div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wider">/ 100</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-8">

          {/* ── Dimension Sliders ── */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Evaluation Dimensions</h3>
            {DIMENSIONS.map((dim) => {
              const val = scores[dim.key];
              const pct = (val / 10) * 100;
              return (
                <div key={dim.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{dim.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{dim.label}</p>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500">{dim.sublabel}</p>
                      </div>
                    </div>
                    <span className={`text-lg font-black tabular-nums bg-gradient-to-r ${dim.color} bg-clip-text text-transparent`}>
                      {val}<span className="text-xs text-gray-300 dark:text-zinc-600">/10</span>
                    </span>
                  </div>
                  {/* Custom track */}
                  <div className="relative h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${dim.color} transition-all duration-150`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <input
                    type="range" min={1} max={10} step={1} value={val}
                    onChange={(e) => setScores((s) => ({ ...s, [dim.key]: Number(e.target.value) }))}
                    className="w-full h-1 opacity-0 cursor-pointer absolute"
                    style={{ marginTop: -24 }}
                  />
                  {/* Tick labels */}
                  <div className="flex justify-between text-[8px] text-gray-300 dark:text-zinc-700 px-0.5">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} type="button" onClick={() => setScores((s) => ({ ...s, [dim.key]: n }))}
                        className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${
                          n === val
                            ? `bg-gradient-to-br ${dim.color} text-white shadow-sm scale-110`
                            : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 dark:text-zinc-600"
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Recommendation ── */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Final Verdict</h3>
            <div className="grid grid-cols-2 gap-2">
              {RECOMMENDATIONS.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setRecommendation(rec.id)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                    recommendation === rec.id
                      ? `${rec.bg} ${rec.border} ${rec.color} scale-[1.02] shadow-sm`
                      : "border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-500 hover:border-gray-200 dark:hover:border-zinc-700"
                  }`}
                >
                  <span className="text-xl">{rec.emoji}</span>
                  <span className="text-xs font-extrabold uppercase tracking-wide">{rec.label}</span>
                  {recommendation === rec.id && (
                    <span className="ml-auto">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Text fields ── */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Written Evaluation</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Summary <span className="text-red-400">*</span></label>
              <textarea
                value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                placeholder="Overall impression — what stood out most in this interview?"
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow resize-none dark:text-white placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✦ Strengths</label>
                <textarea
                  value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3}
                  placeholder="Key positive signals..."
                  className="w-full rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow resize-none dark:text-white placeholder:text-emerald-300 dark:placeholder:text-emerald-800"
                />
              </div>
              <div className="space-y-1.5">
                <label className={`text-xs font-bold ${(recommendation === "NO_HIRE" || recommendation === "STRONG_NO_HIRE") ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                  ⚡ Concerns {(recommendation === "NO_HIRE" || recommendation === "STRONG_NO_HIRE") && <span className="text-red-400">*</span>}
                </label>
                <textarea
                  value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={3}
                  placeholder="Red flags or skill gaps..."
                  className="w-full rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-shadow resize-none dark:text-white placeholder:text-amber-300 dark:placeholder:text-amber-800"
                />
              </div>
            </div>

            {/* Private Notes toggle */}
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPrivateNotes((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Private Notes <span className="text-[9px] font-normal text-gray-400">— only visible to Hiring Manager+</span>
                </span>
                <svg width="12" height="12" style={{ transform: showPrivateNotes ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {showPrivateNotes && (
                <div className="px-4 pb-4">
                  <textarea
                    value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={3}
                    placeholder="Confidential observations for the hiring manager..."
                    className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition-shadow resize-none dark:text-white placeholder:text-gray-400"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* ── Submit ── */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !recommendation || !summary.trim()}
            className="w-full h-14 rounded-2xl text-sm font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Locking scorecard…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Lock in Scorecard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
