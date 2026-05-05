/**
 * src/hooks/useNetworkQuality.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side hook that continuously monitors network quality during an AI
 * interview and fires callbacks when quality degrades below thresholds.
 *
 * Measurement strategies (layered):
 *   1. navigator.connection API (effectiveType, downlink, rtt)
 *   2. Periodic ping latency to same-origin (fetch /api/health or /favicon.ico)
 *   3. Online/offline detection via navigator.onLine events
 *
 * Quality levels:
 *   EXCELLENT  — RTT < 100ms,  bandwidth ≥ 10 Mbps
 *   GOOD       — RTT < 300ms,  bandwidth ≥ 2 Mbps
 *   POOR       — RTT < 1000ms, bandwidth ≥ 0.5 Mbps
 *   CRITICAL   — RTT ≥ 1000ms OR offline OR bandwidth < 0.5 Mbps
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type NetworkQuality = "EXCELLENT" | "GOOD" | "POOR" | "CRITICAL";

export interface NetworkStats {
  quality: NetworkQuality;
  rttMs: number | null;             // Round-trip ping time (ms)
  downlinkMbps: number | null;      // Estimated download speed (Mbps)
  effectiveType: string | null;     // "4g" | "3g" | "2g" | "slow-2g"
  isOnline: boolean;
  consecutivePoorReadings: number;  // How many consecutive readings ≤ POOR
  lastUpdated: number;              // Timestamp of last measurement
}

interface UseNetworkQualityOptions {
  /** Polling interval in ms (default: 5000 — every 5 seconds) */
  intervalMs?: number;
  /** Number of consecutive POOR readings before triggering onDegraded (default: 3) */
  degradedThreshold?: number;
  /** Callback when quality drops below threshold for sustained period */
  onDegraded?: (stats: NetworkStats) => void;
  /** Callback when quality recovers */
  onRecovered?: (stats: NetworkStats) => void;
  /** Whether monitoring is active (disable when interview is over) */
  enabled?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function classifyQuality(rttMs: number | null, downlinkMbps: number | null, isOnline: boolean): NetworkQuality {
  if (!isOnline) return "CRITICAL";
  
  // If we have downlink info (from navigator.connection)
  if (downlinkMbps !== null) {
    if (downlinkMbps < 0.5) return "CRITICAL";
    if (downlinkMbps < 2) return "POOR";
  }

  // If we have RTT from ping
  if (rttMs !== null) {
    if (rttMs >= 1000) return "CRITICAL";
    if (rttMs >= 300) return "POOR";
    if (rttMs >= 100) return "GOOD";
    return "EXCELLENT";
  }

  // If we have effectiveType from navigator.connection
  return "GOOD"; // Default when no measurements available
}

function getConnectionInfo(): { downlink: number | null; effectiveType: string | null; rtt: number | null } {
  const conn = (navigator as any).connection;
  if (!conn) return { downlink: null, effectiveType: null, rtt: null };
  return {
    downlink: conn.downlink ?? null,
    effectiveType: conn.effectiveType ?? null,
    rtt: conn.rtt ?? null,
  };
}

async function measurePingLatency(): Promise<number | null> {
  try {
    const start = performance.now();
    // Use a lightweight same-origin fetch to measure RTT
    const response = await fetch("/favicon.ico", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return Math.round(performance.now() - start);
  } catch {
    return null; // Fetch failed — network is likely down
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNetworkQuality(options: UseNetworkQualityOptions = {}): NetworkStats {
  const {
    intervalMs = 5000,
    degradedThreshold = 3,
    onDegraded,
    onRecovered,
    enabled = true,
  } = options;

  const [stats, setStats] = useState<NetworkStats>({
    quality: "GOOD",
    rttMs: null,
    downlinkMbps: null,
    effectiveType: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    consecutivePoorReadings: 0,
    lastUpdated: Date.now(),
  });

  const consecutivePoorRef = useRef(0);
  const wasDegradedRef = useRef(false);
  const onDegradedRef = useRef(onDegraded);
  const onRecoveredRef = useRef(onRecovered);

  // Keep callback refs fresh
  useEffect(() => { onDegradedRef.current = onDegraded; }, [onDegraded]);
  useEffect(() => { onRecoveredRef.current = onRecovered; }, [onRecovered]);

  const measure = useCallback(async () => {
    const isOnline = navigator.onLine;
    const connInfo = getConnectionInfo();
    const pingRtt = await measurePingLatency();

    // Use navigator.connection RTT if ping failed, or vice versa
    const effectiveRtt = pingRtt ?? connInfo.rtt;
    const quality = classifyQuality(effectiveRtt, connInfo.downlink, isOnline);

    // Track consecutive poor readings
    if (quality === "POOR" || quality === "CRITICAL") {
      consecutivePoorRef.current++;
    } else {
      consecutivePoorRef.current = 0;
    }

    const newStats: NetworkStats = {
      quality,
      rttMs: effectiveRtt,
      downlinkMbps: connInfo.downlink,
      effectiveType: connInfo.effectiveType,
      isOnline,
      consecutivePoorReadings: consecutivePoorRef.current,
      lastUpdated: Date.now(),
    };

    setStats(newStats);

    // Fire callbacks
    if (consecutivePoorRef.current >= degradedThreshold && !wasDegradedRef.current) {
      wasDegradedRef.current = true;
      onDegradedRef.current?.(newStats);
    } else if (consecutivePoorRef.current === 0 && wasDegradedRef.current) {
      wasDegradedRef.current = false;
      onRecoveredRef.current?.(newStats);
    }
  }, [degradedThreshold]);

  // Polling interval
  useEffect(() => {
    if (!enabled) return;

    // Initial measurement
    measure();

    const interval = setInterval(measure, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, measure]);

  // Online/offline events
  useEffect(() => {
    if (!enabled) return;

    const onOnline = () => measure();
    const onOffline = () => {
      consecutivePoorRef.current = degradedThreshold; // Immediately trigger degraded
      measure();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // navigator.connection change event
    const conn = (navigator as any).connection;
    if (conn?.addEventListener) {
      conn.addEventListener("change", measure);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (conn?.removeEventListener) {
        conn.removeEventListener("change", measure);
      }
    };
  }, [enabled, degradedThreshold, measure]);

  return stats;
}
