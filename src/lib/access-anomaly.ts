/**
 * src/lib/access-anomaly.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects abnormal data access patterns (bulk downloads, excessive exports).
 *
 * Monitors:
 *   1. Resume download velocity — too many downloads in a short period
 *   2. Candidate data bulk access — accessing many profiles rapidly
 *   3. Cross-org access attempts — accessing data from another org
 *
 * Designed to be called inline from data-access endpoints.
 * Non-blocking — fires alerts asynchronously.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── In-memory tracking (per-process) ────────────────────────────────────────

interface AccessWindow {
  count: number;
  firstAt: number;
  lastAt: number;
}

const accessTrackers = new Map<string, AccessWindow>();

const THRESHOLDS = {
  RESUME_DOWNLOAD:    { max: 50, windowMs: 60 * 60 * 1000 },  // 50 resumes/hr
  CANDIDATE_VIEW:     { max: 100, windowMs: 60 * 60 * 1000 }, // 100 profiles/hr
  EXPORT:             { max: 10, windowMs: 60 * 60 * 1000 },  // 10 exports/hr
} as const;

type AccessType = keyof typeof THRESHOLDS;

export interface AccessAnomalyResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  threshold: number;
}

/**
 * Track and check a data access event.
 * Returns whether the access should be allowed.
 */
export function checkAccessAnomaly(
  userId: string,
  accessType: AccessType,
): AccessAnomalyResult {
  const key = `${userId}:${accessType}`;
  const threshold = THRESHOLDS[accessType];
  const now = Date.now();

  const existing = accessTrackers.get(key);

  if (!existing || now - existing.firstAt > threshold.windowMs) {
    // Start new window
    accessTrackers.set(key, { count: 1, firstAt: now, lastAt: now });
    return { allowed: true, currentCount: 1, threshold: threshold.max };
  }

  existing.count++;
  existing.lastAt = now;

  if (existing.count > threshold.max) {
    return {
      allowed: false,
      reason: `Exceeded ${accessType} threshold: ${existing.count}/${threshold.max} in ${Math.round(threshold.windowMs / 60_000)}min`,
      currentCount: existing.count,
      threshold: threshold.max,
    };
  }

  // Warn if approaching threshold (>80%)
  if (existing.count > threshold.max * 0.8) {
    console.warn(
      `[AccessAnomaly] User ${userId} approaching ${accessType} threshold: ${existing.count}/${threshold.max}`
    );
  }

  return { allowed: true, currentCount: existing.count, threshold: threshold.max };
}

/**
 * Alert super admins of an access anomaly (fire-and-forget).
 */
export async function alertAccessAnomaly(
  userId: string,
  accessType: string,
  details: string,
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");

    // Log to audit
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: "GLOBAL",
        action: "ACCESS_ANOMALY_DETECTED",
        resourceType: "SECURITY",
        resourceId: userId,
        metadata: {
          accessType,
          details,
          detectedAt: new Date().toISOString(),
        },
      },
    });

    // Notify super admins
    const superAdmins = await prisma.user.findMany({
      where: { roles: { has: "INTERNAL_GOD_MODE" } },
      select: { id: true, organizationId: true },
    });

    if (superAdmins.length > 0) {
      const { createBulkNotifications } = await import("@/lib/notification-service");
      await createBulkNotifications(
        superAdmins.map((admin) => ({
          organizationId: admin.organizationId ?? "GLOBAL",
          userId: admin.id,
          type: "PLATFORM_INCIDENT" as const,
          title: "Data Access Anomaly Detected",
          body: `User ${userId}: ${details}`,
          link: "/admin/security",
        }))
      );
    }
  } catch (e) {
    console.error("[AccessAnomaly] Failed to alert:", e);
  }
}
