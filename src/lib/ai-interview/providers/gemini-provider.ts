/**
 * Gemini AI Interview Provider
 * Uses the shared geminiClient singleton and prompts from the registry.
 */

import { geminiClient } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/utils";
import {
  interviewQuestionPlanPrompt,
  scoreSessionPrompt,
  evaluateFollowUpPrompt,
} from "@/lib/ai/prompts";
import type {
  AiInterviewProvider,
  AiInterviewPlan,
  AiInterviewQuestion,
  AiInterviewSummary,
  AiAnswerScore,
  AiRecommendation,
  QuestionPlanContext,
  TranscriptTurn,
  FollowUpContext,
  FollowUpResult,
} from "../types";

export class GeminiAiInterviewProvider implements AiInterviewProvider {
  readonly providerName = "gemini";
  private model: string;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("[GeminiAiInterview] GEMINI_API_KEY is not set.");
    }
    this.model =
      process.env.GEMINI_AI_INTERVIEW_MODEL ??
      process.env.GEMINI_MODEL ??
      "gemini-2.0-flash";
  }

  async generateQuestionPlan(context: QuestionPlanContext): Promise<AiInterviewPlan> {
    const prompt = interviewQuestionPlanPrompt(context);

    const result = await geminiClient.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature:      0.4,
        maxOutputTokens:  8192,
        responseMimeType: "application/json",
      },
    });

    const raw = result.text ?? "";
    let questions: AiInterviewQuestion[];

    try {
      const parsed = extractJson<{ questions: AiInterviewQuestion[] }>(raw);
      questions = parsed.questions;
    } catch (err) {
      console.error("[GeminiAiInterview] Failed to parse question plan JSON:", raw, err);
      throw new Error("AI returned malformed question plan. Please retry.");
    }

    const usage = result.usageMetadata;
    return {
      questions,
      usage: {
        provider:      "gemini",
        model:         this.model,
        promptVersion: interviewQuestionPlanPrompt.version,
        inputTokens:   usage?.promptTokenCount      ?? 0,
        outputTokens:  usage?.candidatesTokenCount  ?? 0,
        totalTokens:   usage?.totalTokenCount       ?? 0,
        estimatedCost: ((usage?.totalTokenCount ?? 0) / 1_000_000) * 0.15,
      },
    };
  }

  async scoreSession(
    context: QuestionPlanContext,
    turns: TranscriptTurn[]
  ): Promise<AiInterviewSummary> {
    if (turns.length === 0) {
      return {
        overallScore:     0,
        recommendation:   "NO_HIRE",
        executiveSummary: "The candidate did not provide any answers.",
        perAnswer:        [],
      };
    }

    const turnsText = turns
      .map(
        (t, i) =>
          `Q${i + 1} [${t.category}]: ${t.question}\nA${i + 1}: ${t.candidateAnswer || "(no answer provided)"}`
      )
      .join("\n\n");

    const prompt = scoreSessionPrompt({ context, turnsText });

    const result = await geminiClient.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature:      0.2,
        maxOutputTokens:  8192,
        responseMimeType: "application/json",
      },
    });

    const raw = result.text ?? "";
    let parsed: {
      perAnswer:        AiAnswerScore[];
      overallScore:     number;
      recommendation:   AiRecommendation;
      executiveSummary: string;
    };

    try {
      parsed = extractJson(raw);
    } catch (err) {
      console.error("[GeminiAiInterview] Failed to parse score JSON:", raw, err);
      throw new Error("AI returned malformed scoring response. Please retry.");
    }

    const usage = result.usageMetadata;
    return {
      ...parsed,
      usage: {
        provider:      "gemini",
        model:         this.model,
        promptVersion: scoreSessionPrompt.version,
        inputTokens:   usage?.promptTokenCount      ?? 0,
        outputTokens:  usage?.candidatesTokenCount  ?? 0,
        totalTokens:   usage?.totalTokenCount       ?? 0,
        estimatedCost: ((usage?.totalTokenCount ?? 0) / 1_000_000) * 0.15,
      },
    };
  }

  // ── Follow-up evaluation ─────────────────────────────────────────────────

  async evaluateFollowUp(context: FollowUpContext): Promise<FollowUpResult> {
    const prompt = evaluateFollowUpPrompt(context);

    const result = await geminiClient.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature:      0.2,
        maxOutputTokens:  1024,
        responseMimeType: "application/json",
      },
    });

    const raw = result.text ?? "";
    let parsed: { shouldFollowUp: boolean; followUpQuestion?: string };

    try {
      parsed = extractJson(raw);
    } catch (err) {
      console.error("[GeminiAiInterview] Failed to parse follow-up JSON:", raw, err);
      // On parse failure, safely skip follow-up
      return { shouldFollowUp: false };
    }

    const usage = result.usageMetadata;
    return {
      shouldFollowUp:    !!parsed.shouldFollowUp,
      followUpQuestion:  parsed.followUpQuestion || undefined,
      usage: {
        provider:      "gemini",
        model:         this.model,
        promptVersion: evaluateFollowUpPrompt.version,
        inputTokens:   usage?.promptTokenCount      ?? 0,
        outputTokens:  usage?.candidatesTokenCount  ?? 0,
        totalTokens:   usage?.totalTokenCount       ?? 0,
        estimatedCost: ((usage?.totalTokenCount ?? 0) / 1_000_000) * 0.15,
      },
    };
  }
}
