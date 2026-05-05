/**
 * src/lib/ai/circuit-breaker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Circuit Breaker pattern for AI provider resilience.
 *
 * States:
 *   CLOSED   → Normal operation. Requests go through the primary provider.
 *   OPEN     → Primary is considered down. All requests route to fallback.
 *   HALF_OPEN → After cooldown, allow ONE probe request through primary.
 *              If it succeeds → CLOSED. If it fails → OPEN again.
 *
 * Configuration:
 *   failureThreshold  — consecutive failures before opening circuit (default: 3)
 *   cooldownMs        — how long to stay OPEN before trying HALF_OPEN (default: 60s)
 *   successThreshold  — consecutive successes in HALF_OPEN to fully close (default: 2)
 *
 * Thread-safety note:
 *   Node.js is single-threaded, so no mutex needed. However, concurrent async
 *   calls can interleave — the breaker uses atomic counter increments.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Consecutive failures before tripping to OPEN */
  failureThreshold?: number;
  /** Milliseconds to wait in OPEN before probing (HALF_OPEN) */
  cooldownMs?: number;
  /** Consecutive successes in HALF_OPEN before closing */
  successThreshold?: number;
  /** Callback when state changes (for logging / admin alerts) */
  onStateChange?: (from: CircuitState, to: CircuitState, providerName: string) => void;
}

export class CircuitBreaker {
  readonly providerName: string;

  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;
  private readonly onStateChange?: CircuitBreakerOptions["onStateChange"];

  constructor(providerName: string, options: CircuitBreakerOptions = {}) {
    this.providerName = providerName;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 60_000; // 1 minute
    this.successThreshold = options.successThreshold ?? 2;
    this.onStateChange = options.onStateChange;
  }

  /** Current circuit state */
  getState(): CircuitState {
    // Check if OPEN should transition to HALF_OPEN
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime >= this.cooldownMs) {
      this.transition("HALF_OPEN");
    }
    return this.state;
  }

  /** Whether the circuit allows a request through */
  isAllowed(): boolean {
    const state = this.getState();
    return state === "CLOSED" || state === "HALF_OPEN";
  }

  /** Record a successful call */
  onSuccess(): void {
    this.consecutiveFailures = 0;

    if (this.state === "HALF_OPEN") {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.transition("CLOSED");
      }
    }
  }

  /** Record a failed call */
  onFailure(): void {
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Immediate re-open on any failure during probe
      this.transition("OPEN");
    } else if (this.state === "CLOSED" && this.consecutiveFailures >= this.failureThreshold) {
      this.transition("OPEN");
    }
  }

  /** Force-reset to CLOSED (e.g. from admin panel) */
  reset(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.transition("CLOSED");
  }

  /** Diagnostic snapshot */
  getStats() {
    return {
      provider: this.providerName,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      cooldownRemaining:
        this.state === "OPEN"
          ? Math.max(0, this.cooldownMs - (Date.now() - this.lastFailureTime))
          : 0,
    };
  }

  private transition(to: CircuitState) {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;

    if (to === "CLOSED") {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }

    console.warn(
      `[CircuitBreaker:${this.providerName}] ${from} → ${to}` +
        (to === "OPEN" ? ` (after ${this.consecutiveFailures} consecutive failures, cooldown ${this.cooldownMs}ms)` : "")
    );

    this.onStateChange?.(from, to, this.providerName);
  }
}

// ── Global breaker instances ─────────────────────────────────────────────────

const breakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a CircuitBreaker for a given provider name.
 * Singletons per provider — survives across requests in the same Node.js process.
 */
export function getCircuitBreaker(providerName: string, options?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(providerName)) {
    breakers.set(providerName, new CircuitBreaker(providerName, options));
  }
  return breakers.get(providerName)!;
}

/** Get all breakers (for admin dashboard display) */
export function getAllCircuitBreakers(): CircuitBreaker[] {
  return Array.from(breakers.values());
}
