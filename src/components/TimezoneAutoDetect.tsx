/**
 * TimezoneAutoDetect
 * ─────────────────────────────────────────────────────────────────────────────
 * Invisible component that auto-detects the user's browser timezone on first
 * mount and saves it to their profile via server action.
 *
 * Only fires ONCE per browser (sessionStorage flag).
 * Renders nothing — zero visual impact.
 *
 * USAGE: Drop into any layout that runs after auth:
 *   <TimezoneAutoDetect />
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useEffect } from "react";
import { detectBrowserTimezone } from "@/lib/locale-utils";
import { saveDetectedTimezone } from "@/lib/locale-actions";

const STORAGE_KEY = "iqmela:tz-detected";

export function TimezoneAutoDetect() {
  useEffect(() => {
    // Only run once per session
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const tz = detectBrowserTimezone();
    if (!tz || tz === "UTC") return; // Don't save generic UTC

    // Mark as detected immediately to prevent duplicate calls
    sessionStorage.setItem(STORAGE_KEY, tz);

    // Fire-and-forget — no UI depends on this
    saveDetectedTimezone(tz).catch((err) => {
      console.warn("[TimezoneAutoDetect] Failed to save timezone:", err);
      // Clear the flag so it retries next session
      sessionStorage.removeItem(STORAGE_KEY);
    });
  }, []);

  // Render nothing
  return null;
}
