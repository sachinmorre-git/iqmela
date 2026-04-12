import { GoogleGenAI, Type, Schema } from '@google/genai';

/**
 * Types defining our AI extraction and ranking outputs based on our Prisma schema design.
 */
export interface ExtractedResumeData {
  candidateName: string | null;
  candidateEmail: string | null;
  phoneNumber: string | null;
  linkedinUrl: string | null;
  location: string | null;
  skills: string[];
  summary: string | null;
  experienceYears: number | null;
  education: Array<{ degree: string; institution: string; year: string | null }>;
  companies: Array<{ company: string; role: string; duration: string | null }>;
  validationWarnings?: string[];
  rawOutput?: Record<string, any>;
}

export interface ResumeRankingResult {
  matchScore: number; // 0 to 100
  matchLabel: string; // "STRONG_MATCH", "GOOD_MATCH", "WEAK_MATCH"
  matchedSkills: string[];
  missingSkills: string[];
  rankingExplanation: string;
  notableStrengths: string[];
  possibleGaps: string[];
}

/**
 * Clean AI service abstraction layer.
 * Enforces the contract that any AI provider (Gemini, OpenAI, Claude) must map to.
 */
export interface ResumeAiServiceInterface {
  /** Given raw unstructured text, use AI to pull structured JSON data. */
  extractResumeStructuredData(rawText: string): Promise<ExtractedResumeData>;
  
  /** Given a candidate's resume and a Job Description, rank their fit. */
  rankResumeAgainstJD(resumeText: string, jdText: string): Promise<ResumeRankingResult>;
  
  /** Validates and cleans AI JSON before writing to the database */
  validateAndNormalizeResumeData(extractedData: any): Promise<ExtractedResumeData>;
}

/**
 * MOCK PROVIDER for development and local testing when no API key is available.
 */
export class MockResumeAiService implements ResumeAiServiceInterface {
  async extractResumeStructuredData(rawText: string): Promise<ExtractedResumeData> {
    console.log("[MockResumeAiService] Faking structured extraction...");
    await new Promise(res => setTimeout(res, 800)); // Simulate AI delay
    return {
      candidateName: "John Mock Doe",
      candidateEmail: "john.mock@example.com",
      phoneNumber: "+1 (555) 000-1111",
      linkedinUrl: "https://linkedin.com/in/john-mock",
      location: "Remote, US",
      summary: "A highly mockable software engineer.",
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      experienceYears: 4.5,
      education: [{ degree: "B.S. Mock Sci", institution: "Dev University", year: "2020" }],
      companies: [{ company: "MockCorp LLC", role: "Software Mock Engineer", duration: "2020-Present" }],
      validationWarnings: [],
      rawOutput: { mock: true, via: "MockResumeAiService" }
    };
  }

  async rankResumeAgainstJD(resumeText: string, jdText: string): Promise<ResumeRankingResult> {
    console.log("[MockResumeAiService] Faking ranking against JD via heuristic...");
    await new Promise(res => setTimeout(res, 800));

    const commonKeywords = ["react", "node", "typescript", "javascript", "python", "java", "sql", "aws", "docker", "kubernetes", "agile", "leadership"];
    const jdLower = jdText.toLowerCase();
    const resumeLower = resumeText.toLowerCase();
    
    const requiredSkills = commonKeywords.filter(k => jdLower.includes(k));
    const baseRequirements = requiredSkills.length > 0 ? requiredSkills : ["react", "node", "typescript"];
    
    const matchedSkills = baseRequirements.filter(k => resumeLower.includes(k));
    const missingSkills = baseRequirements.filter(k => !resumeLower.includes(k));
    
    const matchScore = baseRequirements.length > 0 ? Math.round((matchedSkills.length / baseRequirements.length) * 100) : 50;
    const matchLabel = matchScore >= 80 ? "STRONG_MATCH" : matchScore >= 50 ? "GOOD_MATCH" : "WEAK_MATCH";

    return {
      matchScore,
      matchLabel,
      matchedSkills,
      missingSkills,
      rankingExplanation: `Heuristic fallback match: Found ${matchedSkills.length} of ${baseRequirements.length} expected skills.`,
      notableStrengths: matchedSkills.length > 0 ? ["Has some required keywords"] : [],
      possibleGaps: missingSkills.length > 0 ? ["Missing several key keywords"] : []
    };
  }

  async validateAndNormalizeResumeData(extractedData: any): Promise<ExtractedResumeData> {
    return extractedData as ExtractedResumeData;
  }
}

/**
 * GEMINI PROVIDER
 */
export class GeminiResumeAiService implements ResumeAiServiceInterface {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("⚠️  GeminiResumeAiService initialized without GEMINI_API_KEY");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async extractResumeStructuredData(rawText: string): Promise<ExtractedResumeData> {
    console.log("[GeminiResumeAiService] Firing generateContent to structured outputs endpoint...");
    
    const extractionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        candidateName: { type: Type.STRING, nullable: true },
        candidateEmail: { type: Type.STRING, nullable: true },
        phoneNumber: { type: Type.STRING, nullable: true },
        linkedinUrl: { type: Type.STRING, nullable: true },
        location: { type: Type.STRING, nullable: true },
        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
        summary: { type: Type.STRING, nullable: true },
        experienceYears: { type: Type.NUMBER, nullable: true },
        education: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              degree: { type: Type.STRING },
              institution: { type: Type.STRING },
              year: { type: Type.STRING, nullable: true },
            },
          },
        },
        companies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING },
              role: { type: Type.STRING },
              duration: { type: Type.STRING, nullable: true },
            },
          },
        },
      },
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert HR extraction system. Extract the strictly requested fields exactly as they appear in the following unstructured resume text:\n\n${rawText}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: extractionSchema,
          temperature: 0.1, // Keep it highly deterministic
        }
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      
      const validatedData = await this.validateAndNormalizeResumeData(parsedData);
      validatedData.rawOutput = parsedData; // Attach raw fallback for auditing
      
      return validatedData;

    } catch (error) {
      console.error("[GeminiResumeAiService] Extraction Failed:", error);
      throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : "Unknown struct failure"}`);
    }
  }

  async rankResumeAgainstJD(resumeText: string, jdText: string): Promise<ResumeRankingResult> {
    console.log("[GeminiResumeAiService] Preparing API Call to ranking endpoint...");
    
    const rankingSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        matchScore: { type: Type.NUMBER, description: "0 to 100" },
        matchLabel: { type: Type.STRING, description: "STRONG_MATCH, GOOD_MATCH, WEAK_MATCH" },
        matchedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        rankingExplanation: { type: Type.STRING },
        notableStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        possibleGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    };

    try {
      const prompt = `You are an expert technical recruiter analyzing a candidate's resume against a Job Description.\n\n### Job Description:\n${jdText}\n\n### Candidate Resume:\n${resumeText}\n\nEvaluate the fit. Provide a matchScore (0-100), a matchLabel (STRONG_MATCH, GOOD_MATCH, or WEAK_MATCH), and extract the matched/missing skills, strengths, and gaps.`;
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: rankingSchema,
          temperature: 0.1,
        }
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText);
      
      return {
        matchScore: parsedData.matchScore || 0,
        matchLabel: parsedData.matchLabel || "WEAK_MATCH",
        matchedSkills: Array.isArray(parsedData.matchedSkills) ? parsedData.matchedSkills : [],
        missingSkills: Array.isArray(parsedData.missingSkills) ? parsedData.missingSkills : [],
        rankingExplanation: parsedData.rankingExplanation || "",
        notableStrengths: Array.isArray(parsedData.notableStrengths) ? parsedData.notableStrengths : [],
        possibleGaps: Array.isArray(parsedData.possibleGaps) ? parsedData.possibleGaps : [],
      };
    } catch (error) {
      console.error("[GeminiResumeAiService] Ranking Failed:", error);
      throw new Error(`Gemini API Error: ${error instanceof Error ? error.message : "Unknown struct failure"}`);
    }
  }

  async validateAndNormalizeResumeData(extractedData: any): Promise<ExtractedResumeData> {
    // Defensive extraction parsing (gracefully handling missing nested objects if AI hallucinated)
    return {
      candidateName: extractedData.candidateName || null,
      candidateEmail: extractedData.candidateEmail || null,
      phoneNumber: extractedData.phoneNumber || null,
      linkedinUrl: extractedData.linkedinUrl || null,
      location: extractedData.location || null,
      summary: extractedData.summary || null,
      skills: Array.isArray(extractedData.skills) ? extractedData.skills : [],
      experienceYears: typeof extractedData.experienceYears === 'number' ? extractedData.experienceYears : null,
      education: Array.isArray(extractedData.education) ? extractedData.education : [],
      companies: Array.isArray(extractedData.companies) ? extractedData.companies : [],
      validationWarnings: [],
    };
  }
}

// -------------------------------------------------------------------------------------------------
// SERVICE INSTANTIATION
// We dynamically choose the provider based on the existence of the GEMINI_API_KEY environment variable.
// This guarantees local development never breaks simply because you forgot an API key. 
// -------------------------------------------------------------------------------------------------

export const resumeAiService: ResumeAiServiceInterface = 
  process.env.GEMINI_API_KEY 
    ? new GeminiResumeAiService() 
    : new MockResumeAiService();
