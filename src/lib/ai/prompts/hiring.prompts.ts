/**
 * src/lib/ai/prompts/hiring.prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompts for the Hiring AI pipeline (resume parsing, JD analysis, ranking,
 * candidate summary, recommendation, interview prep, red flags).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  ExtractedResumeData,
  ResumeRankingResult,
  JdAnalysisResult,
} from "@/lib/ai/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractResumeCtx {
  rawText: string;
}

export interface ExtractJdCtx {
  rawText: string;
}

export interface AnalyzeJdCtx {
  jdText:         string;
  positionTitle?: string;
}

export interface RankCandidateCtx {
  extracted:    ExtractedResumeData;
  jdText:       string;
  jdAnalysis?:  JdAnalysisResult;
}

export interface CandidateSummaryCtx {
  extracted: ExtractedResumeData;
}

export interface AdvancedJudgmentCtx {
  ranking:    ResumeRankingResult;
  extracted:  ExtractedResumeData;
}

export interface InterviewPrepCtx {
  extracted:  ExtractedResumeData;
  ranking:    ResumeRankingResult;
  jdText:     string;
}

export interface RedFlagsCtx {
  extracted:  ExtractedResumeData;
  rawText:    string;
}

// ── Prompt Functions ─────────────────────────────────────────────────────────

/**
 * Extracts structured data from raw resume text.
 * Uses Gemini responseSchema — prompt is minimal; schema enforces the shape.
 *
 * @version ext-v1
 */
export function extractResumePrompt(ctx: ExtractResumeCtx): string {
  return `You are a precise HR data extraction system. Extract structured information from the following resume text. Return only factual information visible in the text — do not infer or hallucinate data.\n\nResume text:\n${ctx.rawText}`;
}
extractResumePrompt.version = "ext-v1" as const;

/**
 * Extracts structured fields from raw job description text.
 * Uses Gemini responseSchema — prompt guides field semantics.
 *
 * @version jd-autofill-v1
 */
export function extractJdPrompt(ctx: ExtractJdCtx): string {
  return `You are an expert HR data parser. Extract structured information from the following job description text. Return only factual information visible in the text — do not infer or hallucinate data.

Rules:
- title: The exact job title (e.g. "Senior Data Engineer")
- department: Department or team (e.g. "Engineering", "Data & Analytics")
- location: Work location (e.g. "Remote", "New York, NY", "Hybrid - London")
- employmentType: Must be exactly one of: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, or null
- description: A 1-2 sentence public-facing summary suitable for a job listings page
- jdText: The full cleaned job description text, preserving all details

Job Description:
${ctx.rawText}`;
}
extractJdPrompt.version = "jd-autofill-v1" as const;

/**
 * Analyses a job description for keywords, required/preferred skills, seniority.
 *
 * @version jd-v1
 */
export function analyzeJdPrompt(ctx: AnalyzeJdCtx): string {
  return `You are an expert talent acquisitions analyst. Analyze the following job description for "${ctx.positionTitle ?? "the role"}" and extract the listed fields with precision.\n\nJob Description:\n${ctx.jdText}`;
}
analyzeJdPrompt.version = "jd-v1" as const;

/**
 * Ranks a candidate's fit against a job description. Outputs 0-100 matchScore,
 * matchLabel (STRONG_MATCH / GOOD_MATCH / WEAK_MATCH), skills diff, explanation.
 *
 * @version rank-v1
 */
export function rankCandidatePrompt(ctx: RankCandidateCtx): string {
  const jdContext = ctx.jdAnalysis
    ? `Required skills: ${ctx.jdAnalysis.requiredSkills.join(", ")}\nPreferred skills: ${ctx.jdAnalysis.preferredSkills.join(", ")}`
    : "";

  return `You are a senior technical recruiter. Evaluate this candidate's fit for the job.\n\n### Job Description:\n${ctx.jdText}\n\n${jdContext}\n\n### Candidate Profile:\nName: ${ctx.extracted.candidateName}\nSkills: ${ctx.extracted.skills.join(", ")}\nExperience: ${ctx.extracted.experienceYears} years\nSummary: ${ctx.extracted.summary}\n\nRate from 0-100. Use STRONG_MATCH (80+), GOOD_MATCH (50-79), or WEAK_MATCH (<50) for matchLabel.`;
}
rankCandidatePrompt.version = "rank-v1" as const;

/**
 * Generates a recruiter-facing candidate summary (headline, strengths, concerns).
 *
 * @version sum-v1
 */
export function generateCandidateSummaryPrompt(ctx: CandidateSummaryCtx): string {
  const { extracted: e } = ctx;
  return `Write a concise recruiter-facing summary for this candidate.\n\nName: ${e.candidateName}\nSkills: ${e.skills.join(", ")}\nExperience: ${e.experienceYears} years\nLocation: ${e.location}\nSummary: ${e.summary}\nCompanies: ${e.companies.map(c => c.company).join(", ")}`;
}
generateCandidateSummaryPrompt.version = "sum-v1" as const;

/**
 * Produces a STRONG_HIRE / HIRE / MAYBE / NO_HIRE hiring recommendation
 * based on ranking signals and candidate profile.
 *
 * @version adv-judge-v1
 */
export function runAdvancedJudgmentPrompt(ctx: AdvancedJudgmentCtx): string {
  const { ranking: r, extracted: e } = ctx;
  return `You are a hiring committee advisor. Based on the candidate's match score and profile, provide a hiring recommendation.\n\nMatch Score: ${r.matchScore}/100 (${r.matchLabel})\nMatched Skills: ${r.matchedSkills.join(", ")}\nMissing Skills: ${r.missingSkills.join(", ")}\nStrengths: ${r.notableStrengths.join(", ")}\nGaps: ${r.possibleGaps.join(", ")}\n\nUse exactly one of: STRONG_HIRE, HIRE, MAYBE, NO_HIRE for the recommendation field.`;
}
runAdvancedJudgmentPrompt.version = "adv-judge-v1" as const;

/**
 * Generates targeted interview focus areas and probing questions based on
 * candidate skills vs JD requirements.
 *
 * @version int-prep-v1
 */
export function generateInterviewPrepPrompt(ctx: InterviewPrepCtx): string {
  return `Review this candidate against the job description and generate targeted interview focus areas and structured questions.\n\n### Job Description:\n${ctx.jdText}\n\n### Candidate Skills:\nHim: ${ctx.extracted.skills.join(", ")}\nMissing: ${ctx.ranking.missingSkills.join(", ")}\n\nGenerate meaningful probing questions. Limit to 3 focus areas and 5 questions.`;
}
generateInterviewPrepPrompt.version = "int-prep-v1" as const;

/**
 * Forensic red-flag analysis of a resume — detects illogical timelines,
 * skill inflation, AI filler verbiage, missing critical info.
 *
 * @version red-flags-v1
 */
export function analyzeRedFlagsPrompt(ctx: RedFlagsCtx): string {
  return `Act as a forensic HR analyst. Review the raw resume text and extracted details for illogical timelines, massive skill inflation, repeated AI filler verbiage, or critical missing details (like no contact info).\n\nIf the resume appears completely normal, return an empty array for flags. Only flag actual suspicious findings.\n\n### Candidate Profile:\nName: ${ctx.extracted.candidateName}\nRaw Text Preview: ${ctx.rawText.substring(0, 1000)}...`;
}
analyzeRedFlagsPrompt.version = "red-flags-v1" as const;
