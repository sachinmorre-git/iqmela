/**
 * src/lib/rate-limiter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable sliding-window rate limiter (in-memory, per-process).
 *
 * Design:
 *   - Uses a Map<string, number[]> where key = IP/userId, value = timestamps
 *   - Sliding window: only timestamps within the window are counted
 *   - Automatic cleanup: purges stale entries every ~200 checks
 *   - Zero external dependencies (no Redis needed at this scale)
 *
 * Limitation:
 *   - In-memory = resets on deploy/restart (acceptable for Vercel serverless)
 *   - For multi-instance deployments, upgrade to Vercel KV or Upstash Redis
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Identifier for this limiter (used in logs) */
  name?: string;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in this window */
  remaining: number;
  /** Milliseconds until the window resets */
  retryAfterMs: number;
  /** Total requests made in this window */
  currentCount: number;
}

class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();
  private checkCount = 0;

  constructor(private config: RateLimitConfig) {}

  /**
   * Check if a request from the given key is allowed.
   * Returns the result with remaining count and retry-after info.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps, filter to current window
    const timestamps = (this.windows.get(key) || []).filter(
      (t) => t > windowStart
    );

    const currentCount = timestamps.length;
    const allowed = currentCount < this.config.maxRequests;

    if (allowed) {
      timestamps.push(now);
      this.windows.set(key, timestamps);
    } else {
      // Update with cleaned timestamps even on rejection
      this.windows.set(key, timestamps);
    }

    // Periodic garbage collection
    this.checkCount++;
    if (this.checkCount % 200 === 0) {
      this.cleanup(windowStart);
    }

    // Calculate retry-after based on oldest timestamp in window
    const retryAfterMs = timestamps.length > 0
      ? Math.max(0, timestamps[0] + this.config.windowMs - now)
      : 0;

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - currentCount - (allowed ? 1 : 0)),
      retryAfterMs,
      currentCount: allowed ? currentCount + 1 : currentCount,
    };
  }

  /**
   * Force-reset a specific key (e.g., after admin unblock).
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Get current stats for a key (for admin dashboard).
   */
  getStats(key: string): { count: number; windowMs: number; maxRequests: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = (this.windows.get(key) || []).filter(
      (t) => t > windowStart
    );
    return {
      count: timestamps.length,
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
    };
  }

  private cleanup(windowStart: number): void {
    for (const [key, timestamps] of this.windows) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

// ── Pre-configured limiter instances ────────────────────────────────────────

/** Public endpoints (unauthenticated) — strict */
export const publicApiLimiter = new SlidingWindowRateLimiter({
  name: "public-api",
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

/** AI Interview endpoints (authenticated) — moderate */
export const aiInterviewLimiter = new SlidingWindowRateLimiter({
  name: "ai-interview",
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
});

/** Health probe — generous (external monitors) */
export const healthLimiter = new SlidingWindowRateLimiter({
  name: "health",
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
});

/** Cron endpoints — very strict */
export const cronLimiter = new SlidingWindowRateLimiter({
  name: "cron",
  maxRequests: 2,
  windowMs: 60 * 1000, // 1 minute
});

/** General authenticated API — balanced */
export const generalApiLimiter = new SlidingWindowRateLimiter({
  name: "general-api",
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

/** Auth-sensitive (login/signup flows) — strict */
export const authLimiter = new SlidingWindowRateLimiter({
  name: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// ── Helper: Extract client IP from request ──────────────────────────────────

export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||  // Cloudflare
    "unknown"
  );
}

// ── Helper: Build 429 Response ──────────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfterMs: result.retryAfterMs,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

// ── Violation tracker (feeds into auto-ban) ─────────────────────────────────

const violationCounts = new Map<string, { count: number; firstAt: number }>();
const VIOLATION_THRESHOLD = 10;     // 10 rate-limit hits
const VIOLATION_WINDOW_MS = 3600_000; // within 1 hour → auto-block

/**
 * Track a rate-limit violation for an IP.
 * Returns true if the IP should be auto-blocked.
 */
export function trackViolation(ip: string): boolean {
  const now = Date.now();
  const existing = violationCounts.get(ip);

  if (!existing || now - existing.firstAt > VIOLATION_WINDOW_MS) {
    // Start fresh window
    violationCounts.set(ip, { count: 1, firstAt: now });
    return false;
  }

  existing.count++;
  if (existing.count >= VIOLATION_THRESHOLD) {
    violationCounts.delete(ip); // Reset counter after triggering block
    return true; // Signal: this IP should be blocked
  }

  return false;
}
