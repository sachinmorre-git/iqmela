import { Type, type Schema } from "@google/genai";
import { geminiClient } from "../client";
import { aiConfig } from "../config";
import {
  extractResumePrompt,
  extractJdPrompt,
  analyzeJdPrompt,
  rankCandidatePrompt,
  generateCandidateSummaryPrompt,
  runAdvancedJudgmentPrompt,
  generateInterviewPrepPrompt,
  analyzeRedFlagsPrompt,
} from "../prompts";
import type {
  HiringAiProvider,
  ExtractedResumeData,
  ExtractedJdData,
  JdAnalysisResult,
  ResumeRankingResult,
  CandidateSummaryResult,
  RecommendationResult,
} from "../types";

const TEMPERATURE      = aiConfig.temperature;

/**
 * Gemini-powered implementation of the HiringAiProvider interface.
 * Uses structured JSON output mode (responseSchema) throughout for deterministic parsing.
 * Gracefully guards against missing API keys at the method level.
 */
export class GeminiHiringAiProvider implements HiringAiProvider {
  readonly providerName = "gemini";
  private ai = geminiClient;
  private modelId: string;

  constructor(modelOverride?: string) {
    this.modelId = modelOverride ?? aiConfig.gemini.model;
    if (!aiConfig.gemini.apiKey) {
      console.warn("[GeminiAI] GEMINI_API_KEY is not set — calls will fail at runtime.");
    }
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

    const prompt = extractResumePrompt({ rawText });

    const { raw, usage } = await this._generate(prompt, schema, extractResumePrompt.version);
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

    const prompt = extractJdPrompt({ rawText });

    const { raw, usage } = await this._generate(prompt, schema, extractJdPrompt.version);
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

    const prompt = analyzeJdPrompt({ jdText, positionTitle });

    const { raw, usage } = await this._generate(prompt, schema, analyzeJdPrompt.version);
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

    const prompt = rankCandidatePrompt({ extracted, jdText, jdAnalysis });

    const { raw, usage } = await this._generate(prompt, schema, rankCandidatePrompt.version);
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

    const prompt = generateCandidateSummaryPrompt({ extracted });

    const { raw, usage } = await this._generate(prompt, schema, generateCandidateSummaryPrompt.version);
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

    const prompt = runAdvancedJudgmentPrompt({ ranking, extracted });

    const { raw, usage } = await this._generate(prompt, schema, runAdvancedJudgmentPrompt.version);
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

    const prompt = generateInterviewPrepPrompt({ extracted, ranking, jdText });

    const { raw, usage } = await this._generate(prompt, schema, generateInterviewPrepPrompt.version);
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

    const prompt = analyzeRedFlagsPrompt({ extracted, rawText });

    const { raw, usage } = await this._generate(prompt, schema, analyzeRedFlagsPrompt.version);
    const parsed = JSON.parse(raw);

    return {
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      usage,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async _generate(prompt: string, schema: Schema, promptVersion: string, modelOverride?: string): Promise<{ raw: string, usage: import("../types").AiUsageData }> {
    const finalModel = modelOverride ?? this.modelId;
    
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
