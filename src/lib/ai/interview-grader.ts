/**
 * Transcript forensic grader — post-interview deep analysis pipeline.
 * Executes a multi-signal AI evaluation of the full interview transcript
 * alongside proctoring telemetry to produce a behavioral and technical matrix.
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { aiConfig } from "./config";
import { prisma } from "../prisma";
import { gradeTranscriptPrompt } from "./prompts";

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

    // 1. Gather violation telemetry
    const violationSummary = interview.violations
      .map(v => `[${v.severity}] ${v.violationType}: ${v.metadata}`)
      .join("\n");

    // 2. Build prompt from registry
    const prompt = gradeTranscriptPrompt({
      transcriptText:   interview.transcription,
      violationSummary,
    });

    // 3. Initialize Gemini client (uses aiConfig.gemini.apiKey)
    const apiKey = aiConfig.gemini.apiKey ?? "";
    if (!apiKey) throw new Error("Gemini API key is missing. Deep Proctor Analysis requires cloud logic.");
    const ai = new GoogleGenAI({ apiKey });

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        technicalScore: { type: Type.NUMBER,  description: "Technical depth score from 0-100" },
        softSkillScore: { type: Type.NUMBER,  description: "Communication, tone, and empathy score 0-100" },
        suspicionScore: { type: Type.NUMBER,  description: "0-100: How likely is it they cheated or used external AI?" },
        aiToneDetected: { type: Type.BOOLEAN, description: "True if the speech patterns sound like a synthesized LLM." },
        fraudNotes:     { type: Type.STRING,  description: "Explanations of pauses or unusual vocabulary." },
        strengths:      { type: Type.STRING },
        weaknesses:     { type: Type.STRING },
      },
    };

    // 4. Dispatch to Gemini
    const response = await ai.models.generateContent({
      model: aiConfig.gemini.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema:   schema,
        temperature:      0.2, // Low temperature for forensic determinism
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");

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
