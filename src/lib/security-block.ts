/**
 * src/lib/security-block.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IP / User Block System  (EDGE-SAFE — no top-level Prisma import)
 *
 * Manages temporary and permanent blocks for abusive IPs and users.
 * Two layers:
 *   1. In-memory block list (fast, per-process, for middleware hot path)
 *   2. DB SecurityBlock model (persistent, survives deploys, for admin panel)
 *
 * Auto-ban flow:
 *   Rate limiter detects abuse → trackViolation() returns true →
 *   autoBlockIp() → IP blocked for 1 hour → notification to super admins
 *
 * IMPORTANT: This file is imported by proxy.ts (Edge middleware).
 * All Prisma calls MUST use dynamic import() to stay Edge-compatible.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── In-Memory Block Cache ──────────────────────────────────────────────────
// Fast lookup for middleware — syncs with DB periodically

interface BlockEntry {
  reason: string;
  expiresAt: number; // Unix timestamp (0 = permanent)
  blockedAt: number;
}

const ipBlockCache = new Map<string, BlockEntry>();
const userBlockCache = new Map<string, BlockEntry>();

// Periodic DB sync interval (every 5 minutes)
let lastDbSync = 0;
const DB_SYNC_INTERVAL = 5 * 60 * 1000;

// ── Check if IP is blocked (EDGE-SAFE — pure in-memory) ───────────────────

export function isIpBlocked(ip: string): { blocked: boolean; reason?: string; expiresAt?: number } {
  const entry = ipBlockCache.get(ip);
  if (!entry) return { blocked: false };

  // Check expiry
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    ipBlockCache.delete(ip);
    return { blocked: false };
  }

  return { blocked: true, reason: entry.reason, expiresAt: entry.expiresAt };
}

// ── Check if User is blocked (EDGE-SAFE — pure in-memory) ─────────────────

export function isUserBlocked(userId: string): { blocked: boolean; reason?: string; expiresAt?: number } {
  const entry = userBlockCache.get(userId);
  if (!entry) return { blocked: false };

  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    userBlockCache.delete(userId);
    return { blocked: false };
  }

  return { blocked: true, reason: entry.reason, expiresAt: entry.expiresAt };
}

// ── Auto-block an IP (called when violation threshold reached) ─────────────

export async function autoBlockIp(ip: string, reason: string = "Rate limit abuse"): Promise<void> {
  const durationMs = 60 * 60 * 1000; // 1 hour
  const expiresAt = Date.now() + durationMs;

  // In-memory (immediate effect)
  ipBlockCache.set(ip, {
    reason,
    expiresAt,
    blockedAt: Date.now(),
  });

  // Persist to DB (survives restarts)
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.securityBlock.create({
      data: {
        targetType: "IP",
        targetValue: ip,
        reason,
        severity: "auto",
        expiresAt: new Date(expiresAt),
        createdBy: "system_auto_ban",
      },
    });
    console.warn(`[SecurityBlock] Auto-blocked IP ${ip} for 1 hour: ${reason}`);

    // Notify super admins
    notifySuperAdminsOfBlock(ip, reason, "IP").catch(() => {});
  } catch (e) {
    console.error("[SecurityBlock] Failed to persist IP block:", e);
  }
}

// ── Manual block (admin action) ────────────────────────────────────────────

export async function manualBlock(input: {
  targetType: "IP" | "USER";
  targetValue: string;
  reason: string;
  durationMs?: number; // 0 or undefined = permanent
  createdBy: string;
}): Promise<void> {
  const expiresAt = input.durationMs
    ? Date.now() + input.durationMs
    : 0;

  const cache = input.targetType === "IP" ? ipBlockCache : userBlockCache;
  cache.set(input.targetValue, {
    reason: input.reason,
    expiresAt,
    blockedAt: Date.now(),
  });

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.securityBlock.create({
      data: {
        targetType: input.targetType,
        targetValue: input.targetValue,
        reason: input.reason,
        severity: "manual",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: input.createdBy,
      },
    });
    console.warn(`[SecurityBlock] Manual block: ${input.targetType} ${input.targetValue} — ${input.reason}`);
  } catch (e) {
    console.error("[SecurityBlock] Failed to persist manual block:", e);
  }
}

// ── Unblock (admin action) ─────────────────────────────────────────────────

export async function unblock(targetType: "IP" | "USER", targetValue: string): Promise<void> {
  const cache = targetType === "IP" ? ipBlockCache : userBlockCache;
  cache.delete(targetValue);

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.securityBlock.updateMany({
      where: { targetType, targetValue, isActive: true },
      data: { isActive: false },
    });
    console.log(`[SecurityBlock] Unblocked: ${targetType} ${targetValue}`);
  } catch (e) {
    console.error("[SecurityBlock] Failed to unblock:", e);
  }
}

// ── Get all active blocks (for admin dashboard) ────────────────────────────

export async function getActiveBlocks() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.securityBlock.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },          // Permanent
        { expiresAt: { gt: new Date() } }, // Not yet expired
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ── Sync from DB to memory (called periodically) ──────────────────────────

export async function syncBlocksFromDb(): Promise<void> {
  const now = Date.now();
  if (now - lastDbSync < DB_SYNC_INTERVAL) return;
  lastDbSync = now;

  try {
    const { prisma } = await import("@/lib/prisma");
    const blocks = await prisma.securityBlock.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    // Rebuild caches
    ipBlockCache.clear();
    userBlockCache.clear();

    for (const block of blocks) {
      const cache = block.targetType === "IP" ? ipBlockCache : userBlockCache;
      cache.set(block.targetValue, {
        reason: block.reason,
        expiresAt: block.expiresAt ? block.expiresAt.getTime() : 0,
        blockedAt: block.createdAt.getTime(),
      });
    }
  } catch {
    // Silently fail — in-memory cache is still usable
  }
}

// ── Notify super admins ────────────────────────────────────────────────────

async function notifySuperAdminsOfBlock(target: string, reason: string, type: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const superAdmins = await prisma.user.findMany({
      where: { roles: { has: "INTERNAL_GOD_MODE" } },
      select: { id: true, organizationId: true },
    });

    if (superAdmins.length === 0) return;

    const { createBulkNotifications } = await import("@/lib/notification-service");
    await createBulkNotifications(
      superAdmins.map((admin) => ({
        organizationId: admin.organizationId ?? "GLOBAL",
        userId: admin.id,
        type: "PLATFORM_INCIDENT" as const,
        title: `Security: ${type} Auto-Blocked`,
        body: `${type} "${target}" was automatically blocked. Reason: ${reason}`,
        link: "/admin/security",
      }))
    );
  } catch {
    // Non-critical — don't propagate
  }
}
