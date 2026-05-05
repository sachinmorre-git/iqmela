/**
 * Deepseek AI Interview Provider
 */

import OpenAI from "openai";
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

export class DeepseekAiInterviewProvider implements AiInterviewProvider {
  readonly providerName = "deepseek";
  private model: string;
  private ai: OpenAI;

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn("[DeepseekAiInterview] DEEPSEEK_API_KEY is not set.");
    }
    
    this.model = process.env.DEEPSEEK_AI_INTERVIEW_MODEL ?? "deepseek-chat";
    this.ai = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: apiKey || "MISSING",
    });
  }

  private parseJsonFromOutput(rawText: string): any {
    let cleanText = rawText.trim();
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let extracted = match && match[1] ? match[1].trim() : cleanText;
    const firstBrace = extracted.indexOf('{');
    const lastBrace = extracted.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      extracted = extracted.substring(firstBrace, lastBrace + 1);
    }
    try {
      return JSON.parse(extracted);
    } catch (e) {
      try {
        let repaired = extracted
          .replace(/'/g, '"')
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\n\r]/g, ' ')
          .replace(/\\"/g, '"')
          .replace(/\s+/g, ' ');
        return JSON.parse(repaired);
      } catch (repairErr) {
        throw new Error("AI returned malformed JSON that could not be repaired.");
      }
    }
  }

  async generateQuestionPlan(context: QuestionPlanContext): Promise<AiInterviewPlan> {
    const prompt = interviewQuestionPlanPrompt(context) + "\n\nReturn strictly a JSON object.";

    const response = await this.ai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let questions: AiInterviewQuestion[];

    try {
      const parsed = this.parseJsonFromOutput(raw);
      questions = parsed.questions || parsed;
    } catch (err) {
      console.error("[DeepseekAiInterview] Failed to parse question plan JSON:", raw, err);
      throw new Error("AI returned malformed question plan. Please retry.");
    }

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const estimatedCost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;

    return {
      questions,
      usage: {
        provider: "deepseek",
        model: this.model,
        promptVersion: interviewQuestionPlanPrompt.version,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
      },
    };
  }

  async scoreSession(context: QuestionPlanContext, turns: TranscriptTurn[]): Promise<AiInterviewSummary> {
    if (turns.length === 0) {
      return {
        overallScore: 0,
        recommendation: "NO_HIRE",
        executiveSummary: "The candidate did not provide any answers.",
        perAnswer: [],
      };
    }

    const turnsText = turns.map((t, i) => `Q${i + 1} [${t.category}]: ${t.question}\nA${i + 1}: ${t.candidateAnswer || "(no answer provided)"}`).join("\n\n");
    const prompt = scoreSessionPrompt({ context, turnsText }) + "\n\nReturn strictly a JSON object.";

    const response = await this.ai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: any;

    try {
      parsed = this.parseJsonFromOutput(raw);
    } catch (err) {
      console.error("[DeepseekAiInterview] Failed to parse score JSON:", raw, err);
      throw new Error("AI returned malformed scoring response. Please retry.");
    }

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const estimatedCost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;

    return {
      overallScore: parsed.overallScore ?? 0,
      recommendation: parsed.recommendation ?? "NO_HIRE",
      executiveSummary: parsed.executiveSummary ?? "",
      perAnswer: parsed.perAnswer ?? [],
      usage: {
        provider: "deepseek",
        model: this.model,
        promptVersion: scoreSessionPrompt.version,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
      },
    };
  }

  async evaluateFollowUp(context: FollowUpContext): Promise<FollowUpResult> {
    const prompt = evaluateFollowUpPrompt(context) + "\n\nReturn strictly a JSON object.";

    const response = await this.ai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: any;

    try {
      parsed = this.parseJsonFromOutput(raw);
    } catch (err) {
      console.error("[DeepseekAiInterview] Failed to parse follow-up JSON:", raw, err);
      return { shouldFollowUp: false };
    }

    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const totalTokens = response.usage?.total_tokens ?? 0;
    const estimatedCost = (inputTokens / 1_000_000) * 0.14 + (outputTokens / 1_000_000) * 0.28;

    return {
      shouldFollowUp: !!parsed.shouldFollowUp,
      followUpQuestion: parsed.followUpQuestion || undefined,
      usage: {
        provider: "deepseek",
        model: this.model,
        promptVersion: evaluateFollowUpPrompt.version,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
      },
    };
  }
}
