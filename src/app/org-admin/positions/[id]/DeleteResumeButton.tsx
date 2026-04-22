"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { softDeleteResumeAction } from "./actions";

/**
 * Delete (soft) button for a resume/candidate row.
 * Shows a confirmation dialog before deleting.
 */
export function DeleteResumeButton({
  resumeId,
  candidateName,
}: {
  resumeId: string;
  candidateName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await softDeleteResumeAction(resumeId);
      if (!res.success) {
        setError(res.error || "Delete failed");
        setShowConfirm(false);
      }
      // On success, page revalidates and the row disappears
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800"
        title="Remove candidate"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>

      {error && (
        <p className="text-[10px] text-red-500 max-w-[150px]">{error}</p>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Remove Candidate
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                  This will remove <strong className="text-gray-700 dark:text-zinc-200">{candidateName}</strong> from this position.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The candidate will be hidden from the table but all AI analysis data, scores, and usage logs are preserved for reporting accuracy.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
