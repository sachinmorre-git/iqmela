import type {
  HiringAiProvider,
  ExtractedResumeData,
  ExtractedJdData,
  JdAnalysisResult,
  ResumeRankingResult,
  CandidateSummaryResult,
  RecommendationResult,
} from "../types";

/**
 * Safe mock provider for local development and CI environments.
 * Returns realistic-looking plausible data without any API calls.
 * Automatically activated when GEMINI_API_KEY is not configured.
 */
export class MockHiringAiProvider implements HiringAiProvider {
  readonly providerName = "mock";

  constructor() {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[MockAI] ⚠️ PRODUCTION WARNING: Mock AI provider is active! " +
        "All AI scores/rankings are SIMULATED. Configure DEEPSEEK_API_KEY or GEMINI_API_KEY."
      );
    }
  }

  async extractResumeJson(rawText: string, fileName?: string): Promise<ExtractedResumeData> {
    console.log(`[MockAI] extractStructuredData — file: ${fileName ?? "unknown"}`);
    await this._delay(600);

    return {
      candidateName:    "Alex Mock",
      candidateEmail:   "alex.mock@example.com",
      phoneNumber:      "+1 (555) 000-1234",
      linkedinUrl:      "https://linkedin.com/in/alex-mock",
      location:         "New York, NY",
      summary:          "A highly mockable professional with experience in everything.",
      skills:           ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker"],
      experienceYears:  5,
      education:        [{ degree: "B.S. Computer Science", institution: "Mock University", year: "2019" }],
      companies:        [{ company: "MockCorp Ltd", role: "Senior Mock Engineer", duration: "2019 – Present" }],
      validationWarnings: ["⚠️ Mock AI — this data is simulated"],
      extractionConfidence: 0.95,
      rawOutput: { _isMock: true, provider: "MockHiringAiProvider" },
    };
  }

  async extractJdFromText(rawText: string): Promise<ExtractedJdData> {
    console.log("[MockAI] extractJdFromText");
    await this._delay(400);
    return {
      title:          "Mock Senior Engineer",
      department:     "Engineering",
      location:       "Remote",
      employmentType: "FULL_TIME",
      description:    "A mock position for testing the JD auto-fill feature.",
      jdText:         rawText,
    };
  }

  async analyzeJdJson(jdText: string, positionTitle?: string): Promise<JdAnalysisResult> {
    console.log(`[MockAI] analyzeJd — position: ${positionTitle ?? "unknown"}`);
    await this._delay(400);

    // Heuristic: extract some keywords from the actual JD text
    const words = jdText.toLowerCase().split(/\W+/);
    const techKeywords = ["react", "node", "typescript", "python", "java", "sql", "aws", "docker", "kubernetes", "agile"];
    const found = techKeywords.filter(k => words.includes(k));

    return {
      keywords:        found.length > 0 ? found : ["team player", "communication", "problem solving"],
      requiredSkills:  found.slice(0, 3).length > 0 ? found.slice(0, 3) : ["TypeScript", "React"],
      preferredSkills: found.slice(3).length > 0 ? found.slice(3) : ["Docker", "AWS"],
      seniority:       jdText.toLowerCase().includes("senior") ? "Senior" : "Mid-level",
      roleType:        "Engineering",
      structuredJd:    { mock: true, title: positionTitle, extractedKeywords: found },
    };
  }

  async rankCandidateAgainstJd(
    extracted: ExtractedResumeData,
    rawResumeText: string,
    jdText: string,
    jdAnalysis?: JdAnalysisResult
  ): Promise<ResumeRankingResult> {
    console.log("[MockAI] rankResume — heuristic scoring");
    await this._delay(500);

    const required = jdAnalysis?.requiredSkills ?? ["TypeScript", "React"];
    const candidateSkills = extracted.skills.map(s => s.toLowerCase());
    const matched = required.filter(s => candidateSkills.includes(s.toLowerCase()));
    const missing = required.filter(s => !candidateSkills.includes(s.toLowerCase()));
    const score = required.length > 0 ? Math.round((matched.length / required.length) * 100) : 60;
    const label = score >= 80 ? "STRONG_MATCH" : score >= 50 ? "GOOD_MATCH" : "WEAK_MATCH";

    return {
      matchScore:         score,
      matchLabel:         label,
      jdMatchScore:       score,
      jdMatchLabel:       label,
      matchedSkills:      matched,
      missingSkills:      missing,
      rankingExplanation: `Mock heuristic: ${matched.length}/${required.length} required skills found.`,
      notableStrengths:   matched.length > 0 ? [`Has ${matched.join(", ")}`] : ["Candidate has some related skills"],
      possibleGaps:       missing.length > 0 ? [`Missing: ${missing.join(", ")}`] : [],
    };
  }

  async generateCandidateSummary(extracted: ExtractedResumeData): Promise<CandidateSummaryResult> {
    console.log("[MockAI] generateCandidateSummary");
    await this._delay(300);

    return {
      headline:       `${extracted.candidateName ?? "Candidate"} — ${extracted.experienceYears ?? "N/A"} years experience`,
      strengths:      extracted.skills.slice(0, 3),
      concerns:       [],
      overallProfile: `${extracted.candidateName ?? "This candidate"} brings ${extracted.experienceYears ?? "several"} years of experience including ${extracted.skills.slice(0, 3).join(", ")}. Based in ${extracted.location ?? "an unspecified location"}.`,
    };
  }

  async runAdvancedCandidateJudgment(
    ranking: ResumeRankingResult,
    extracted: ExtractedResumeData
  ): Promise<RecommendationResult> {
    console.log("[MockAI] generateRecommendation");
    await this._delay(300);

    const rec =
      ranking.matchScore >= 80 ? "STRONG_HIRE" :
      ranking.matchScore >= 60 ? "HIRE" :
      ranking.matchScore >= 40 ? "MAYBE" : "NO_HIRE";

    return {
      recommendation:  rec,
      rationale:       `Mock recommendation based on a ${ranking.matchScore}/100 JD match score. ${ranking.rankingExplanation}`,
      confidenceScore: 0.75,
    };
  }

  async generateInterviewPrep(
    extracted: ExtractedResumeData,
    ranking: ResumeRankingResult,
    jdText: string
  ): Promise<any> {
    console.log("[MockAI] generateInterviewPrep");
    await this._delay(300);

    return {
      focusAreas: [
        { topic: "Technical Depth", focus: `Verify depth in ${ranking.matchedSkills[0] ?? "core skills"}` },
        { topic: "Experience Gaps", focus: `Probe on missing ${ranking.missingSkills[0] ?? "specific tools"}` },
      ],
      questions: [
        { category: "Technical", question: `Can you walk me through a complex problem you solved using ${ranking.matchedSkills[0] ?? "your main tech stack"}?`, rationale: "Tests actual hands-on depth." },
        { category: "Behavioral", question: "Describe a time you had to learn a new tool quickly on the job. How did you approach it?", rationale: "Assesses adaptability for missing skills." },
        { category: "Verification", question: `Could you elaborate on your role at your last company?`, rationale: "Validates resume timelines." }
      ]
    };
  }

  async analyzeRedFlags(
    extracted: ExtractedResumeData,
    rawText: string
  ): Promise<any> {
    console.log("[MockAI] analyzeRedFlags");
    await this._delay(200);

    const flags = [];
    if (!extracted.phoneNumber) flags.push({ severity: "LOW", description: "Missing phone number." });
    
    return { flags };
  }

  private _delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}
