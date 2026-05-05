"use client";

import { useEffect, useState } from "react";

/**
 * AiDegradedBanner — Shows a persistent warning banner when AI is running
 * in mock/degraded mode. Fetched once per session via a lightweight health check.
 *
 * This prevents recruiters from unknowingly making decisions based on
 * mock/dummy AI scores and rankings.
 */
export function AiDegradedBanner() {
  const [status, setStatus] = useState<{
    degraded: boolean;
    message: string;
    provider: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check once per session
    const key = "ai-degraded-checked";
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
      const cached = sessionStorage.getItem("ai-degraded-status");
      if (cached) {
        try {
          setStatus(JSON.parse(cached));
        } catch { /* ignore */ }
      }
      return;
    }

    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((data) => {
        const result = {
          degraded: data.degraded ?? false,
          message: data.message ?? "",
          provider: data.provider ?? "unknown",
        };
        setStatus(result);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(key, "1");
          sessionStorage.setItem("ai-degraded-status", JSON.stringify(result));
        }
      })
      .catch(() => {
        // Can't check status — don't show banner
      });
  }, []);

  if (!status?.degraded || dismissed) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 flex items-center justify-center px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/40"
         style={{ animation: "fadeSlideIn 300ms ease-out" }}>
      <div className="flex items-center gap-2.5 max-w-screen-xl mx-auto">
        <span className="text-amber-600 dark:text-amber-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </span>
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          AI Degraded Mode — {status.message || "AI results may be simulated. Verify scores manually."}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-4 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer shrink-0"
          title="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
