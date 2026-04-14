import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { aiConfig } from "../config";
import type {
  HiringAiProvider,
  ExtractedResumeData,
  ExtractedJdData,
  JdAnalysisResult,
  ResumeRankingResult,
  CandidateSummaryResult,
  RecommendationResult,
} from "../types";

const MODEL_EXTRACTION = aiConfig.gemini.model;
const MODEL_RANKING    = aiConfig.gemini.model;
const MODEL_SUMMARY    = aiConfig.gemini.model;
const TEMPERATURE      = aiConfig.temperature;

/**
 * Gemini-powered implementation of the HiringAiProvider interface.
 * Uses structured JSON output mode (responseSchema) throughout for deterministic parsing.
 * Gracefully guards against missing API keys at the method level.
 */
export class GeminiHiringAiProvider implements HiringAiProvider {
  readonly providerName = "gemini";
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = aiConfig.gemini.apiKey ?? "";
    if (!apiKey) {
      console.warn("[GeminiAI] GEMINI_API_KEY is not set — calls will fail at runtime.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  // ── Extraction ──────────────────────────────────────────────────────────

  async extractResumeJson(rawText: string, fileName?: string): Promise<ExtractedResumeData> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        candidateName:   { type: Type.STRING, nullable: true },
        candidateEmail:  { type: Type.STRING, nullable: true },
        phoneNumber:     { type: Type.STRING, nullable: true },
        linkedinUrl:     { type: Type.STRING, nullable: true },
        location:        { type: Type.STRING, nullable: true },
        summary:         { type: Type.STRING, nullable: true },
        experienceYears: { type: Type.NUMBER, nullable: true },
        skills:          { type: Type.ARRAY, items: { type: Type.STRING } },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              degree:      { type: Type.STRING },
              institution: { type: Type.STRING },
              year:        { type: Type.STRING, nullable: true },
            },
          },
        },
        companies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company:  { type: Type.STRING },
              role:     { type: Type.STRING },
              duration: { type: Type.STRING, nullable: true },
            },
          },
        },
      },
    };

    const prompt = `You are a precise HR data extraction system. Extract structured information from the following resume text. Return only factual information visible in the text — do not infer or hallucinate data.\n\nResume text:\n${rawText}`;

    const { raw, usage } = await this._generate(prompt, schema, "ext-v1");
    const parsed = JSON.parse(raw);

    return {
      candidateName:       parsed.candidateName   ?? null,
      candidateEmail:      parsed.candidateEmail  ?? null,
      phoneNumber:         parsed.phoneNumber     ?? null,
      linkedinUrl:         parsed.linkedinUrl     ?? null,
      location:            parsed.location        ?? null,
      summary:             parsed.summary         ?? null,
      skills:              Array.isArray(parsed.skills)    ? parsed.skills    : [],
      experienceYears:     typeof parsed.experienceYears === "number" ? parsed.experienceYears : null,
      education:           Array.isArray(parsed.education)  ? parsed.education  : [],
      companies:           Array.isArray(parsed.companies)  ? parsed.companies  : [],
      certifications:      Array.isArray(parsed.certifications) ? parsed.certifications : [],
      projects:            Array.isArray(parsed.projects) ? parsed.projects : [],
      validationWarnings:  [],
      extractionConfidence: typeof parsed.extractionConfidence === "number" ? parsed.extractionConfidence : 0.9,
      rawOutput:           parsed,
      usage,
    };
  }

  // ── JD Auto-Fill Extraction ──────────────────────────────────────────────

  async extractJdFromText(rawText: string): Promise<ExtractedJdData> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        title:          { type: Type.STRING, nullable: true },
        department:     { type: Type.STRING, nullable: true },
        location:       { type: Type.STRING, nullable: true },
        employmentType: { type: Type.STRING, nullable: true },
        description:    { type: Type.STRING, nullable: true },
        jdText:         { type: Type.STRING },
      },
    };

    const prompt = `You are an expert HR data parser. Extract structured information from the following job description text. Return only factual information visible in the text — do not infer or hallucinate data.

Rules:
- title: The exact job title (e.g. "Senior Data Engineer")
- department: Department or team (e.g. "Engineering", "Data & Analytics")
- location: Work location (e.g. "Remote", "New York, NY", "Hybrid - London")
- employmentType: Must be exactly one of: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, or null
- description: A 1-2 sentence public-facing summary suitable for a job listings page
- jdText: The full cleaned job description text, preserving all details

Job Description:
${rawText}`;

    const { raw, usage } = await this._generate(prompt, schema, "jd-autofill-v1");
    const parsed = JSON.parse(raw);

    const validTypes = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
    const rawType = (parsed.employmentType ?? "").toUpperCase().replace(/[\s-]/g, "_");

    return {
      title:          parsed.title          ?? null,
      department:     parsed.department     ?? null,
      location:       parsed.location       ?? null,
      employmentType: validTypes.includes(rawType) ? rawType as ExtractedJdData["employmentType"] : null,
      description:    parsed.description    ?? null,
      jdText:         parsed.jdText         ?? rawText,
      usage,
    };
  }

  // ── JD Analysis ─────────────────────────────────────────────────────────

  async analyzeJdJson(jdText: string, positionTitle?: string): Promise<JdAnalysisResult> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        keywords:        { type: Type.ARRAY, items: { type: Type.STRING } },
        requiredSkills:  { type: Type.ARRAY, items: { type: Type.STRING } },
        preferredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        seniority:       { type: Type.STRING, nullable: true },
        roleType:        { type: Type.STRING, nullable: true },
      },
    };

    const prompt = `You are an expert talent acquisitions analyst. Analyze the following job description for "${positionTitle ?? "the role"}" and extract the listed fields with precision.\n\nJob Description:\n${jdText}`;

    const { raw, usage } = await this._generate(prompt, schema, "jd-v1");
    const parsed = JSON.parse(raw);

    return {
      roleTitle:       parsed.roleTitle  ?? null,
      seniorityLevel:  parsed.seniorityLevel ?? null,
      keywords:        Array.isArray(parsed.keywords)        ? parsed.keywords        : [],
      requiredSkills:  Array.isArray(parsed.requiredSkills)  ? parsed.requiredSkills  : [],
      preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills : [],
      responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : [],
      dealBreakers:    Array.isArray(parsed.dealBreakers)    ? parsed.dealBreakers    : [],
      niceToHaveSignals: Array.isArray(parsed.niceToHaveSignals) ? parsed.niceToHaveSignals : [],
      scoringRubric:   parsed.scoringRubric ?? null,
      seniority:       parsed.seniorityLevel ?? parsed.seniority ?? null,
      roleType:        parsed.roleTitle ?? parsed.roleType ?? null,
      structuredJd:    parsed,
      usage,
    };
  }

  // ── Ranking ─────────────────────────────────────────────────────────────

  async rankCandidateAgainstJd(
    extracted: ExtractedResumeData,
    rawResumeText: string,
    jdText: string,
    jdAnalysis?: JdAnalysisResult
  ): Promise<ResumeRankingResult> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        matchScore:         { type: Type.NUMBER },
        matchLabel:         { type: Type.STRING },
        matchedSkills:      { type: Type.ARRAY, items: { type: Type.STRING } },
        missingSkills:      { type: Type.ARRAY, items: { type: Type.STRING } },
        rankingExplanation: { type: Type.STRING },
        notableStrengths:   { type: Type.ARRAY, items: { type: Type.STRING } },
        possibleGaps:       { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    };

    const jdContext = jdAnalysis
      ? `Required skills: ${jdAnalysis.requiredSkills.join(", ")}\nPreferred skills: ${jdAnalysis.preferredSkills.join(", ")}`
      : "";

    const prompt = `You are a senior technical recruiter. Evaluate this candidate's fit for the job.\n\n### Job Description:\n${jdText}\n\n${jdContext}\n\n### Candidate Profile:\nName: ${extracted.candidateName}\nSkills: ${extracted.skills.join(", ")}\nExperience: ${extracted.experienceYears} years\nSummary: ${extracted.summary}\n\nRate from 0-100. Use STRONG_MATCH (80+), GOOD_MATCH (50-79), or WEAK_MATCH (<50) for matchLabel.`;

    const { raw, usage } = await this._generate(prompt, schema, "rank-v1");
    const parsed = JSON.parse(raw);
    const score = Number(parsed.matchScore) || 0;
    const label = parsed.matchLabel || (score >= 80 ? "STRONG_MATCH" : score >= 50 ? "GOOD_MATCH" : "WEAK_MATCH");

    return {
      matchScore:         score,
      matchLabel:         label,
      jdMatchScore:       score,
      jdMatchLabel:       label,
      matchedSkills:      Array.isArray(parsed.matchedSkills)    ? parsed.matchedSkills    : [],
      missingSkills:      Array.isArray(parsed.missingSkills)    ? parsed.missingSkills    : [],
      rankingExplanation: parsed.rankingExplanation              ?? "",
      notableStrengths:   Array.isArray(parsed.notableStrengths) ? parsed.notableStrengths : [],
      possibleGaps:       Array.isArray(parsed.possibleGaps)     ? parsed.possibleGaps     : [],
      usage,
    };
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  async generateCandidateSummary(extracted: ExtractedResumeData): Promise<CandidateSummaryResult> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        headline:       { type: Type.STRING },
        strengths:      { type: Type.ARRAY, items: { type: Type.STRING } },
        concerns:       { type: Type.ARRAY, items: { type: Type.STRING } },
        overallProfile: { type: Type.STRING },
      },
    };

    const prompt = `Write a concise recruiter-facing summary for this candidate.\n\nName: ${extracted.candidateName}\nSkills: ${extracted.skills.join(", ")}\nExperience: ${extracted.experienceYears} years\nLocation: ${extracted.location}\nSummary: ${extracted.summary}\nCompanies: ${extracted.companies.map(c => c.company).join(", ")}`;

    const { raw, usage } = await this._generate(prompt, schema, "sum-v1");
    const parsed = JSON.parse(raw);

    return {
      headline:       parsed.headline       ?? "",
      strengths:      Array.isArray(parsed.strengths) ? parsed.strengths : [],
      concerns:       Array.isArray(parsed.concerns)  ? parsed.concerns  : [],
      overallProfile: parsed.overallProfile ?? "",
      usage,
    };
  }

  // ── Recommendation ───────────────────────────────────────────────────────

  async runAdvancedCandidateJudgment(
    ranking: ResumeRankingResult,
    extracted: ExtractedResumeData
  ): Promise<RecommendationResult> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        recommendation:  { type: Type.STRING },
        rationale:       { type: Type.STRING },
        confidenceScore: { type: Type.NUMBER },
      },
    };

    const prompt = `You are a hiring committee advisor. Based on the candidate's match score and profile, provide a hiring recommendation.\n\nMatch Score: ${ranking.matchScore}/100 (${ranking.matchLabel})\nMatched Skills: ${ranking.matchedSkills.join(", ")}\nMissing Skills: ${ranking.missingSkills.join(", ")}\nStrengths: ${ranking.notableStrengths.join(", ")}\nGaps: ${ranking.possibleGaps.join(", ")}\n\nUse exactly one of: STRONG_HIRE, HIRE, MAYBE, NO_HIRE for the recommendation field.`;

    const { raw, usage } = await this._generate(prompt, schema, "adv-judge-v1");
    const parsed = JSON.parse(raw);

    return {
      recommendation: parsed.recommendation  as RecommendationResult["recommendation"] ?? "MAYBE",
      rationale:      parsed.rationale       ?? "",
      confidenceScore: Number(parsed.confidenceScore) || 0.5,
      usage,
    };
  }

  // ── Interview Prep ───────────────────────────────────────────────────────

  async generateInterviewPrep(
    extracted: ExtractedResumeData,
    ranking: ResumeRankingResult,
    jdText: string
  ): Promise<any> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        focusAreas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              focus: { type: Type.STRING }
            }
          }
        },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: "Technical, Behavioral, or Verification" },
              question: { type: Type.STRING },
              rationale: { type: Type.STRING }
            }
          }
        }
      }
    };

    const prompt = `Review this candidate against the job description and generate targeted interview focus areas and structured questions.\n\n### Job Description:\n${jdText}\n\n### Candidate Skills:\nHim: ${extracted.skills.join(", ")}\nMissing: ${ranking.missingSkills.join(", ")}\n\nGenerate meaningful probing questions. Limit to 3 focus areas and 5 questions.`;

    const { raw, usage } = await this._generate(prompt, schema, "int-prep-v1");
    const parsed = JSON.parse(raw);

    return {
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      usage,
    };
  }

  // ── Red Flags ────────────────────────────────────────────────────────────

  async analyzeRedFlags(
    extracted: ExtractedResumeData,
    rawText: string
  ): Promise<any> {
    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        flags: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING, description: "HIGH, MEDIUM, or LOW" },
              description: { type: Type.STRING }
            }
          }
        }
      }
    };

    const prompt = `Act as a forensic HR analyst. Review the raw resume text and extracted details for illogical timelines, massive skill inflation, repeated AI filler verbiage, or critical missing details (like no contact info).\n\nIf the resume appears completely normal, return an empty array for flags. Only flag actual suspicious findings.\n\n### Candidate Profile:\nName: ${extracted.candidateName}\nRaw Text Preview: ${rawText.substring(0, 1000)}...`;

    const { raw, usage } = await this._generate(prompt, schema, "red-flags-v1");
    const parsed = JSON.parse(raw);

    return {
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      usage,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async _generate(prompt: string, schema: Schema, promptVersion: string, modelOverride?: string): Promise<{ raw: string, usage: import("../types").AiUsageData }> {
    const finalModel = modelOverride ?? MODEL_EXTRACTION;
    
    // Attempt standard parse/repair from Gemini
    try {
      const response = await this.ai.models.generateContent({
        model: finalModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema:   schema,
          temperature:      TEMPERATURE,
          ...(aiConfig.maxOutputTokens ? { maxOutputTokens: aiConfig.maxOutputTokens } : {}),
        },
      });
  
      const raw = response.text ?? "{}";
      
      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = response.usageMetadata?.totalTokenCount ?? 0;
      
      // Gemini 1.5 flash standard rates: $0.075 / 1M input, $0.30 / 1M output
      const estimatedCost = (inputTokens / 1_000_000) * 0.075 + (outputTokens / 1_000_000) * 0.30;
      
      return {
        raw,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost,
          provider: this.providerName,
          model: finalModel,
          promptVersion,
        }
      };
    } catch (e: any) {
      console.error("[GeminiAI] API Call Failed", e);
      // Fallback/throw handling
      throw e;
    }
  }
}
