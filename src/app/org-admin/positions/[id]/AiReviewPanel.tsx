// src/app/org-admin/positions/[id]/AiReviewPanel.tsx
"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Loader2, Edit3 } from "lucide-react";
import { reviewAiSessionAction } from "./ai-interview-actions";

const RECOMMENDATIONS = [
  { value: "STRONG_HIRE",       label: "Strong Hire",       color: "text-emerald-600 dark:text-emerald-400" },
  { value: "HIRE",              label: "Hire",              color: "text-blue-600 dark:text-blue-400" },
  { value: "MAYBE",             label: "Maybe",             color: "text-amber-600 dark:text-amber-400" },
  { value: "WEAK_FIT",          label: "Weak Fit",          color: "text-orange-600 dark:text-orange-400" },
  { value: "NEEDS_HUMAN_REVIEW",label: "Needs Human Review",color: "text-yellow-600 dark:text-yellow-400" },
  { value: "NO_HIRE",           label: "No Hire",           color: "text-red-600 dark:text-red-400" },
];

export function AiReviewPanel({
  sessionId,
  positionId,
  aiRecommendation,
  initialNotes,
  initialRecommendation,
  reviewedAt,
}: {
  sessionId: string;
  positionId: string;
  aiRecommendation?: string | null;
  initialNotes?: string | null;
  initialRecommendation?: string | null;
  reviewedAt?: Date | null;
}) {
  const [notes, setNotes]             = useState(initialNotes ?? "");
  const [override, setOverride]       = useState(initialRecommendation ?? aiRecommendation ?? "");
  const [isPending, startTransition]  = useTransition();
  const [saved, setSaved]             = useState(!!reviewedAt);
  const [error, setError]             = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await reviewAiSessionAction(sessionId, positionId, {
        recruiterNotes: notes,
        recruiterRecommendation: override || undefined,
      });
      if (res.success) setSaved(true);
      else setError(res.error ?? "Failed to save review");
    });
  };

  return (
    <div className="space-y-4">
      {/* Override Recommendation */}
      <div>
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
          Override Final Recommendation
        </label>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATIONS.map((rec) => (
            <button
              key={rec.value}
              onClick={() => setOverride(rec.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                override === rec.value
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-violet-400"
              }`}
            >
              {rec.label}
            </button>
          ))}
        </div>
        {aiRecommendation && (
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1.5">
            AI suggested: <strong>{aiRecommendation.replace(/_/g, " ")}</strong>
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
          Recruiter Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Add private notes about this candidate's interview performance…"
          className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Edit3 className="w-4 h-4" />
          )}
          {isPending ? "Saving…" : "Mark as Reviewed"}
        </button>
        {saved && !isPending && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
