/**
 * Transcript forensic grader — post-interview deep analysis pipeline.
 * Executes a multi-signal AI evaluation of the full interview transcript
 * alongside proctoring telemetry to produce a behavioral and technical matrix.
 *
 * Provider-aware: Uses whichever AI provider is configured (Gemini or DeepSeek).
 * Falls back to DeepSeek via OpenAI-compat SDK when Gemini is unavailable.
 */

import { aiConfig } from "./config";
import { prisma } from "../prisma";
import { gradeTranscriptPrompt } from "./prompts";

// ── Shared types for the grading result ────────────────────────────────────

interface GradingResult {
  technicalScore: number;
  softSkillScore: number;
  suspicionScore: number;
  aiToneDetected: boolean;
  fraudNotes: string;
  strengths: string;
  weaknesses: string;
}

// ── Gemini path (native SDK with structured schema) ────────────────────────

async function gradeWithGemini(prompt: string): Promise<GradingResult> {
  const { GoogleGenAI, Type } = await import("@google/genai");

  const apiKey = aiConfig.gemini.apiKey ?? "";
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  const schema = {
    type: Type.OBJECT,
    properties: {
      technicalScore: { type: Type.NUMBER, description: "Technical depth score from 0-100" },
      softSkillScore: { type: Type.NUMBER, description: "Communication, tone, and empathy score 0-100" },
      suspicionScore: { type: Type.NUMBER, description: "0-100: How likely is it they cheated or used external AI?" },
      aiToneDetected: { type: Type.BOOLEAN, description: "True if the speech patterns sound like a synthesized LLM." },
      fraudNotes:     { type: Type.STRING, description: "Explanations of pauses or unusual vocabulary." },
      strengths:      { type: Type.STRING },
      weaknesses:     { type: Type.STRING },
    },
  } as const;

  const response = await ai.models.generateContent({
    model: aiConfig.gemini.model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 0.2,
    },
  });

  return JSON.parse(response.text ?? "{}");
}

// ── DeepSeek path (OpenAI-compat SDK) ──────────────────────────────────────

async function gradeWithDeepSeek(prompt: string): Promise<GradingResult> {
  const { default: OpenAI } = await import("openai");

  const apiKey = aiConfig.deepseek.apiKey ?? "";
  if (!apiKey) throw new Error("DeepSeek API key is missing.");

  const client = new OpenAI({
    baseURL: aiConfig.deepseek.baseUrl,
    apiKey,
  });

  const response = await client.chat.completions.create({
    model: aiConfig.deepseek.chatModel,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  // Parse — handle markdown wrapping
  let cleaned = raw.trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match?.[1]) cleaned = match[1].trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function gradeInterviewTranscriptOffensive(interviewId: string) {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate:  true,
        position:   true,
        violations: true,
      },
    });

    if (!interview || !interview.transcription) {
      throw new Error(
        "Interview not found or transcription is completely empty. Cannot run AI analysis."
      );
    }

    // 1. Check AI readiness
    if (!aiConfig.isReady) {
      throw new Error(
        "AI is not configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY to enable interview grading."
      );
    }

    // 2. Gather violation telemetry
    const violationSummary = interview.violations
      .map(v => `[${v.severity}] ${v.violationType}: ${v.metadata}`)
      .join("\n");

    // 3. Build prompt from registry
    const prompt = gradeTranscriptPrompt({
      transcriptText:   interview.transcription,
      violationSummary,
    });

    // 4. Dispatch to the configured provider with fallback
    let parsed: GradingResult;
    const primaryProvider = aiConfig.provider;

    try {
      if (primaryProvider === "gemini") {
        parsed = await gradeWithGemini(prompt);
      } else {
        parsed = await gradeWithDeepSeek(prompt);
      }
    } catch (primaryError) {
      console.warn(
        `[Interview Grader] Primary provider (${primaryProvider}) failed, attempting fallback...`,
        primaryError
      );

      // Try the other provider as fallback
      if (primaryProvider === "gemini" && aiConfig.deepseek.apiKey) {
        parsed = await gradeWithDeepSeek(prompt);
      } else if (primaryProvider === "deepseek" && aiConfig.gemini.apiKey) {
        parsed = await gradeWithGemini(prompt);
      } else {
        throw primaryError; // No fallback available
      }
    }

    // 5. Persist AI analysis to DB
    const analysis = await prisma.aiInterviewAnalysis.upsert({
      where:  { interviewId },
      update: {
        technicalScore: Number(parsed.technicalScore) || 0,
        softSkillScore: Number(parsed.softSkillScore) || 0,
        suspicionScore: Number(parsed.suspicionScore) || 0,
        aiToneDetected: Boolean(parsed.aiToneDetected),
        fraudNotes:     String(parsed.fraudNotes  || ""),
        strengths:      String(parsed.strengths   || ""),
        weaknesses:     String(parsed.weaknesses  || ""),
      },
      create: {
        interviewId,
        technicalScore: Number(parsed.technicalScore) || 0,
        softSkillScore: Number(parsed.softSkillScore) || 0,
        suspicionScore: Number(parsed.suspicionScore) || 0,
        aiToneDetected: Boolean(parsed.aiToneDetected),
        fraudNotes:     String(parsed.fraudNotes  || ""),
        strengths:      String(parsed.strengths   || ""),
        weaknesses:     String(parsed.weaknesses  || ""),
      },
    });

    return { success: true, analysis };
  } catch (error: any) {
    console.error("[Interview Grader] AI Evaluation failed:", error);
    return { success: false, error: error.message };
  }
}
