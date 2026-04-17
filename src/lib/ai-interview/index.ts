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

function resolveProvider(): AiInterviewProvider {
  const rawProvider = process.env.AI_PROVIDER?.toLowerCase() ?? "";
  const geminiKey = process.env.GEMINI_API_KEY;

  // Explicit mock
  if (rawProvider === "mock") {
    return new MockAiInterviewProvider();
  }

  // Gemini (primary)
  if (rawProvider === "gemini" && geminiKey) {
    return new GeminiAiInterviewProvider();
  }

  // Auto-detect: use Gemini if key present
  if (geminiKey) {
    return new GeminiAiInterviewProvider();
  }

  // Fallback
  const fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== "false";
  if (!fallbackEnabled) {
    throw new Error("[AiInterview] AI_FALLBACK_ENABLED=false but no valid provider configured.");
  }

  console.warn("[AiInterview] No API key found — using mock provider.");
  return new MockAiInterviewProvider();
}

export const aiInterviewer: AiInterviewProvider = resolveProvider();

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
