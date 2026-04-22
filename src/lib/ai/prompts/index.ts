/**
 * src/lib/ai/prompts/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Barrel export for the entire IQMela AI Prompt Registry.
 *
 * IMPORT GUIDE:
 *   import { candidatePrepQuestionsPrompt } from "@/lib/ai/prompts";
 *   import { interviewQuestionPlanPrompt }  from "@/lib/ai/prompts";
 *   import { extractResumePrompt }          from "@/lib/ai/prompts";
 *
 * VERSIONING:
 *   Each prompt function has a `.version` property (e.g. "prep-v1").
 *   This flows into AiUsageData.promptVersion for DB audit trails.
 *   Bump the version in the source file when making material changes.
 *
 * ADDING A NEW PROMPT:
 *   1. Create or add to the appropriate domain file (candidate/interview/hiring/forensic)
 *   2. Export it here
 *   3. Add a unit test in __tests__/ai/prompts/
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Candidate Dashboard
export {
  candidatePrepQuestionsPrompt,
  evaluateAnswerPrompt,
} from "./candidate.prompts";
export type {
  PrepQuestionsCtx,
  EvaluateAnswerCtx,
} from "./candidate.prompts";

// AI-Interview Live Session
export {
  interviewQuestionPlanPrompt,
  scoreSessionPrompt,
  evaluateFollowUpPrompt,
} from "./interview.prompts";
export type {
  ScoreSessionCtx,
} from "./interview.prompts";

// Hiring AI Pipeline
export {
  extractResumePrompt,
  extractJdPrompt,
  analyzeJdPrompt,
  rankCandidatePrompt,
  generateCandidateSummaryPrompt,
  runAdvancedJudgmentPrompt,
  generateInterviewPrepPrompt,
  analyzeRedFlagsPrompt,
} from "./hiring.prompts";
export type {
  ExtractResumeCtx,
  ExtractJdCtx,
  AnalyzeJdCtx,
  RankCandidateCtx,
  CandidateSummaryCtx,
  AdvancedJudgmentCtx,
  InterviewPrepCtx,
  RedFlagsCtx,
} from "./hiring.prompts";

// Forensic / Integrity Analysis
export {
  gradeTranscriptPrompt,
  sessionIntegrityPrompt,
} from "./forensic.prompts";
export type {
  GradeTranscriptCtx,
  IntegrityAnalysisCtx,
} from "./forensic.prompts";
