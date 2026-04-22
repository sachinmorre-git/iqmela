/**
 * Core type definitions for the IQMela AI Avatar Interview system.
 * All providers (Gemini, OpenAI, Mock) must conform to these interfaces.
 * No vendor-specific types leak into this file.
 */

// ── Context passed to question generator ───────────────────────────────────

export interface QuestionPlanContext {
  /** Candidate's name (used to personalise questions) */
  candidateName?: string | null;
  /** Job title / role being interviewed for */
  positionTitle?: string | null;
  /** Full job description text */
  jdText?: string | null;
  /** Skills extracted from the candidate's resume */
  skills?: string[];
  /** Brief candidate summary from resume extraction */
  candidateSummary?: string | null;
  /** Number of questions per category (defaults used if omitted) */
  questionCounts?: {
    intro?: number;       // default: 2
    technical?: number;   // default: 4
    behavioral?: number;  // default: 3
  };
}

// ── Question plan ───────────────────────────────────────────────────────────

export type AiQuestionCategory = 'INTRO' | 'TECHNICAL' | 'BEHAVIORAL' | 'CLOSING';

export interface AiInterviewQuestion {
  category: AiQuestionCategory;
  question: string;
  /** Why this question was chosen — used for scoring context, not shown to candidate */
  rationale?: string;
}

export interface AiInterviewPlan {
  questions: AiInterviewQuestion[];
  usage?: AiInterviewUsageData;
}

// ── Transcript turn ─────────────────────────────────────────────────────────

export interface TranscriptTurn {
  turnIndex: number;
  category: AiQuestionCategory;
  question: string;
  candidateAnswer: string;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface AiAnswerScore {
  turnIndex: number;
  scoreRaw: number;          // 0–10
  scoreFeedback: string;     // 1–2 sentence feedback
  strengths: string[];
  gaps: string[];
  suspiciousFlags?: string[]; // E.g. TOO_SHORT, ROBOTIC, COPIED
}

export type AiRecommendation = 'STRONG_HIRE' | 'HIRE' | 'MAYBE' | 'WEAK_FIT' | 'NEEDS_HUMAN_REVIEW' | 'NO_HIRE';

export interface AiInterviewSummary {
  overallScore: number;              // 0–100 (average of per-answer scores scaled up)
  recommendation: AiRecommendation;
  executiveSummary: string;          // 2–3 sentence overall assessment
  perAnswer: AiAnswerScore[];
  usage?: AiInterviewUsageData;
}

// ── Usage tracking ──────────────────────────────────────────────────────────

export interface AiInterviewUsageData {
  provider:       string;
  model:          string;
  inputTokens:    number;
  outputTokens:   number;
  totalTokens:    number;
  estimatedCost:  number;
  /** Prompt version tag for audit tracking e.g. "plan-v1", "score-v1" */
  promptVersion?: string;
}

// ── Follow-up evaluation ────────────────────────────────────────────────────

export interface FollowUpContext {
  positionTitle: string;
  jdText?: string | null;
  questionCategory: AiQuestionCategory;
  questionText: string;
  candidateAnswer: string;
}

export interface FollowUpResult {
  shouldFollowUp: boolean;
  followUpQuestion?: string;
  usage?: AiInterviewUsageData;
}

// ── Provider Interface ──────────────────────────────────────────────────────

/**
 * The core AI Interview provider contract.
 * Any provider (Gemini, OpenAI, Mock, Tavus-backed, etc.) must implement this.
 */
export interface AiInterviewProvider {
  readonly providerName: string;

  /**
   * Generates a structured list of interview questions based on the
   * candidate and position context.
   */
  generateQuestionPlan(context: QuestionPlanContext): Promise<AiInterviewPlan>;

  /**
   * Scores every answer in the session and returns a final summary.
   * Called once after the candidate finishes the full interview.
   */
  scoreSession(
    context: QuestionPlanContext,
    turns: TranscriptTurn[]
  ): Promise<AiInterviewSummary>;

  /**
   * Evaluates whether a follow-up question should be asked based on
   * the candidate's answer. Returns the follow-up question if needed.
   * (Step 204)
   */
  evaluateFollowUp(context: FollowUpContext): Promise<FollowUpResult>;
}
