/**
 * AI Model Registry & Task Type Definitions
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all supported AI models and task types.
 * Import these constants in both backend (model-router) and frontend (config UI).
 */

// ── Model Definitions ────────────────────────────────────────────────────────

export interface AiModelMeta {
  provider: "GEMINI" | "DEEPSEEK" | "OPENAI" | "ANTHROPIC";
  label: string;
  cost: "$" | "$$" | "$$$";
  speed: "Ultra-Fast" | "Fast" | "Moderate" | "Slow";
  intelligence: "Good" | "High" | "Very High" | "Master";
  inputCostPer1M: number;   // USD per 1M input tokens
  outputCostPer1M: number;  // USD per 1M output tokens
  emoji: string;
}

export const AI_MODELS: Record<string, AiModelMeta> = {
  // ── Gemini Family ──────────────────────────────────────────────────────────
  "gemini-2.5-flash": {
    provider: "GEMINI",
    label: "Gemini 2.5 Flash",
    cost: "$",
    speed: "Ultra-Fast",
    intelligence: "High",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    emoji: "⚡",
  },
  "gemini-2.5-pro": {
    provider: "GEMINI",
    label: "Gemini 2.5 Pro",
    cost: "$$$",
    speed: "Moderate",
    intelligence: "Master",
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
    emoji: "🧠",
  },
  "gemini-2.0-flash": {
    provider: "GEMINI",
    label: "Gemini 2.0 Flash",
    cost: "$",
    speed: "Ultra-Fast",
    intelligence: "Good",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    emoji: "💨",
  },

  // ── DeepSeek Family ────────────────────────────────────────────────────────
  "deepseek-chat": {
    provider: "DEEPSEEK",
    label: "DeepSeek V3",
    cost: "$",
    speed: "Fast",
    intelligence: "Very High",
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
    emoji: "🟣",
  },
  "deepseek-reasoner": {
    provider: "DEEPSEEK",
    label: "DeepSeek Reasoner",
    cost: "$$",
    speed: "Slow",
    intelligence: "Master",
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    emoji: "🔮",
  },
} as const;

export type AiModelId = keyof typeof AI_MODELS;

/** All model IDs as an array (for dropdowns) */
export const AI_MODEL_IDS = Object.keys(AI_MODELS) as AiModelId[];

// ── Task Type Definitions ────────────────────────────────────────────────────

export interface AiTaskMeta {
  key: string;
  label: string;
  desc: string;
  icon: string;
  /** Which schema field stores this task's model chain */
  schemaField: string;
}

export const AI_TASK_TYPES: AiTaskMeta[] = [
  { key: "extraction",       label: "Resume Extraction",   desc: "Parse PDF/DOCX → structured candidate data",    icon: "📄", schemaField: "extractionModels" },
  { key: "ranking",          label: "Candidate Ranking",   desc: "Score candidates against JD requirements",       icon: "📊", schemaField: "rankingModels" },
  { key: "judgment",         label: "Advanced Judgment",    desc: "Deep analysis, skill assessment, culture fit",   icon: "🧠", schemaField: "judgmentModels" },
  { key: "jdAnalysis",       label: "JD Analysis",         desc: "Parse job descriptions, extract requirements",   icon: "📋", schemaField: "jdAnalysisModels" },
  { key: "interviewScore",   label: "Interview Scoring",   desc: "Score AI interview answers",                     icon: "🎯", schemaField: "interviewScoreModels" },
  { key: "codingGen",        label: "Coding Questions",    desc: "Generate coding challenges and test cases",      icon: "💻", schemaField: "codingGenModels" },
  { key: "interviewPrep",    label: "Interview Prep",      desc: "Generate targeted questions for interviewers",   icon: "📝", schemaField: "interviewPrepModels" },
  { key: "redFlags",         label: "Red Flag Analysis",   desc: "Detect timeline gaps, inflated claims",          icon: "🚩", schemaField: "redFlagModels" },
  { key: "candidateSummary", label: "Candidate Summary",   desc: "Generate recruiter-friendly candidate profile",  icon: "👤", schemaField: "candidateSummaryModels" },
];

export type AiTaskKey = (typeof AI_TASK_TYPES)[number]["key"];

// ── Model Chain Type ─────────────────────────────────────────────────────────

export interface ModelChain {
  primary: AiModelId;
  fallback1: AiModelId | null;
  fallback2: AiModelId | null;
}

// ── Default Model Chains ─────────────────────────────────────────────────────

export const DEFAULT_MODEL_CHAINS: Record<string, ModelChain> = {
  extraction:       { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  ranking:          { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  judgment:         { primary: "gemini-2.5-pro",   fallback1: "deepseek-chat",    fallback2: "gemini-2.5-flash" },
  jdAnalysis:       { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  interviewScore:   { primary: "gemini-2.5-pro",   fallback1: "gemini-2.5-flash", fallback2: "deepseek-chat" },
  codingGen:        { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  interviewPrep:    { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  redFlags:         { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
  candidateSummary: { primary: "gemini-2.5-flash", fallback1: "deepseek-chat",    fallback2: null },
};
