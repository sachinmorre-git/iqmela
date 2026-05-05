"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { Building2, Loader2, RefreshCw } from "lucide-react";

/**
 * Automatically activates a single Clerk organization in the user's session
 * and then navigates to the dashboard.
 * 
 * Why this exists: When we add a user to an org via the backend API,
 * the client-side Clerk session doesn't know about it yet. We need to
 * reload the session first, then call setActive.
 */
export function AutoActivateOrg({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { setActive, loaded } = useClerk();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const activate = useCallback(async () => {
    if (!loaded || !user) return;

    setError(null);

    try {
      // Step 1: Reload the user's session so Clerk client picks up the new membership
      await user.reload();

      // Step 2: Small delay to let Clerk propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Step 3: Activate the organization in the session
      await setActive({ organization: orgId });

      // Step 4: Hard navigation to force middleware to re-read the fresh session
      window.location.href = "/org-admin/dashboard";
    } catch (err: any) {
      console.error("Failed to activate org:", err);

      // If it's a network error and we haven't retried too many times, auto-retry
      if (retryCount < 2) {
        setRetryCount((c) => c + 1);
        // Wait a bit longer before retrying
        setTimeout(() => activate(), 1500);
        return;
      }

      setError(
        "Failed to activate your workspace. This may be a temporary network issue."
      );
    }
  }, [loaded, user, orgId, setActive, retryCount]);

  useEffect(() => {
    // Wait briefly before first attempt to let Clerk client fully initialize
    const timer = setTimeout(() => activate(), 300);
    return () => clearTimeout(timer);
  }, [activate]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center max-w-md">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-rose-400 text-sm mb-1">{error}</p>
          <p className="text-zinc-500 text-xs mb-5">
            You can also try signing out and signing back in.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setRetryCount(0);
                setError(null);
                activate();
              }}
              className="
                flex items-center gap-2 px-4 py-2.5 rounded-xl
                bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500
                text-white text-sm font-semibold transition-all duration-200
                shadow-lg shadow-rose-500/20
              "
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => (window.location.href = "/org-admin/dashboard")}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/20 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-rose-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white">Entering {orgName}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {retryCount > 0 ? "Retrying..." : "Setting up your workspace..."}
          </p>
        </div>
        <Loader2 className="w-5 h-5 text-rose-400 animate-spin mt-2" />
      </div>
    </div>
  );
}
