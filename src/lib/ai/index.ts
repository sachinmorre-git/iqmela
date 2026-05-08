import type { HiringAiProvider } from "./types";
import { aiConfig } from "./config";
import { MockHiringAiProvider } from "./providers/mock-provider";
import { GeminiHiringAiProvider } from "./providers/gemini-provider";
import { DeepSeekHiringAiProvider } from "./providers/deepseek-provider";
import { getCircuitBreaker, type CircuitBreaker } from "./circuit-breaker";
import { getModelChain, getProviderForModel } from "./model-router";
import type { AiModelId } from "./models";

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

/** Instantiate a provider for a specific model ID */
function resolveProviderForModel(modelId: AiModelId): HiringAiProvider {
  const providerName = getProviderForModel(modelId);
  return resolveProvider(providerName);
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

  /**
   * Execute an AI operation with model-chain-based fallback.
   * 
   * Resolution order:
   *   1. Load the model chain for the given taskKey (primary → fallback1 → fallback2)
   *   2. Try the primary model's provider
   *   3. On failure → try fallback1's provider
   *   4. On failure → try fallback2's provider
   *   5. On all failures → throw with diagnostics
   */
  private async withModelChainFallback<T>(
    operation: (provider: HiringAiProvider) => Promise<T>,
    operationName: string,
    taskKey?: string,
    orgId?: string,
  ): Promise<T> {
    // If a taskKey is provided, use the model-chain routing
    if (taskKey) {
      try {
        const chain = await getModelChain(taskKey, orgId);
        const modelsToTry: AiModelId[] = [chain.primary];
        if (chain.fallback1) modelsToTry.push(chain.fallback1);
        if (chain.fallback2) modelsToTry.push(chain.fallback2);

        let lastError: Error | null = null;
        for (let i = 0; i < modelsToTry.length; i++) {
          const modelId = modelsToTry[i];
          const provider = resolveProviderForModel(modelId);
          try {
            const result = await operation(provider);
            if (i > 0) {
              console.warn(
                `[HiringAI:ModelChain] ${operationName}: succeeded with fallback ${i} ` +
                `(${modelId}) after primary (${chain.primary}) failed.`
              );
            }
            return result;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(
              `[HiringAI:ModelChain] ${operationName}: model "${modelId}" (slot ${i}) failed:`,
              lastError.message
            );
          }
        }
        throw lastError ?? new Error(`[HiringAI] All models exhausted for ${operationName}`);
      } catch (routerError) {
        // If the model router itself fails (DB down), fall through to legacy
        if ((routerError as Error)?.message?.includes("All models exhausted")) {
          throw routerError;
        }
        console.warn(`[HiringAI:ModelRouter] Router failed for ${operationName}, using legacy fallback:`, routerError);
      }
    }

    // Legacy fallback path (circuit breaker based)
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
    return this.withModelChainFallback(p => p.extractResumeJson(rawText, fileName), "extractResumeJson", "extraction");
  }

  async extractJdFromText(rawText: string) {
    return this.withModelChainFallback(p => p.extractJdFromText(rawText), "extractJdFromText", "jdAnalysis");
  }

  async analyzeJdJson(jdText: string, positionTitle?: string) {
    return this.withModelChainFallback(p => p.analyzeJdJson(jdText, positionTitle), "analyzeJdJson", "jdAnalysis");
  }

  async rankCandidateAgainstJd(extracted: import("./types").ExtractedResumeData, rawResumeText: string, jdText: string, jdAnalysis?: import("./types").JdAnalysisResult) {
    return this.withModelChainFallback(p => p.rankCandidateAgainstJd(extracted, rawResumeText, jdText, jdAnalysis), "rankCandidateAgainstJd", "ranking");
  }

  async generateCandidateSummary(extracted: import("./types").ExtractedResumeData) {
    return this.withModelChainFallback(p => p.generateCandidateSummary(extracted), "generateCandidateSummary", "candidateSummary");
  }

  async runAdvancedCandidateJudgment(ranking: import("./types").ResumeRankingResult, extracted: import("./types").ExtractedResumeData) {
    return this.withModelChainFallback(p => p.runAdvancedCandidateJudgment(ranking, extracted), "runAdvancedCandidateJudgment", "judgment");
  }

  async generateInterviewPrep(extracted: import("./types").ExtractedResumeData, ranking: import("./types").ResumeRankingResult, jdText: string) {
    return this.withModelChainFallback(p => p.generateInterviewPrep(extracted, ranking, jdText), "generateInterviewPrep", "interviewPrep");
  }

  async analyzeRedFlags(extracted: import("./types").ExtractedResumeData, rawText: string) {
    return this.withModelChainFallback(p => p.analyzeRedFlags(extracted, rawText), "analyzeRedFlags", "redFlags");
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
