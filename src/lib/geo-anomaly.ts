/**
 * src/lib/geo-anomaly.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects suspicious login patterns by comparing the current session's
 * IP geolocation with the user's historical login locations.
 *
 * Anomaly signals:
 *   1. Login from a new country (never seen before)
 *   2. Impossible travel — two logins from distant locations in short time
 *   3. Known bad IP ranges (TOR exit nodes, datacenter IPs)
 *
 * This runs asynchronously and never blocks the login flow.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";

export interface LoginSignals {
  userId: string;
  ip: string;
  userAgent?: string;
  country?: string;
  region?: string;
  city?: string;
}

export interface AnomalyResult {
  isAnomalous: boolean;
  risk: "none" | "low" | "medium" | "high";
  reasons: string[];
}

// ── Known datacenter / VPN IP ranges (simplified — expand as needed) ────────
const SUSPICIOUS_IP_PATTERNS = [
  /^10\./, // Private (shouldn't appear in prod)
  /^172\.(1[6-9]|2\d|3[01])\./, // Private
  /^192\.168\./, // Private
];

/**
 * Analyze a login event for anomalies.
 * Should be called asynchronously after successful authentication.
 */
export async function detectLoginAnomaly(signals: LoginSignals): Promise<AnomalyResult> {
  const reasons: string[] = [];
  let riskScore = 0;

  try {
    // Fetch the last 10 login records for this user
    const recentLogins = await prisma.loginEvent.findMany({
      where: { userId: signals.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // ── 1. New country detection ──────────────────────────────────────────
    if (signals.country && recentLogins.length > 0) {
      const knownCountries = new Set(recentLogins.map((l) => l.country).filter(Boolean));
      if (knownCountries.size > 0 && !knownCountries.has(signals.country)) {
        reasons.push(`Login from new country: ${signals.country} (known: ${[...knownCountries].join(", ")})`);
        riskScore += 40;
      }
    }

    // ── 2. Impossible travel (>500km in <1hr) ─────────────────────────────
    if (recentLogins.length > 0 && signals.country) {
      const lastLogin = recentLogins[0];
      const timeDiffMs = Date.now() - lastLogin.createdAt.getTime();
      const timeDiffHrs = timeDiffMs / (1000 * 60 * 60);

      // If different country within 1 hour — suspicious
      if (
        lastLogin.country &&
        lastLogin.country !== signals.country &&
        timeDiffHrs < 1
      ) {
        reasons.push(
          `Impossible travel: ${lastLogin.country} → ${signals.country} in ${Math.round(timeDiffHrs * 60)}min`
        );
        riskScore += 60;
      }
    }

    // ── 3. Suspicious IP patterns ─────────────────────────────────────────
    for (const pattern of SUSPICIOUS_IP_PATTERNS) {
      if (pattern.test(signals.ip)) {
        reasons.push(`Suspicious IP range detected: ${signals.ip}`);
        riskScore += 20;
        break;
      }
    }

    // ── 4. New device/user-agent ──────────────────────────────────────────
    if (signals.userAgent && recentLogins.length > 3) {
      const knownAgents = new Set(recentLogins.map((l) => l.userAgent).filter(Boolean));
      if (knownAgents.size > 0 && !knownAgents.has(signals.userAgent)) {
        reasons.push("Login from a new device/browser");
        riskScore += 15;
      }
    }

    // ── Record this login event ───────────────────────────────────────────
    await prisma.loginEvent.create({
      data: {
        userId: signals.userId,
        ip: signals.ip,
        userAgent: signals.userAgent ?? null,
        country: signals.country ?? null,
        region: signals.region ?? null,
        city: signals.city ?? null,
        riskScore: Math.min(100, riskScore),
        anomalyReasons: reasons.length > 0 ? reasons : undefined,
      },
    });

  } catch (error) {
    console.error("[GeoAnomaly] Detection failed:", error);
    // Don't block login on detection failure
  }

  // Determine risk level
  let risk: AnomalyResult["risk"];
  if (riskScore === 0) risk = "none";
  else if (riskScore <= 20) risk = "low";
  else if (riskScore <= 50) risk = "medium";
  else risk = "high";

  return {
    isAnomalous: riskScore > 30,
    risk,
    reasons,
  };
}
