import type { HiringAiProvider } from "./types";
import { aiConfig } from "./config";
import { MockHiringAiProvider } from "./providers/mock-provider";
import { GeminiHiringAiProvider } from "./providers/gemini-provider";
import { DeepSeekHiringAiProvider } from "./providers/deepseek-provider";
import { getCircuitBreaker, type CircuitBreaker } from "./circuit-breaker";

function resolveProvider(forceName?: string): HiringAiProvider {
  if (forceName === "mock") return new MockHiringAiProvider();
  if (forceName === "gemini") return new GeminiHiringAiProvider();
  if (forceName === "deepseek") return new DeepSeekHiringAiProvider();

  if (aiConfig.provider === "deepseek" && aiConfig.deepseek.apiKey) {
    return new DeepSeekHiringAiProvider();
  }

  if (aiConfig.provider === "gemini" && aiConfig.gemini.apiKey) {
    return new GeminiHiringAiProvider();
  }

  if (!aiConfig.fallbackEnabled) {
    throw new Error("[HiringAI] AI_FALLBACK_ENABLED=false but no valid provider is configured.");
  }

  return new MockHiringAiProvider();
}

/**
 * A proxy wrapper that safely intercepts API failures, applies circuit-breaker
 * logic, and rolls back to a designated fallback provider.
 *
 * Circuit Breaker behaviour:
 *   - CLOSED: Requests go to primary. Failures increment the counter.
 *   - OPEN: After N consecutive failures, ALL requests bypass primary and
 *           go directly to fallback for a cooldown period (60s default).
 *   - HALF_OPEN: After cooldown, a single probe goes to primary.
 *     - If it succeeds → CLOSED (primary recovered).
 *     - If it fails → OPEN again.
 */
class ProxyHiringAiProvider implements HiringAiProvider {
  readonly providerName: string;
  private primary: HiringAiProvider;
  private breaker: CircuitBreaker;
  
  constructor() {
    this.primary = resolveProvider();
    this.providerName = this.primary.providerName;
    this.breaker = getCircuitBreaker(this.primary.providerName, {
      failureThreshold: 3,     // 3 consecutive failures → OPEN
      cooldownMs: 60_000,      // Wait 60s before probing
      successThreshold: 2,     // 2 probe successes → CLOSED
      onStateChange: (from, to, name) => {
        console.warn(`[HiringAI:CircuitBreaker] ${name}: ${from} → ${to}`);
      },
    });
  }

  private async withFallback<T>(operation: (provider: HiringAiProvider) => Promise<T>, operationName: string): Promise<T> {
    // ── Circuit Breaker: skip primary if circuit is OPEN ─────────────────
    if (!this.breaker.isAllowed()) {
      console.warn(
        `[HiringAI:CircuitBreaker] ${operationName}: circuit OPEN for ${this.primary.providerName}, ` +
        `routing directly to ${aiConfig.fallbackProvider}`
      );
      const fallbackProvider = resolveProvider(aiConfig.fallbackProvider);
      return await operation(fallbackProvider);
    }

    try {
      const result = await operation(this.primary);
      this.breaker.onSuccess();
      return result;
    } catch (error) {
      this.breaker.onFailure();

      if (!aiConfig.fallbackEnabled || aiConfig.fallbackProvider === this.primary.providerName) {
        throw error;
      }
      
      const breakerState = this.breaker.getState();
      console.warn(
        `[HiringAI:Fallback] ${operationName} failed with ${this.primary.providerName} ` +
        `(breaker: ${breakerState}, failures: ${this.breaker.getStats().consecutiveFailures}). ` +
        `Falling back to ${aiConfig.fallbackProvider}. Error:`,
        error
      );
      const fallbackProvider = resolveProvider(aiConfig.fallbackProvider);
      return await operation(fallbackProvider);
    }
  }

  async extractResumeJson(rawText: string, fileName?: string) {
    return this.withFallback(p => p.extractResumeJson(rawText, fileName), "extractResumeJson");
  }

  async extractJdFromText(rawText: string) {
    return this.withFallback(p => p.extractJdFromText(rawText), "extractJdFromText");
  }

  async analyzeJdJson(jdText: string, positionTitle?: string) {
    return this.withFallback(p => p.analyzeJdJson(jdText, positionTitle), "analyzeJdJson");
  }

  async rankCandidateAgainstJd(extracted: import("./types").ExtractedResumeData, rawResumeText: string, jdText: string, jdAnalysis?: import("./types").JdAnalysisResult) {
    return this.withFallback(p => p.rankCandidateAgainstJd(extracted, rawResumeText, jdText, jdAnalysis), "rankCandidateAgainstJd");
  }

  async generateCandidateSummary(extracted: import("./types").ExtractedResumeData) {
    return this.withFallback(p => p.generateCandidateSummary(extracted), "generateCandidateSummary");
  }

  async runAdvancedCandidateJudgment(ranking: import("./types").ResumeRankingResult, extracted: import("./types").ExtractedResumeData) {
    return this.withFallback(p => p.runAdvancedCandidateJudgment(ranking, extracted), "runAdvancedCandidateJudgment");
  }

  async generateInterviewPrep(extracted: import("./types").ExtractedResumeData, ranking: import("./types").ResumeRankingResult, jdText: string) {
    return this.withFallback(p => p.generateInterviewPrep(extracted, ranking, jdText), "generateInterviewPrep");
  }

  async analyzeRedFlags(extracted: import("./types").ExtractedResumeData, rawText: string) {
    return this.withFallback(p => p.analyzeRedFlags(extracted, rawText), "analyzeRedFlags");
  }
}

/**
 * Singleton AI provider instance.
 * Import this anywhere in the app to access AI services.
 *
 * @example
 *   import { hiringAi } from "@/lib/ai"
 *   const data = await hiringAi.extractResumeJson(text, fileName)
 */
export const hiringAi: HiringAiProvider = new ProxyHiringAiProvider();

// Re-export types for convenient co-importing
export type {
  HiringAiProvider,
  ExtractedResumeData,
  ExtractedJdData,
  JdAnalysisResult,
  ResumeRankingResult,
  CandidateSummaryResult,
  RecommendationResult,
} from "./types";

// Re-export circuit breaker for admin dashboard
export { getCircuitBreaker, getAllCircuitBreakers } from "./circuit-breaker";

