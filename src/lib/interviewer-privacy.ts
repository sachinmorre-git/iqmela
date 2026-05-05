/**
 * Marketplace Interviewer Privacy Resolver
 *
 * Controls what data is visible to clients vs admins for marketplace interviewers.
 * Internal interviewers always show their full profile to their own org.
 *
 * Three disclosure levels:
 * - ANONYMOUS (default): First name + last initial, trust indicators only
 * - PARTIAL (opt-in):    Full name + past companies (not current employer)
 * - FULL (opt-in):       Everything visible, like a freelancer portfolio
 */

export type DisclosureLevel = "ANONYMOUS" | "PARTIAL" | "FULL";
export type ViewerContext = "CLIENT" | "ADMIN";

// ── Input: raw data from Prisma join ────────────────────────────────────────

export interface RawInterviewerProfile {
  userId: string;
  name: string | null;      // from User table
  email: string;            // from User table
  title: string | null;
  department: string | null;
  expertise: string | null;
  bio: string | null;
  skillsJson: unknown;
  source: "INTERNAL" | "MARKETPLACE";
  hourlyRate: number | null;
  totalInterviews: number;
  avgRating: number | null;
  isVerified: boolean;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  // Privacy fields
  displayName: string | null;
  industryTier: string | null;
  seniorityLabel: string | null;
  yearsOfExperience: number | null;
  bioPublic: string | null;
  pastCompaniesJson: unknown;
  currentEmployer: string | null;
  disclosureLevel: string;
  showLinkedin: boolean;
  showFullName: boolean;
  showAvatar: boolean;
}

// ── Output: safe, resolved profile for rendering ────────────────────────────

export interface ResolvedInterviewerProfile {
  userId: string;
  displayName: string;
  email: string | null;           // null for marketplace (proxied)
  title: string | null;
  department: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  skills: string[];
  totalInterviews: number;
  avgRating: number | null;
  hourlyRate: number | null;
  source: "INTERNAL" | "MARKETPLACE";
  linkedinUrl: string | null;     // null unless opted-in
  // Marketplace-specific trust indicators
  industryTier: string | null;
  seniorityLabel: string | null;
  yearsOfExperience: number | null;
  bioPublic: string | null;
  pastCompanies: string[];
  // Privacy metadata
  isAnonymized: boolean;          // true if any data was redacted
}

// ── Main resolver ───────────────────────────────────────────────────────────

export function resolveInterviewerProfile(
  raw: RawInterviewerProfile,
  viewerContext: ViewerContext
): ResolvedInterviewerProfile {
  const skills = Array.isArray(raw.skillsJson) ? (raw.skillsJson as string[]) : [];
  const pastCompanies = Array.isArray(raw.pastCompaniesJson) ? (raw.pastCompaniesJson as string[]) : [];

  // ── INTERNAL interviewers: full transparency (they're your own team) ──────
  if (raw.source === "INTERNAL") {
    return {
      userId: raw.userId,
      displayName: raw.name || raw.email,
      email: raw.email,
      title: raw.title,
      department: raw.department,
      avatarUrl: raw.avatarUrl,
      isVerified: raw.isVerified,
      skills,
      totalInterviews: raw.totalInterviews,
      avgRating: raw.avgRating,
      hourlyRate: null, // Internal = no cost
      source: "INTERNAL",
      linkedinUrl: raw.linkedinUrl,
      industryTier: null,
      seniorityLabel: raw.seniorityLabel || inferSeniority(raw.title),
      yearsOfExperience: raw.yearsOfExperience,
      bioPublic: raw.bio,
      pastCompanies: [],
      isAnonymized: false,
    };
  }

  // ── ADMIN viewing marketplace: show everything (for vetting) ──────────────
  if (viewerContext === "ADMIN") {
    return {
      userId: raw.userId,
      displayName: raw.name || raw.email,
      email: raw.email,
      title: raw.title,
      department: raw.department,
      avatarUrl: raw.avatarUrl,
      isVerified: raw.isVerified,
      skills,
      totalInterviews: raw.totalInterviews,
      avgRating: raw.avgRating,
      hourlyRate: raw.hourlyRate,
      source: "MARKETPLACE",
      linkedinUrl: raw.linkedinUrl,
      industryTier: raw.industryTier,
      seniorityLabel: raw.seniorityLabel || inferSeniority(raw.title),
      yearsOfExperience: raw.yearsOfExperience,
      bioPublic: raw.bioPublic || raw.bio,
      pastCompanies,
      isAnonymized: false,
    };
  }

  // ── CLIENT viewing marketplace: apply privacy rules ───────────────────────
  const level = (raw.disclosureLevel || "ANONYMOUS") as DisclosureLevel;

  const resolvedName = (() => {
    if (level === "FULL" && raw.showFullName && raw.name) return raw.name;
    if (level === "PARTIAL" && raw.showFullName && raw.name) return raw.name;
    return raw.displayName || generateDisplayName(raw.name);
  })();

  return {
    userId: raw.userId,
    displayName: resolvedName,
    email: null, // Never expose marketplace interviewer email to clients
    title: level === "ANONYMOUS"
      ? null // Don't show employer-specific titles in anonymous mode
      : raw.title,
    department: null, // Never show department to clients (leaks employer)
    avatarUrl: raw.showAvatar ? raw.avatarUrl : null,
    isVerified: raw.isVerified,
    skills,
    totalInterviews: raw.totalInterviews,
    avgRating: raw.avgRating,
    hourlyRate: raw.hourlyRate,
    source: "MARKETPLACE",
    linkedinUrl: (level !== "ANONYMOUS" && raw.showLinkedin) ? raw.linkedinUrl : null,
    industryTier: raw.industryTier,
    seniorityLabel: raw.seniorityLabel || inferSeniority(raw.title),
    yearsOfExperience: raw.yearsOfExperience,
    bioPublic: raw.bioPublic || null,
    pastCompanies: level !== "ANONYMOUS" ? pastCompanies : [],
    isAnonymized: true,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a privacy-safe display name from a full name.
 * "John Smith" → "John S."
 * "Alice" → "Alice"
 * null → "Interview Expert"
 */
export function generateDisplayName(fullName: string | null): string {
  if (!fullName || fullName.trim() === "") return "Interview Expert";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Infer seniority level from title text (fallback when seniorityLabel isn't set).
 */
function inferSeniority(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes("principal") || t.includes("distinguished") || t.includes("fellow")) return "Principal";
  if (t.includes("staff")) return "Staff";
  if (t.includes("senior") || t.includes("sr.") || t.includes("lead")) return "Senior";
  if (t.includes("director") || t.includes("vp") || t.includes("head of")) return "Director";
  if (t.includes("manager")) return "Manager";
  if (t.includes("junior") || t.includes("jr.") || t.includes("associate")) return "Junior";
  return "Mid-Level";
}

// ── Batch resolver (for lists) ──────────────────────────────────────────────

export function resolveInterviewerProfiles(
  profiles: RawInterviewerProfile[],
  viewerContext: ViewerContext
): ResolvedInterviewerProfile[] {
  return profiles.map(p => resolveInterviewerProfile(p, viewerContext));
}
