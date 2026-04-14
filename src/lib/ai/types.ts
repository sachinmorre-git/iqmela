/**
 * Core type definitions for the IQMela AI hiring intelligence layer.
 * All providers (Gemini, OpenAI, Claude, etc.) must conform to these interfaces.
 */

// ── Usage Tracking ──────────────────────────────────────────────────────────

export interface AiUsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  provider: string;
  model: string;
  promptVersion: string;
}

// ── Extraction ─────────────────────────────────────────────────────────────

export interface ExtractedResumeData {
  candidateName:    string | null;
  candidateEmail:   string | null;
  phoneNumber:      string | null;
  linkedinUrl:      string | null;
  location:         string | null;
  summary:          string | null;
  skills:           string[];
  experienceYears:  number | null;
  education:        Array<{ degree: string; institution: string; year: string | null }>;
  companies:        Array<{ company: string; role: string; duration: string | null }>;
  certifications?:  string[];
  projects?:        string[];
  validationWarnings?: string[];
  extractionConfidence?: number;  // 0.0 – 1.0
  rawOutput?:       Record<string, any>;
  usage?:           AiUsageData;
}

// ── JD Analysis ────────────────────────────────────────────────────────────

export interface JdAnalysisResult {
  roleTitle?:       string | null;
  seniorityLevel?:  string | null;  // e.g. "Senior", "Junior", "Manager"
  keywords:         string[];
  requiredSkills:   string[];
  preferredSkills:  string[];
  responsibilities?: string[];
  dealBreakers?:    string[];
  niceToHaveSignals?: string[];
  scoringRubric?:   Record<string, any> | string;
  seniority:        string | null;  // legacy alias
  roleType:         string | null;  // legacy alias
  structuredJd:     Record<string, any>;
  usage?:           AiUsageData;
}

// ── Ranking ────────────────────────────────────────────────────────────────

export interface ResumeRankingResult {
  matchScore:           number;   // 0–100
  matchLabel:           string;   // "STRONG_MATCH" | "GOOD_MATCH" | "WEAK_MATCH"
  jdMatchScore:         number;   // Explicit JD-specific score (mirrors matchScore for now)
  jdMatchLabel:         string;
  matchedSkills:        string[];
  missingSkills:        string[];
  rankingExplanation:   string;
  notableStrengths:     string[];
  possibleGaps:         string[];
  usage?:               AiUsageData;
}

// ── Summary ────────────────────────────────────────────────────────────────

export interface CandidateSummaryResult {
  headline:         string;   // One-line professional summary
  strengths:        string[];
  concerns:         string[];
  overallProfile:   string;   // Multi-sentence prose summary
  usage?:           AiUsageData;
}

// ── Recommendation ─────────────────────────────────────────────────────────

export interface RecommendationResult {
  recommendation:   "STRONG_HIRE" | "HIRE" | "MAYBE" | "NO_HIRE";
  rationale:        string;
  confidenceScore:  number;  // 0.0 – 1.0
  usage?:           AiUsageData;
}

// ── Interview Prep & Red Flags ─────────────────────────────────────────────

export interface InterviewFocusArea {
  topic: string;
  focus: string;
}

export interface InterviewQuestion {
  category: "Technical" | "Behavioral" | "Verification" | string;
  question: string;
  rationale: string;
}

export interface InterviewPrepResult {
  focusAreas: InterviewFocusArea[];
  questions: InterviewQuestion[];
}

export interface RedFlag {
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  description: string;
}

export interface RedFlagAnalysisResult {
  flags: RedFlag[];
}

// ── Provider Interface ──────────────────────────────────────────────────────

/**
 * The core AI provider contract.
 * Any provider (Gemini, OpenAI, Claude, Mock) must implement all of these.
 */
export interface HiringAiProvider {
  readonly providerName: string;

  /** Extract structured candidate data from raw resume text */
  extractResumeJson(rawText: string, fileName?: string): Promise<ExtractedResumeData>;

  /** Parse and structure a job description for downstream use */
  analyzeJdJson(jdText: string, positionTitle?: string): Promise<JdAnalysisResult>;

  /** Rank a candidate resume against an analyzed JD */
  rankCandidateAgainstJd(
    extracted: ExtractedResumeData,
    rawResumeText: string,
    jdText: string,
    jdAnalysis?: JdAnalysisResult
  ): Promise<ResumeRankingResult>;

  /** Generate a recruiter-friendly summary of a candidate */
  generateCandidateSummary(extracted: ExtractedResumeData): Promise<CandidateSummaryResult>;

  /** Generate a hiring recommendation based on ranking + candidate data */
  runAdvancedCandidateJudgment(
    ranking: ResumeRankingResult,
    extracted: ExtractedResumeData
  ): Promise<RecommendationResult>;

  /** Deep Candidate Analysis Pipeline */

  /** Uses the combination of JD and Candidate data to generate targeted interview questions */
  generateInterviewPrep(
    extracted: ExtractedResumeData,
    ranking: ResumeRankingResult,
    jdText: string
  ): Promise<InterviewPrepResult>;

  /** Scans the resume for logical inconsistencies, timeline gaps, or generic inflated language */
  analyzeRedFlags(
    extracted: ExtractedResumeData,
    rawText: string
  ): Promise<RedFlagAnalysisResult>;
}
