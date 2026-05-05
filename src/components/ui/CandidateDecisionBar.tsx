"use client";

import { useState, useTransition } from "react";
import { makeHiringDecisionAction } from "@/app/org-admin/candidates/decision-actions";
import { toast } from "sonner";

export function CandidateDecisionBar({
  resume,
  canAdvance,
  canHold,
  canReject,
  canOffer,
  canHire,
  status,
  totalStages,
}: {
  resume: any;
  canAdvance: boolean;
  canHold: boolean;
  canReject: boolean;
  canOffer: boolean;
  canHire: boolean;
  status: string;
  totalStages: number;
}) {
  const [decisionNote, setDecisionNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDecision(action: string) {
    // In a real app, you might want to show a confirmation dialog for REJECT/OFFER
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
      if (res.success) {
        toast.success(
          action === "ADVANCE" ? "Candidate advanced to next stage ✓" :
          action === "REJECT"  ? "Candidate marked as rejected" :
          action === "HOLD"    ? "Candidate placed on hold" :
          action === "OFFER"   ? "Offer extended! 🎉" :
          action === "HIRE"    ? "Candidate officially Hired! 🎊" :
          "Decision recorded");
        setDecisionNote("");
      } else {
        toast.error(res.error || "Decision failed");
      }
    });
  }

  const isTerminal = ["REJECTED", "HIRED", "WITHDRAWN"].includes(status);

  return (
    <div className="w-full space-y-4">
      {/* ── Decision Panel ── */}
      {!isTerminal && (
        <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-gray-100 dark:border-zinc-800/60 rounded-3xl p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-sm font-extrabold text-gray-900 dark:text-white mb-2 uppercase tracking-wider">Record Decision</h2>
              <textarea
                value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Add a decision note (optional)…"
                rows={1}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-6">
              {canAdvance && (
                <button
                  onClick={() => handleDecision("ADVANCE")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-emerald-600 text-white text-xs font-extrabold shadow-sm shadow-rose-500/20 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  ▶ Advance
                </button>
              )}
              {canHold && (
                <button
                  onClick={() => handleDecision("HOLD")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-extrabold hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  ⏸ Hold
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => handleDecision("REJECT")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 text-xs font-extrabold hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              )}
              {canOffer && status === "ACTIVE" && (
                <button
                  onClick={() => handleDecision("OFFER")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-extrabold shadow-sm shadow-pink-500/20 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  📬 Offer
                </button>
              )}
              {canHire && status === "OFFER_PENDING" && (
                <button
                  onClick={() => handleDecision("HIRE")}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-extrabold shadow-sm shadow-emerald-500/20 hover:shadow-md hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  🎉 Hire Candidate
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
    </div>
  );
}
