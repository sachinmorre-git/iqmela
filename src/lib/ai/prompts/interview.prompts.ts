/**
 * src/lib/ai/prompts/interview.prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompts for the AI-Interview live session engine:
 *   - Question plan generation
 *   - Full session scoring
 *   - Follow-up evaluation
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  QuestionPlanContext,
  FollowUpContext,
} from "@/lib/ai-interview/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScoreSessionCtx {
  context: QuestionPlanContext;
  /** Pre-formatted transcript string: "Q1 [TECHNICAL]: ...\nA1: ..." */
  turnsText: string;
}

// ── Prompt Functions ─────────────────────────────────────────────────────────

/**
 * Generates a structured question plan for an AI-led interview.
 * Outputs JSON: { questions: [{ category, question, rationale }] }
 *
 * @version plan-v1
 */
export function interviewQuestionPlanPrompt(ctx: QuestionPlanContext): string {
  const counts = {
    intro:      ctx.questionCounts?.intro      ?? 2,
    technical:  ctx.questionCounts?.technical  ?? 4,
    behavioral: ctx.questionCounts?.behavioral ?? 3,
  };

  return `You are an expert technical interviewer at a top-tier tech company.
Generate a structured interview question plan for the following candidate and role.

CANDIDATE: ${ctx.candidateName ?? "Unknown"}
ROLE: ${ctx.positionTitle ?? "Software Engineer"}
CANDIDATE SKILLS: ${ctx.skills?.join(", ") ?? "Not provided"}
CANDIDATE SUMMARY: ${ctx.candidateSummary ?? "Not provided"}
JOB DESCRIPTION (excerpt):
${ctx.jdText ? ctx.jdText.slice(0, 2000) : "Not provided"}

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
}
interviewQuestionPlanPrompt.version = "plan-v1" as const;

/**
 * Scores a full completed interview session.
 * Outputs JSON: { perAnswer[], overallScore, recommendation, executiveSummary }
 *
 * @version score-v1
 */
export function scoreSessionPrompt(ctx: ScoreSessionCtx): string {
  return `You are a senior hiring manager evaluating a candidate interview transcript.

ROLE: ${ctx.context.positionTitle ?? "Software Engineer"}
CANDIDATE: ${ctx.context.candidateName ?? "Unknown"}
REQUIRED SKILLS: ${ctx.context.skills?.join(", ") ?? "Not specified"}

FULL INTERVIEW TRANSCRIPT:
${ctx.turnsText}

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
}
scoreSessionPrompt.version = "score-v1" as const;

/**
 * Evaluates whether a follow-up question is warranted after a candidate answer.
 * Outputs JSON: { shouldFollowUp, followUpQuestion }
 *
 * @version followup-v1
 */
export function evaluateFollowUpPrompt(ctx: FollowUpContext): string {
  return `You are an expert interviewer evaluating whether a candidate's answer needs ONE brief follow-up question.

ROLE: ${ctx.positionTitle}
QUESTION CATEGORY: ${ctx.questionCategory}
ORIGINAL QUESTION: ${ctx.questionText}
CANDIDATE'S ANSWER: ${ctx.candidateAnswer}

JOB DESCRIPTION (excerpt):
${ctx.jdText ? ctx.jdText.slice(0, 1500) : "Not provided"}

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
}
evaluateFollowUpPrompt.version = "followup-v1" as const;

// ── Decision Brief Prompt ────────────────────────────────────────────────────

export interface DecisionBriefContext {
  roundLabel: string;
  candidateName: string;
  panelistSummaries: Array<{
    name: string;
    score: number;
    recommendation: string;
    summary: string;
  }>;
  leadFeedback?: {
    rating: number;
    recommendation: string;
    summary: string;
  };
  aiSession?: {
    score: number | null;
    recommendation: string | null;
    summary: string | null;
  };
  behaviorHighlights?: {
    integrityScore: number | null;
    flagCount: number;
  };
}

/**
 * Generates a concise 2-sentence AI decision brief from all available
 * round intelligence data. Designed for Hiring Managers to get an instant
 * summary without reading every individual scorecard.
 *
 * @version decision-brief-v1
 */
export function decisionBriefPrompt(ctx: DecisionBriefContext): {
  system: string;
  user: string;
  version: string;
} {
  // ── Build the data payload for the user prompt ──────────────────────────
  const sections: string[] = [];

  // Panelist scorecards
  if (ctx.panelistSummaries.length > 0) {
    const panelistBlock = ctx.panelistSummaries
      .map(
        (p) =>
          `- ${p.name}: ${p.score}/100, recommends ${p.recommendation}. "${p.summary}"`
      )
      .join("\n");
    sections.push(`PANELIST SCORECARDS (${ctx.panelistSummaries.length} panelists):\n${panelistBlock}`);
  }

  // Lead interviewer feedback
  if (ctx.leadFeedback) {
    sections.push(
      `LEAD INTERVIEWER FEEDBACK:\n- Rating: ${ctx.leadFeedback.rating}/100, recommends ${ctx.leadFeedback.recommendation}. "${ctx.leadFeedback.summary}"`
    );
  }

  // AI interview session
  if (ctx.aiSession) {
    sections.push(
      `AI INTERVIEW SESSION:\n- Score: ${ctx.aiSession.score ?? "N/A"}/100, recommendation: ${ctx.aiSession.recommendation ?? "N/A"}${ctx.aiSession.summary ? `. "${ctx.aiSession.summary}"` : ""}`
    );
  }

  // Behavior report highlights
  if (ctx.behaviorHighlights) {
    sections.push(
      `BEHAVIOR ANALYSIS:\n- Integrity score: ${ctx.behaviorHighlights.integrityScore ?? "N/A"}/100, ${ctx.behaviorHighlights.flagCount} behavior flag(s) detected`
    );
  }

  const dataBlock = sections.join("\n\n");

  return {
    system: `You are a senior HR analytics advisor. Your job is to write an extremely concise 2-sentence decision brief for a Hiring Manager reviewing interview round results.

RULES:
- Exactly 2 sentences. No more.
- Sentence 1: State the consensus (unanimous / split), composite score, and overall recommendation direction.
- Sentence 2: Highlight the single most important strength AND (if any) the single most important concern.
- Never use filler words. Be direct and data-driven.
- If there are behavior flags, always mention them in sentence 2.
- Use the panelist names naturally (first name only).
- Write in present tense, professional tone.`,

    user: `ROUND: ${ctx.roundLabel}
CANDIDATE: ${ctx.candidateName}

${dataBlock}

Write the 2-sentence decision brief:`,

    version: "decision-brief-v1",
  };
}
decisionBriefPrompt.version = "decision-brief-v1" as const;

// ═══════════════════════════════════════════════════════════════════════════
// BGV Report Summary Prompt
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a structured BGV report summary from extracted report text.
 * Output: executive summary + per-check JSON findings + risk assessment.
 */
export function bgvReportSummaryPrompt(ctx: {
  reportText: string;
  checksRequested: string[];
  candidateName: string;
}) {
  const checksList = ctx.checksRequested.length > 0
    ? ctx.checksRequested.join(", ")
    : "all available checks";

  return {
    system: `You are a Background Verification analyst AI for a hiring platform. Analyze the BGV report text and produce a structured summary.

IMPORTANT RULES:
1. Report ONLY factual findings from the document — never fabricate details.
2. If a check type is mentioned but results are unclear, set status to "pending".
3. For criminal checks: distinguish between no records found vs. records found.
4. For education/employment: extract institution name, degree/title, and dates if available.
5. Never include SSNs, DOBs, addresses, or other sensitive PII in your output.
6. Keep the executive summary under 3 sentences.

OUTPUT FORMAT (respond with ONLY valid JSON, no markdown):
{
  "executiveSummary": "2-3 sentence overview of all findings",
  "findings": [
    {
      "checkType": "criminal",
      "status": "clear" | "consider" | "pending" | "error",
      "summary": "One-line summary of this check's result",
      "details": "Optional additional context"
    }
  ],
  "riskAssessment": "CLEAR" | "CAUTION" | "RED_FLAG",
  "recommendation": "1-sentence hiring recommendation"
}`,

    user: `CANDIDATE: ${ctx.candidateName}
CHECKS REQUESTED: ${checksList}

REPORT TEXT:
${ctx.reportText.slice(0, 10000)}

Analyze this BGV report and produce the JSON summary:`,

    version: "bgv-summary-v1",
  };
}
bgvReportSummaryPrompt.version = "bgv-summary-v1" as const;
