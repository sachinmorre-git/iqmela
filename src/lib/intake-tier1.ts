/**
 * Tier 1: Rules-Based Intake Filter
 *
 * Pure server-side filtering with ZERO API cost.
 * Extracts basic signals from resume text and matches against JD requirements.
 * Eliminates ~60-70% of candidates before expensive AI scoring.
 *
 * Scoring Breakdown (0-100):
 * - Required Skills Match:   0-40 points
 * - Experience Match:        0-25 points
 * - Location Match:          0-15 points
 * - Preferred Skills Bonus:  0-10 points
 * - Knockout Questions:      0-10 points (or instant FAIL)
 */

export interface Tier1Input {
  resumeText: string;
  // Position requirements
  requiredSkills: string[]; // From jdRequiredSkillsJson
  preferredSkills: string[]; // From jdPreferredSkillsJson
  experienceMin?: number | null;
  experienceMax?: number | null;
  location?: string | null;
  remotePolicy?: string | null;
  // Knockout answers from job board
  knockoutAnswers?: Record<string, string | number | boolean> | null;
  knockoutConfig?: KnockoutQuestion[] | null;
}

export interface KnockoutQuestion {
  question: string;
  type: "boolean" | "number" | "text";
  required: boolean;
  knockoutAnswer?: string | number | boolean; // If candidate's answer != this, instant fail
}

export interface Tier1Result {
  pass: boolean;
  score: number; // 0-100
  reasons: string[]; // Human-readable explanations
  extractedExperience: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  matchedPreferredSkills: string[];
}

const TIER1_PASS_THRESHOLD = 35; // Minimum score to advance to Tier 2

/**
 * Runs Tier 1 rules-based filtering on a single candidate.
 * This is fast enough to run synchronously inline with the webhook handler.
 */
export function runTier1Filter(input: Tier1Input): Tier1Result {
  const reasons: string[] = [];
  let totalScore = 0;

  const resumeLower = input.resumeText.toLowerCase();

  // ── 1. Knockout Questions (0 or instant FAIL) ─────────────────────────────
  if (input.knockoutConfig && input.knockoutAnswers) {
    for (const q of input.knockoutConfig) {
      if (!q.required) continue;
      const answer = input.knockoutAnswers[q.question];
      if (q.knockoutAnswer !== undefined && answer !== q.knockoutAnswer) {
        return {
          pass: false,
          score: 0,
          reasons: [`KNOCKOUT: Failed question "${q.question}" (answered: ${answer}, required: ${q.knockoutAnswer})`],
          extractedExperience: null,
          matchedSkills: [],
          missingSkills: input.requiredSkills,
          matchedPreferredSkills: [],
        };
      }
    }
    totalScore += 10; // Passed all knockouts
    reasons.push("Passed all knockout questions (+10)");
  }

  // ── 2. Required Skills Match (0-40 points) ────────────────────────────────
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of input.requiredSkills) {
    const skillLower = skill.toLowerCase();
    // Check for exact word match or common variations
    const variations = getSkillVariations(skillLower);
    const found = variations.some((v) => resumeLower.includes(v));
    if (found) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const requiredTotal = input.requiredSkills.length || 1;
  const skillMatchRatio = matchedSkills.length / requiredTotal;
  const skillScore = Math.round(skillMatchRatio * 40);
  totalScore += skillScore;

  if (matchedSkills.length > 0) {
    reasons.push(
      `Matched ${matchedSkills.length}/${requiredTotal} required skills (+${skillScore}): ${matchedSkills.join(", ")}`
    );
  }
  if (missingSkills.length > 0) {
    reasons.push(`Missing skills: ${missingSkills.join(", ")}`);
  }

  // ── 3. Experience Match (0-25 points) ─────────────────────────────────────
  const extractedExperience = extractExperienceYears(input.resumeText);

  if (extractedExperience !== null) {
    if (input.experienceMin && extractedExperience < input.experienceMin) {
      reasons.push(
        `Experience below minimum: ${extractedExperience} years (requires ${input.experienceMin}+)`
      );
      // Partial credit if close
      const ratio = extractedExperience / input.experienceMin;
      totalScore += Math.round(Math.min(ratio, 1) * 15);
    } else if (input.experienceMax && extractedExperience > input.experienceMax + 5) {
      // Overqualified warning (not a hard fail)
      reasons.push(
        `Possibly overqualified: ${extractedExperience} years (max: ${input.experienceMax})`
      );
      totalScore += 15; // Still decent score
    } else {
      totalScore += 25; // Perfect experience range
      reasons.push(`Experience match: ${extractedExperience} years (+25)`);
    }
  } else {
    totalScore += 10; // Unknown — give benefit of doubt
    reasons.push("Could not extract experience years (+10 default)");
  }

  // ── 4. Location Match (0-15 points) ───────────────────────────────────────
  if (input.remotePolicy === "REMOTE") {
    totalScore += 15;
    reasons.push("Remote position — location match automatic (+15)");
  } else if (input.location) {
    const locationLower = input.location.toLowerCase();
    const locationParts = locationLower.split(/[,\s]+/).filter(Boolean);
    const locationMatch = locationParts.some((part) =>
      resumeLower.includes(part)
    );
    if (locationMatch) {
      totalScore += 15;
      reasons.push(`Location match: ${input.location} (+15)`);
    } else {
      reasons.push(`Location mismatch: looking for ${input.location}`);
    }
  } else {
    totalScore += 10; // No location requirement
  }

  // ── 5. Preferred Skills Bonus (0-10 points) ──────────────────────────────
  const matchedPreferredSkills: string[] = [];
  for (const skill of input.preferredSkills) {
    const skillLower = skill.toLowerCase();
    const variations = getSkillVariations(skillLower);
    if (variations.some((v) => resumeLower.includes(v))) {
      matchedPreferredSkills.push(skill);
    }
  }

  if (input.preferredSkills.length > 0) {
    const prefRatio = matchedPreferredSkills.length / input.preferredSkills.length;
    const prefScore = Math.round(prefRatio * 10);
    totalScore += prefScore;
    if (matchedPreferredSkills.length > 0) {
      reasons.push(
        `Matched ${matchedPreferredSkills.length} preferred skills (+${prefScore}): ${matchedPreferredSkills.join(", ")}`
      );
    }
  }

  // ── Final Verdict ─────────────────────────────────────────────────────────
  const pass = totalScore >= TIER1_PASS_THRESHOLD;

  return {
    pass,
    score: Math.min(totalScore, 100),
    reasons,
    extractedExperience,
    matchedSkills,
    missingSkills,
    matchedPreferredSkills,
  };
}

/**
 * Extracts approximate years of experience from resume text.
 * Uses multiple regex patterns to catch different formats.
 */
function extractExperienceYears(text: string): number | null {
  const patterns = [
    // "10+ years of experience"
    /(\d{1,2})\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i,
    // "experience: 10 years"
    /experience:?\s*(\d{1,2})\+?\s*(?:years?|yrs?)/i,
    // "over 10 years"
    /over\s*(\d{1,2})\s*(?:years?|yrs?)/i,
    // "10-year career"
    /(\d{1,2})\s*-?\s*year\s*career/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const years = parseInt(match[1], 10);
      if (years >= 0 && years <= 50) return years;
    }
  }

  // Fallback: count distinct year ranges in work history
  const yearMentions = text.match(/20[0-2]\d|19[89]\d/g);
  if (yearMentions && yearMentions.length >= 2) {
    const years = yearMentions.map(Number);
    const span = Math.max(...years) - Math.min(...years);
    if (span > 0 && span <= 50) return span;
  }

  return null;
}

/**
 * Returns common variations of a skill name for fuzzy matching.
 * e.g., "javascript" → ["javascript", "js", "node.js", "nodejs"]
 */
function getSkillVariations(skill: string): string[] {
  const variations: string[] = [skill];

  const aliasMap: Record<string, string[]> = {
    javascript: ["javascript", "js", "ecmascript"],
    typescript: ["typescript", "ts"],
    python: ["python", "py"],
    react: ["react", "reactjs", "react.js"],
    "node.js": ["node.js", "nodejs", "node"],
    angular: ["angular", "angularjs"],
    vue: ["vue", "vuejs", "vue.js"],
    aws: ["aws", "amazon web services"],
    gcp: ["gcp", "google cloud"],
    azure: ["azure", "microsoft azure"],
    docker: ["docker", "containerization"],
    kubernetes: ["kubernetes", "k8s"],
    sql: ["sql", "mysql", "postgresql", "postgres", "mssql"],
    nosql: ["nosql", "mongodb", "dynamodb", "cassandra"],
    java: ["java", "jvm"],
    "c#": ["c#", "csharp", "c-sharp", ".net"],
    "c++": ["c++", "cpp"],
    go: ["golang", "go lang"],
    rust: ["rust", "rust-lang"],
    ruby: ["ruby", "rails", "ruby on rails"],
    php: ["php", "laravel"],
    swift: ["swift", "ios"],
    kotlin: ["kotlin", "android"],
    "machine learning": ["machine learning", "ml", "deep learning", "ai"],
    devops: ["devops", "ci/cd", "cicd"],
    agile: ["agile", "scrum", "kanban"],
    figma: ["figma"],
    "ui/ux": ["ui/ux", "ux", "ui", "user experience", "user interface"],
  };

  if (aliasMap[skill]) {
    return aliasMap[skill];
  }

  return variations;
}
