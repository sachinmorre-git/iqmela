"use client";

import { useEffect } from "react";

/**
 * Invisible component that fires a view-tracking beacon on mount.
 * IP-deduped on the server side (1 view per IP per hour).
 */
export function ViewTracker({ positionId }: { positionId: string }) {
  useEffect(() => {
    // Fire-and-forget — never block rendering
    fetch("/api/public/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionId, event: "view" }),
    }).catch(() => {
      // Silently swallow — tracking should never break UX
    });
  }, [positionId]);

  return null;
}
