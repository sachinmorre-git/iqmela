/**
 * Interviewer–Candidate Match Scoring Engine
 * 
 * Rule-based scoring algorithm that ranks interviewers based on their
 * relevance to the candidate's profile, the round type, and their
 * track record. No external AI calls needed.
 */

import type { InterviewRoundType } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface InterviewerForMatch {
  userId: string;
  name: string | null;
  email: string;
  title: string | null;
  skills: string[];          // parsed from InterviewerProfile.skillsJson
  expertise: string | null;  // free text
  source: "INTERNAL" | "MARKETPLACE";
  hourlyRate: number | null;
  totalInterviews: number;
  avgRating: number | null;
  isVerified: boolean;
  avatarUrl: string | null;
  department: string | null;
  linkedinUrl?: string | null;
}

export interface MatchResult {
  interviewer: InterviewerForMatch;
  matchScore: number;          // 0-100
  breakdown: {
    skillOverlap: number;       // 0-40
    roundTypeFit: number;       // 0-25
    experienceLevel: number;    // 0-15
    trackRecord: number;        // 0-10
    availabilityBonus: number;  // 0-10
  };
  matchedSkills: string[];     // skills that overlap
  matchReasons: string[];      // human-readable reasons for recommendation
}

// ── Round Type → Skill Affinity Map ─────────────────────────────────────────

const ROUND_TYPE_SKILLS: Record<string, string[]> = {
  TECHNICAL: [
    "coding", "algorithms", "data structures", "python", "javascript", "typescript",
    "java", "c++", "go", "rust", "sql", "api", "testing", "debugging",
    "react", "node", "angular", "vue", "backend", "frontend", "full-stack",
  ],
  SYSTEM_DESIGN: [
    "system design", "architecture", "distributed systems", "microservices",
    "scalability", "load balancing", "caching", "databases", "cloud",
    "aws", "gcp", "azure", "kubernetes", "docker", "ci/cd", "infrastructure",
  ],
  BEHAVIORAL: [
    "leadership", "communication", "teamwork", "conflict resolution",
    "project management", "agile", "scrum", "mentoring", "collaboration",
  ],
  CULTURE_FIT: [
    "leadership", "communication", "values", "growth mindset",
    "diversity", "inclusion", "teamwork", "mentoring",
  ],
  HIRING_MANAGER: [
    "leadership", "strategy", "product", "management", "roadmap",
    "stakeholder management", "business acumen",
  ],
  PANEL: [], // Generic — uses candidate skills directly
  CUSTOM: [],
  AI_SCREEN: [],
};

// ── Main Scoring Function ───────────────────────────────────────────────────

export function scoreInterviewerMatch(
  interviewer: InterviewerForMatch,
  candidateSkills: string[],
  roundType: InterviewRoundType,
  jdRequiredSkills: string[]
): MatchResult {
  const normalize = (s: string) => s.toLowerCase().trim();
  
  const interviewerSkills = interviewer.skills.map(normalize);
  const candSkills = candidateSkills.map(normalize);
  const jdSkills = jdRequiredSkills.map(normalize);
  const roundSkills = (ROUND_TYPE_SKILLS[roundType] || []).map(normalize);

  // 1. Skill Overlap (40 points max)
  // Compare interviewer's skills against JD requirements + candidate skills
  const relevantSkills = [...new Set([...jdSkills, ...candSkills])];
  const matchedSkills: string[] = [];
  
  for (const skill of interviewerSkills) {
    if (relevantSkills.some(rs => rs.includes(skill) || skill.includes(rs))) {
      matchedSkills.push(skill);
    }
  }
  
  const skillOverlap = relevantSkills.length > 0
    ? Math.min(40, Math.round((matchedSkills.length / Math.min(relevantSkills.length, 8)) * 40))
    : 20; // Default if no skills data

  // 2. Round Type Fit (25 points max)
  // Does the interviewer have expertise relevant to this round type?
  let roundTypeFit = 0;
  if (roundSkills.length > 0) {
    const roundMatches = interviewerSkills.filter(s =>
      roundSkills.some(rs => rs.includes(s) || s.includes(rs))
    );
    roundTypeFit = Math.min(25, Math.round((roundMatches.length / Math.min(roundSkills.length, 5)) * 25));
  } else {
    // Generic round — give partial credit based on overall skill overlap
    roundTypeFit = Math.min(25, Math.round(skillOverlap * 0.625)); // 25/40 ratio
  }

  // Also boost from expertise free text if it mentions the round type
  const expertiseLower = (interviewer.expertise || "").toLowerCase();
  const roundTypeLower = roundType.toLowerCase().replace(/_/g, " ");
  if (expertiseLower.includes(roundTypeLower)) {
    roundTypeFit = Math.min(25, roundTypeFit + 10);
  }

  // 3. Experience Level (15 points max)
  // Based on title keywords as a proxy for seniority
  let experienceLevel = 8; // default mid-level
  const titleLower = (interviewer.title || "").toLowerCase();
  if (titleLower.includes("staff") || titleLower.includes("principal") || titleLower.includes("distinguished")) {
    experienceLevel = 15;
  } else if (titleLower.includes("senior") || titleLower.includes("lead") || titleLower.includes("sr.")) {
    experienceLevel = 12;
  } else if (titleLower.includes("manager") || titleLower.includes("director") || titleLower.includes("vp")) {
    experienceLevel = 13;
  } else if (titleLower.includes("junior") || titleLower.includes("jr.") || titleLower.includes("intern")) {
    experienceLevel = 4;
  }

  // 4. Track Record (10 points max)
  // Rating + interview count
  let trackRecord = 0;
  if (interviewer.avgRating != null) {
    trackRecord += Math.min(6, Math.round(interviewer.avgRating * 1.2));
  } else {
    trackRecord += 3; // default for no rating
  }
  if (interviewer.totalInterviews >= 50) trackRecord += 4;
  else if (interviewer.totalInterviews >= 20) trackRecord += 3;
  else if (interviewer.totalInterviews >= 5) trackRecord += 2;
  else trackRecord += 1;
  trackRecord = Math.min(10, trackRecord);

  // 5. Availability Bonus (10 points max)
  // Verified interviewers and marketplace get a small boost
  let availabilityBonus = 5; // default
  if (interviewer.isVerified) availabilityBonus += 3;
  if (interviewer.source === "INTERNAL") availabilityBonus += 2; // Prefer internal
  availabilityBonus = Math.min(10, availabilityBonus);

  const matchScore = Math.min(100, skillOverlap + roundTypeFit + experienceLevel + trackRecord + availabilityBonus);

  // Generate human-readable match reasons
  const matchReasons: string[] = [];
  if (matchedSkills.length > 0) {
    matchReasons.push(`Matches ${matchedSkills.slice(0, 3).join(", ")} from the job requirements`);
  }
  if (roundTypeFit >= 15) {
    matchReasons.push(`Strong fit for ${roundType.replace(/_/g, " ").toLowerCase()} rounds`);
  }
  if (interviewer.totalInterviews >= 100) {
    matchReasons.push(`Highly experienced — ${interviewer.totalInterviews}+ interviews conducted`);
  } else if (interviewer.totalInterviews >= 20) {
    matchReasons.push(`${interviewer.totalInterviews} interviews conducted`);
  }
  if (interviewer.avgRating != null && interviewer.avgRating >= 4.7) {
    matchReasons.push(`Top-rated interviewer (${interviewer.avgRating.toFixed(1)} ⭐)`);
  }
  if (interviewer.isVerified) {
    matchReasons.push("IQMela verified — background checked");
  }
  if (interviewer.source === "INTERNAL") {
    matchReasons.push("Internal team member — no additional cost");
  }

  return {
    interviewer,
    matchScore,
    breakdown: {
      skillOverlap,
      roundTypeFit,
      experienceLevel,
      trackRecord,
      availabilityBonus,
    },
    matchedSkills: [...new Set(matchedSkills)],
    matchReasons,
  };
}

// ── Rank multiple interviewers ──────────────────────────────────────────────

export function rankInterviewers(
  interviewers: InterviewerForMatch[],
  candidateSkills: string[],
  roundType: InterviewRoundType,
  jdRequiredSkills: string[],
  limit = 10
): MatchResult[] {
  return interviewers
    .map(i => scoreInterviewerMatch(i, candidateSkills, roundType, jdRequiredSkills))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
