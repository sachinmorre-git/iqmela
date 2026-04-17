"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { createAiInterviewSessionAction } from "./ai-interview-actions";

/**
 * Step 178 — "Assign AI Interview" button shown per-candidate row.
 * Clicking creates an AiInterviewSession and shows the candidate's session link.
 */
export function AiInterviewInviteButton({
  resumeId,
  positionId,
  disabled,
  existingSessionId,
}: {
  resumeId: string;
  positionId: string;
  disabled?: boolean;
  existingSessionId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId ?? null);
  const [error, setError] = useState<string | null>(null);

  if (sessionId) {
    const link = `/ai-interview/${sessionId}`;
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800/30">
          <Bot className="w-3 h-3" /> AI Interview Assigned
        </span>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await createAiInterviewSessionAction(resumeId, positionId);
            if (res.success && res.sessionId) {
              setSessionId(res.sessionId);
            } else {
              setError(res.error ?? "Failed to create AI interview");
            }
          });
        }}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
        {isPending ? "Assigning…" : "Assign AI Interview"}
      </button>
      {error && (
        <p className="text-[10px] text-red-500 flex items-center gap-1 max-w-[180px]">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
