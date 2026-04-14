import type { HiringAiProvider } from "./types";
import { aiConfig } from "./config";
import { MockHiringAiProvider } from "./providers/mock-provider";
import { GeminiHiringAiProvider } from "./providers/gemini-provider";
import { DeepSeekHiringAiProvider } from "./providers/deepseek-provider";

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
 * A proxy wrapper that safely intercepts API failures and rolls back to a designated Fallback API provider.
 */
class ProxyHiringAiProvider implements HiringAiProvider {
  readonly providerName: string;
  private primary: HiringAiProvider;
  
  constructor() {
    this.primary = resolveProvider();
    this.providerName = this.primary.providerName;
  }

  private async withFallback<T>(operation: (provider: HiringAiProvider) => Promise<T>, operationName: string): Promise<T> {
    try {
      return await operation(this.primary);
    } catch (error) {
      if (!aiConfig.fallbackEnabled || aiConfig.fallbackProvider === this.primary.providerName) {
        throw error;
      }
      
      console.warn(`[HiringAI:Fallback] ${operationName} failed with ${this.primary.providerName}. Falling back to ${aiConfig.fallbackProvider}. Error:`, error);
      const fallbackProvider = resolveProvider(aiConfig.fallbackProvider);
      return await operation(fallbackProvider);
    }
  }

  async extractResumeJson(rawText: string, fileName?: string) {
    return this.withFallback(p => p.extractResumeJson(rawText, fileName), "extractResumeJson");
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
  JdAnalysisResult,
  ResumeRankingResult,
  CandidateSummaryResult,
  RecommendationResult,
} from "./types";
