import OpenAI from "openai";
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

const MODEL_EXTRACTION = aiConfig.deepseek.chatModel;
const MODEL_RANKING    = aiConfig.deepseek.reasonerModel;
const MODEL_SUMMARY    = aiConfig.deepseek.chatModel;
const TEMPERATURE      = aiConfig.temperature;

/**
 * DeepSeek-powered implementation of the HiringAiProvider interface.
 * Uses official openai SDK with baseUrl configured to deepseek API.
 */
export class DeepSeekHiringAiProvider implements HiringAiProvider {
  readonly providerName = "deepseek";
  private ai: OpenAI;

  constructor() {
    const apiKey = aiConfig.deepseek.apiKey ?? "";
    if (!apiKey) {
      console.warn("[DeepSeekAI] DEEPSEEK_API_KEY is not set — calls will fail at runtime.");
    }
    this.ai = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey,
    });
  }

  // ── Helper for parsing potentially markdown-wrapped JSON ─────────────────

  private parseJsonFromOutput(rawText: string): any {
    let cleanText = rawText.trim();
    
    // 1. Try standard regex matching for markdown blocks
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let extracted = match && match[1] ? match[1].trim() : cleanText;

    // 2. Try reasoner bracket extraction if it has preamble
    const firstBrace = extracted.indexOf('{');
    const lastBrace = extracted.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      extracted = extracted.substring(firstBrace, lastBrace + 1);
    }
    
    // 3. Safe Evaluation
    try {
      return JSON.parse(extracted);
    } catch (e) {
      // 4. Aggressive JSON Repair
      try {
        let repaired = extracted
          .replace(/'/g, '"')               // Replace single quotes
          .replace(/,\s*([\]}])/g, '$1')    // Remove trailing commas
          .replace(/[\u201C\u201D]/g, '"')  // Smart quotes
          .replace(/[\n\r]/g, ' ')          // Remove newlines inside strings often breaking parses
          .replace(/\\"/g, '"')             // Resolve bad escapes
          .replace(/\s+/g, ' ');            // Simplify spaces

        return JSON.parse(repaired);
      } catch (repairErr) {
        console.error("[DeepSeekAI] Fatal JSON Parse Error. Raw:", extracted.substring(0, 500));
        throw new Error("AI returned malformed JSON that could not be repaired.");
      }
    }
  }

  // ── Extraction ──────────────────────────────────────────────────────────

  async extractResumeJson(rawText: string, fileName?: string): Promise<ExtractedResumeData> {
    const prompt = `You are a precise HR data extraction system. Extract structured information from the following resume text. Return strictly a JSON object with the following schema:
{
  "candidateName": string | null,
  "candidateEmail": string | null,
  "phoneNumber": string | null,
  "linkedinUrl": string | null,
  "location": string | null,
  "summary": string | null,
  "experienceYears": number | null,
  "skills": string[],
  "education": [ { "degree": string, "institution": string, "year": string | null } ],
  "companies": [ { "company": string, "role": string, "duration": string | null } ],
  "certifications": string[],
  "projects": string[],
  "extractionConfidence": number
}
Return only factual information visible in the text — do not infer or hallucinate data.

Resume text:
${rawText}`;

    const { raw, usage } = await this._generate(prompt, MODEL_EXTRACTION, true, "ext-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const prompt = `You are an expert HR data parser. Extract structured information from the following job description text.
Return strictly a JSON object with this schema:
{
  "title": string | null,
  "department": string | null,
  "location": string | null,
  "employmentType": string | null,
  "description": string | null,
  "jdText": string
}
Rules:
- title: The exact job title (e.g. "Senior Data Engineer")
- department: Department or team (e.g. "Engineering", "Data & Analytics")
- location: Work location (e.g. "Remote", "New York, NY", "Hybrid - London")
- employmentType: Must be exactly one of: "FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", or null
- description: A 1-2 sentence public-facing summary suitable for a job listings page
- jdText: The full cleaned job description text, preserving all details
Return only factual information visible in the text. Do not infer or hallucinate data.

Job Description:
${rawText}`;

    const { raw, usage } = await this._generate(prompt, MODEL_EXTRACTION, true, "jd-autofill-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const prompt = `You are an expert talent acquisitions analyst. Analyze the following job description for "${positionTitle ?? "the role"}" and extract the listed fields with precision. Return strictly a JSON object with this schema:
{
  "roleTitle": string | null,
  "seniorityLevel": string | null,
  "keywords": string[],
  "requiredSkills": string[],
  "preferredSkills": string[],
  "responsibilities": string[],
  "dealBreakers": string[],
  "niceToHaveSignals": string[],
  "scoringRubric": any
}

Job Description:
${jdText}`;

    const { raw, usage } = await this._generate(prompt, MODEL_EXTRACTION, true, "jd-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const jdContext = jdAnalysis
      ? `Required skills: ${jdAnalysis.requiredSkills.join(", ")}\nPreferred skills: ${jdAnalysis.preferredSkills.join(", ")}`
      : "";

    const prompt = `You are a senior technical recruiter. Evaluate this candidate's fit for the job.

### Job Description:
${jdText}

${jdContext}

### Candidate Profile:
Name: ${extracted.candidateName}
Skills: ${extracted.skills.join(", ")}
Experience: ${extracted.experienceYears} years
Summary: ${extracted.summary}

Rate from 0-100. Use STRONG_MATCH (80+), GOOD_MATCH (50-79), or WEAK_MATCH (<50) for matchLabel.
Return MUST BE STRICT JSON object matching this schema EXACTLY:
{
  "matchScore": number,
  "matchLabel": string,
  "matchedSkills": string[],
  "missingSkills": string[],
  "rankingExplanation": string,
  "notableStrengths": string[],
  "possibleGaps": string[]
}`;

    // reasoner might not support response_format strict json natively, so we pass false
    const { raw, usage } = await this._generate(prompt, MODEL_RANKING, false, "rank-v1");
    const parsed = this.parseJsonFromOutput(raw);
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
    const prompt = `Write a concise recruiter-facing summary for this candidate.
Name: ${extracted.candidateName}
Skills: ${extracted.skills.join(", ")}
Experience: ${extracted.experienceYears} years
Location: ${extracted.location}
Summary: ${extracted.summary}
Companies: ${extracted.companies.map(c => c.company).join(", ")}

Return strictly a JSON object matching this schema:
{
  "headline": string,
  "strengths": string[],
  "concerns": string[],
  "overallProfile": string
}`;

    const { raw, usage } = await this._generate(prompt, MODEL_SUMMARY, true, "sum-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const prompt = `You are a hiring committee advisor. Based on the candidate's match score and profile, provide a hiring recommendation.

Match Score: ${ranking.matchScore}/100 (${ranking.matchLabel})
Matched Skills: ${ranking.matchedSkills.join(", ")}
Missing Skills: ${ranking.missingSkills.join(", ")}
Strengths: ${ranking.notableStrengths.join(", ")}
Gaps: ${ranking.possibleGaps.join(", ")}

Use exactly one of: STRONG_HIRE, HIRE, MAYBE, NO_HIRE for the recommendation field.
Return MUST BE STRICT JSON object matching this schema EXACTLY:
{
  "recommendation": string,
  "rationale": string,
  "confidenceScore": number
}`;

    const { raw, usage } = await this._generate(prompt, MODEL_RANKING, false, "adv-judge-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const prompt = `Review this candidate against the job description and generate targeted interview focus areas and structured questions.

### Job Description:
${jdText}

### Candidate Skills:
Him: ${extracted.skills.join(", ")}
Missing: ${ranking.missingSkills.join(", ")}

Generate meaningful probing questions. Limit to 3 focus areas and 5 questions.
Return strictly a JSON object matching this schema:
{
  "focusAreas": [ { "topic": string, "focus": string } ],
  "questions": [ { "category": string, "question": string, "rationale": string } ]
}
Category should be one of "Technical", "Behavioral", or "Verification".`;

    const { raw, usage } = await this._generate(prompt, MODEL_EXTRACTION, true, "int-prep-v1");
    const parsed = this.parseJsonFromOutput(raw);

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
    const prompt = `Act as a forensic HR analyst. Review the raw resume text and extracted details for illogical timelines, massive skill inflation, repeated AI filler verbiage, or critical missing details (like no contact info).

If the resume appears completely normal, return an empty array for flags. Only flag actual suspicious findings.

### Candidate Profile:
Name: ${extracted.candidateName}
Raw Text Preview: ${rawText.substring(0, 1000)}...

Return strictly a JSON object matching this schema:
{
  "flags": [ { "severity": string, "description": string } ]
}
Severity should be HIGH, MEDIUM, or LOW.`;

    const { raw, usage } = await this._generate(prompt, MODEL_EXTRACTION, true, "red-flags-v1");
    const parsed = this.parseJsonFromOutput(raw);

    return {
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      usage,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async _generate(prompt: string, model: string, allowJsonFormat: boolean, promptVersion: string): Promise<{ raw: string, usage: import("../types").AiUsageData }> {
    const hasJsonFormatStr = allowJsonFormat && model.includes("chat");
    const finalModel = model ?? MODEL_EXTRACTION;

    try {
      const response = await this.ai.chat.completions.create({
        model: finalModel,
        messages: [{ role: "user", content: prompt }],
        response_format: hasJsonFormatStr ? { type: "json_object" } : undefined,
        temperature: TEMPERATURE,
        ...(aiConfig.maxOutputTokens && !finalModel.includes("reasoner") ? { max_tokens: aiConfig.maxOutputTokens } : {}),
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = response.usage?.total_tokens ?? 0;
      
      let estInputPricePerM = 0.14;
      let estOutputPricePerM = 0.28;
      
      if (finalModel.includes("reasoner")) {
        estInputPricePerM = 0.55;
        estOutputPricePerM = 2.19;
      }
      
      const estimatedCost = (inputTokens / 1_000_000) * estInputPricePerM + (outputTokens / 1_000_000) * estOutputPricePerM;

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
    } catch (e) {
      console.error("[DeepSeekAI] API Call Failed", e);
      throw e;
    }
  }
}
