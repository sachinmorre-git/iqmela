/**
 * Gemini AI Interview Provider
 * Uses the same @google/genai SDK and GEMINI_API_KEY already configured.
 */

import { GoogleGenAI } from "@google/genai";
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

// Utility — parse JSON from a Gemini response that may wrap it in markdown
function extractJson<T>(raw: string): T {
  // Try to find the bounding braces of the JSON object instead of just stripping markdown
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in the response string.");
  }
  return JSON.parse(match[0]) as T;
}

export class GeminiAiInterviewProvider implements AiInterviewProvider {
  readonly providerName = "gemini";
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("[GeminiAiInterview] GEMINI_API_KEY is not set.");
    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_AI_INTERVIEW_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async generateQuestionPlan(context: QuestionPlanContext): Promise<AiInterviewPlan> {
    const counts = {
      intro: context.questionCounts?.intro ?? 2,
      technical: context.questionCounts?.technical ?? 4,
      behavioral: context.questionCounts?.behavioral ?? 3,
    };

    const prompt = `You are an expert technical interviewer at a top-tier tech company.
Generate a structured interview question plan for the following candidate and role.

CANDIDATE: ${context.candidateName ?? "Unknown"}
ROLE: ${context.positionTitle ?? "Software Engineer"}
CANDIDATE SKILLS: ${context.skills?.join(", ") ?? "Not provided"}
CANDIDATE SUMMARY: ${context.candidateSummary ?? "Not provided"}
JOB DESCRIPTION (excerpt):
${context.jdText ? context.jdText.slice(0, 2000) : "Not provided"}

Generate exactly:
- ${counts.intro} INTRO questions (warm up, background)
- ${counts.technical} TECHNICAL questions (role-specific, skill-probing)
- ${counts.behavioral} BEHAVIORAL questions (STAR format situations)
- 1 CLOSING question (invite candidate questions)

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{
  "questions": [
    {
      "category": "INTRO" | "TECHNICAL" | "BEHAVIORAL" | "CLOSING",
      "question": "<the question text>",
      "rationale": "<1 sentence why this question>"
    }
  ]
}

Rules:
- Questions must be specific to the role and candidate's background
- Technical questions must probe the actual skills listed
- Behavioral questions must use STAR-style prompting ("Tell me about a time...")
- Never ask about salary, age, family, or protected characteristics
- Keep questions concise and conversational (≤2 sentences each)`;

    const result = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        temperature: 0.4, 
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
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
        provider: "gemini",
        model: this.model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
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
        overallScore: 0,
        recommendation: "NO_HIRE",
        executiveSummary: "The candidate did not provide any answers.",
        perAnswer: [],
      };
    }

    const turnsText = turns
      .map(
        (t, i) =>
          `Q${i + 1} [${t.category}]: ${t.question}\nA${i + 1}: ${t.candidateAnswer || "(no answer provided)"}`
      )
      .join("\n\n");

    const prompt = `You are a senior hiring manager evaluating a candidate interview transcript.

ROLE: ${context.positionTitle ?? "Software Engineer"}
CANDIDATE: ${context.candidateName ?? "Unknown"}
REQUIRED SKILLS: ${context.skills?.join(", ") ?? "Not specified"}

FULL INTERVIEW TRANSCRIPT:
${turnsText}

Score each answer and then produce a final assessment.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{
  "perAnswer": [
    {
      "turnIndex": 0,
      "scoreRaw": <integer 0-10>,
      "scoreFeedback": "<1-2 sentences of specific, constructive feedback>",
      "strengths": ["<strength 1>", "<strength 2>"],
      "gaps": ["<gap 1>"],
      "suspiciousFlags": [] // Output ANY of these if applicable: "TOO_SHORT", "IRRELEVANT", "COPIED", "ROBOTIC", "NON_RESPONSIVE". Leave empty if normal.
    }
  ],
  "overallScore": <integer 0-100>,
  "recommendation": "STRONG_HIRE" | "HIRE" | "MAYBE" | "WEAK_FIT" | "NEEDS_HUMAN_REVIEW" | "NO_HIRE",
  "executiveSummary": "<2-3 sentence overall assessment for the hiring team>"
}

Scoring guide (scoreRaw):
- 9-10: Exceptional, exceeds expectations with concrete examples and deep insight
- 7-8: Strong, clear and relevant with good specificity  
- 5-6: Adequate, meets bar but lacks depth or specifics
- 3-4: Below expectations, vague or tangential  
- 0-2: Unsatisfactory, no relevant answer given

overallScore = weighted average of scoreRaw values scaled to 0-100.
recommendation thresholds: overallScore ≥80 → STRONG_HIRE, ≥65 → HIRE, ≥45 → MAYBE, ≥30 → WEAK_FIT, <30 → NO_HIRE. Use NEEDS_HUMAN_REVIEW if flags indicate robotic/copied behavior.`;

    const result = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        temperature: 0.2, 
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      },
    });

    const raw = result.text ?? "";
    let parsed: {
      perAnswer: AiAnswerScore[];
      overallScore: number;
      recommendation: AiRecommendation;
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
        provider: "gemini",
        model: this.model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
        estimatedCost: ((usage?.totalTokenCount ?? 0) / 1_000_000) * 0.15,
      },
    };
  }

  // ── Follow-up evaluation (Step 204 & 205) ──────────────────────────────────

  async evaluateFollowUp(context: FollowUpContext): Promise<FollowUpResult> {
    const prompt = `You are an expert interviewer evaluating whether a candidate's answer needs ONE brief follow-up question.

ROLE: ${context.positionTitle}
QUESTION CATEGORY: ${context.questionCategory}
ORIGINAL QUESTION: ${context.questionText}
CANDIDATE'S ANSWER: ${context.candidateAnswer}

JOB DESCRIPTION (excerpt):
${context.jdText ? context.jdText.slice(0, 1500) : "Not provided"}

Evaluate the answer and decide if a SINGLE follow-up question is needed.

RETURN shouldFollowUp: true ONLY if:
1. The answer is vague, generic, or lacks specific technical details that the role requires.
2. The candidate mentioned a specific tool, framework, or scenario that would benefit from a brief probe.
3. The answer contradicts something in their background that should be clarified.

RETURN shouldFollowUp: false if:
1. The answer is already detailed and concrete with specific examples.
2. The question was an INTRO or CLOSING question (no follow-up needed).
3. The answer is a simple factual statement that doesn't need elaboration.
4. The candidate gave a comprehensive answer with metrics, outcomes, or clear reasoning.

GUARDRAILS — The follow-up question MUST:
- Be strictly relevant to the job description and professional context.
- Be under 25 words.
- NEVER ask about age, gender, race, religion, family, salary, health, or any legally protected characteristic.
- NEVER repeat or rephrase the original question.
- Be conversational and encouraging in tone.

Return ONLY valid JSON — no markdown, no explanation:
{
  "shouldFollowUp": true | false,
  "followUpQuestion": "<the follow-up question text or empty string if shouldFollowUp is false>"
}`;

    const result = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        temperature: 0.2, 
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
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
      shouldFollowUp: !!parsed.shouldFollowUp,
      followUpQuestion: parsed.followUpQuestion || undefined,
      usage: {
        provider: "gemini",
        model: this.model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
        estimatedCost: ((usage?.totalTokenCount ?? 0) / 1_000_000) * 0.15,
      },
    };
  }
}
