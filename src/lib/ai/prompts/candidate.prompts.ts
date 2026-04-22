/**
 * src/lib/ai/prompts/candidate.prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompts for the Candidate Dashboard AI features:
 *   - AI Prep Coach question generation
 *   - AI Prep Coach answer evaluation
 *
 * VERSION BUMP GUIDE:
 *   patch (v1 → v1.1) — wording tweaks, no functional change
 *   minor (v1 → v2)   — new output fields or changed scoring logic
 *   major (v1 → v2.0) — complete rewrite, triggers re-metrics in dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrepQuestionsCtx {
  /** The round label e.g. "Technical Round 1", "HR Screen" */
  roundLabel: string;
  /** The position title e.g. "Senior Backend Engineer" */
  positionTitle: string;
  /** Optional job description excerpt (first 700 chars used) */
  jd?: string;
}

export interface EvaluateAnswerCtx {
  /** The interview question the candidate is answering */
  question: string;
  /** The candidate's typed answer */
  userAnswer: string;
}

// ── Prompt Functions ─────────────────────────────────────────────────────────

/**
 * Generates 5 tailored prep questions for a candidate before their interview.
 * Outputs JSON: { questions: [{ question, modelAnswer }] }
 *
 * @version prep-v1
 */
export function candidatePrepQuestionsPrompt(ctx: PrepQuestionsCtx): string {
  return `You are an expert interview coach helping a candidate prepare.

Generate exactly 5 interview questions for a "${ctx.roundLabel}" round at "${ctx.positionTitle}".
${ctx.jd ? `Job description excerpt:\n${ctx.jd.slice(0, 700)}` : ""}

For each question, provide a brief model answer approach (2-3 sentences on how to structure an excellent response — STAR method, technical depth, etc.).

Return ONLY valid JSON, no markdown fences:
{
  "questions": [
    { "question": "...", "modelAnswer": "..." },
    { "question": "...", "modelAnswer": "..." },
    { "question": "...", "modelAnswer": "..." },
    { "question": "...", "modelAnswer": "..." },
    { "question": "...", "modelAnswer": "..." }
  ]
}`;
}
candidatePrepQuestionsPrompt.version = "prep-v1" as const;

/**
 * Scores a candidate's typed answer 0-100 with structured feedback and tips.
 * Outputs JSON: { score, feedback, tips[] }
 *
 * @version eval-v1
 */
export function evaluateAnswerPrompt(ctx: EvaluateAnswerCtx): string {
  return `You are an expert technical interviewer evaluating a candidate's response.

Question: ${ctx.question}

Candidate's answer: ${ctx.userAnswer}

Evaluate this answer and return ONLY valid JSON (no markdown):
{
  "score": <integer 0-100>,
  "feedback": "<2 concise sentences of direct, constructive feedback>",
  "tips": ["<specific, actionable improvement tip>", "<another specific tip>"]
}

Scoring guide:
- 90-100: Exceptional — complete, precise, well-structured with examples
- 75-89:  Strong — covers main points, mostly well articulated
- 60-74:  Adequate — relevant but missing depth or examples
- 40-59:  Needs work — partially relevant, significant gaps
- 0-39:   Insufficient — off-topic, fundamentally incorrect, or too brief`;
}
evaluateAnswerPrompt.version = "eval-v1" as const;
