/**
 * AI Avatar Interview — singleton provider resolver.
 * Mirrors the pattern in src/lib/ai/index.ts.
 *
 * Usage:
 *   import { aiInterviewer } from "@/lib/ai-interview"
 *   const plan = await aiInterviewer.generateQuestionPlan(context)
 */

import type { AiInterviewProvider } from "./types";
import { MockAiInterviewProvider } from "./providers/mock-provider";
import { GeminiAiInterviewProvider } from "./providers/gemini-provider";
import { DeepseekAiInterviewProvider } from "./providers/deepseek-provider";
import { getCircuitBreaker, type CircuitBreaker } from "@/lib/ai/circuit-breaker";

function resolveProvider(forceName?: string): AiInterviewProvider {
  if (forceName === "mock") return new MockAiInterviewProvider();
  if (forceName === "gemini") return new GeminiAiInterviewProvider();
  if (forceName === "deepseek") return new DeepseekAiInterviewProvider();

  const rawProvider = process.env.AI_PROVIDER?.toLowerCase() ?? "";
  const geminiKey = process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (rawProvider === "mock") return new MockAiInterviewProvider();
  if (rawProvider === "deepseek" && deepseekKey) return new DeepseekAiInterviewProvider();
  if (rawProvider === "gemini" && geminiKey) return new GeminiAiInterviewProvider();

  // Auto-detect preference: Deepseek first if configured (as fallback default) or Gemini
  if (geminiKey) return new GeminiAiInterviewProvider();
  if (deepseekKey) return new DeepseekAiInterviewProvider();

  const fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== "false";
  if (!fallbackEnabled) {
    throw new Error("[AiInterview] AI_FALLBACK_ENABLED=false but no valid provider configured.");
  }

  console.warn("[AiInterview] No API key found — using mock provider.");
  return new MockAiInterviewProvider();
}

class ProxyAiInterviewProvider implements AiInterviewProvider {
  readonly providerName: string;
  private primary: AiInterviewProvider;
  private breaker: CircuitBreaker;
  
  constructor() {
    this.primary = resolveProvider();
    this.providerName = this.primary.providerName;
    this.breaker = getCircuitBreaker(`ai-interview-${this.primary.providerName}`, {
      failureThreshold: 3,     // 3 consecutive failures -> OPEN
      cooldownMs: 60_000,      // Wait 60s before probing
      successThreshold: 2,     // 2 probe successes -> CLOSED
      onStateChange: (from, to, name) => {
        console.warn(`[AiInterview:CircuitBreaker] ${name}: ${from} -> ${to}`);
      },
    });
  }

  private async withFallback<T>(operation: (provider: AiInterviewProvider) => Promise<T>, operationName: string): Promise<T> {
    const fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== "false";
    const fallbackProviderName = process.env.AI_FALLBACK_PROVIDER?.toLowerCase() || "deepseek";

    if (!this.breaker.isAllowed()) {
      console.warn(`[AiInterview:CircuitBreaker] ${operationName}: circuit OPEN for ${this.primary.providerName}, routing directly to ${fallbackProviderName}`);
      const fallbackProvider = resolveProvider(fallbackProviderName);
      return await operation(fallbackProvider);
    }

    try {
      const result = await operation(this.primary);
      this.breaker.onSuccess();
      return result;
    } catch (error) {
      this.breaker.onFailure();

      if (!fallbackEnabled || fallbackProviderName === this.primary.providerName) {
        throw error;
      }
      
      const breakerState = this.breaker.getState();
      console.warn(`[AiInterview:Fallback] ${operationName} failed with ${this.primary.providerName} (breaker: ${breakerState}). Falling back to ${fallbackProviderName}. Error:`, error);
      const fallbackProvider = resolveProvider(fallbackProviderName);
      return await operation(fallbackProvider);
    }
  }

  async generateQuestionPlan(context: import("./types").QuestionPlanContext) {
    return this.withFallback(p => p.generateQuestionPlan(context), "generateQuestionPlan");
  }

  async scoreSession(context: import("./types").QuestionPlanContext, turns: import("./types").TranscriptTurn[]) {
    return this.withFallback(p => p.scoreSession(context, turns), "scoreSession");
  }

  async evaluateFollowUp(context: import("./types").FollowUpContext) {
    return this.withFallback(p => p.evaluateFollowUp(context), "evaluateFollowUp");
  }
}

export const aiInterviewer: AiInterviewProvider = new ProxyAiInterviewProvider();

// Re-export all types for convenient co-importing
export type {
  AiInterviewProvider,
  AiInterviewPlan,
  AiInterviewQuestion,
  AiInterviewSummary,
  AiAnswerScore,
  AiRecommendation,
  QuestionPlanContext,
  TranscriptTurn,
  AiInterviewUsageData,
  AiQuestionCategory,
  FollowUpContext,
  FollowUpResult,
} from "./types";
