import { OrgPlanTier } from "@prisma/client"

// ── Plan Limits Interface ────────────────────────────────────────────────────

export interface PlanLimits {
  // Quantity limits (-1 = unlimited)
  maxPositions:          number
  maxResumesPerPosition: number
  maxTeamMembers:        number
  maxInterviewsPerMonth: number
  maxAiReportsPerMonth:  number

  // Feature flags
  hasAI:               boolean   // AI text extraction, ranking, advanced judgment
  hasAIPrep:           boolean   // Candidate AI prep coach
  hasInterviews:       boolean   // AI avatar interviews + interview pipeline
  hasBehavioral:       boolean   // Behavioral signal analysis (Phase 6)
  hasVendorDispatch:   boolean
  hasDepartments:      boolean
  hasActivityLog:      boolean
  hasCustomBranding:   boolean
  hasPrioritySupport:  boolean
}

// ── Tier Definitions ─────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<OrgPlanTier, PlanLimits> = {
  FREE: {
    maxPositions:          2,
    maxResumesPerPosition: 10,
    maxTeamMembers:        1,
    maxInterviewsPerMonth: 5,
    maxAiReportsPerMonth:  3,
    hasAI:               false,
    hasAIPrep:           false,
    hasInterviews:       false,
    hasBehavioral:       false,
    hasVendorDispatch:   false,
    hasDepartments:      false,
    hasActivityLog:      false,
    hasCustomBranding:   false,
    hasPrioritySupport:  false,
  },

  VENDOR_FREE: {
    maxPositions:          0,
    maxResumesPerPosition: 0,
    maxTeamMembers:        1,
    maxInterviewsPerMonth: 0,
    maxAiReportsPerMonth:  0,
    hasAI:               false,
    hasAIPrep:           false,
    hasInterviews:       false,
    hasBehavioral:       false,
    hasVendorDispatch:   false,
    hasDepartments:      false,
    hasActivityLog:      false,
    hasCustomBranding:   false,
    hasPrioritySupport:  false,
  },

  PLUS: {
    maxPositions:          10,
    maxResumesPerPosition: 50,
    maxTeamMembers:        5,
    maxInterviewsPerMonth: 25,
    maxAiReportsPerMonth:  10,
    hasAI:               true,
    hasAIPrep:           true,
    hasInterviews:       true,
    hasBehavioral:       false,
    hasVendorDispatch:   false,
    hasDepartments:      false,
    hasActivityLog:      false,
    hasCustomBranding:   false,
    hasPrioritySupport:  false,
  },

  ULTRA: {
    maxPositions:          -1,
    maxResumesPerPosition: -1,
    maxTeamMembers:        25,
    maxInterviewsPerMonth: -1,
    maxAiReportsPerMonth:  -1,
    hasAI:               true,
    hasAIPrep:           true,
    hasInterviews:       true,
    hasBehavioral:       true,
    hasVendorDispatch:   true,
    hasDepartments:      true,
    hasActivityLog:      true,
    hasCustomBranding:   true,
    hasPrioritySupport:  true,
  },

  ENTERPRISE: {
    maxPositions:          -1,
    maxResumesPerPosition: -1,
    maxTeamMembers:        -1,
    maxInterviewsPerMonth: -1,
    maxAiReportsPerMonth:  -1,
    hasAI:               true,
    hasAIPrep:           true,
    hasInterviews:       true,
    hasBehavioral:       true,
    hasVendorDispatch:   true,
    hasDepartments:      true,
    hasActivityLog:      true,
    hasCustomBranding:   true,
    hasPrioritySupport:  true,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get the limits config for a given plan tier */
export function getPlanLimits(tier: OrgPlanTier | null | undefined): PlanLimits {
  return PLAN_LIMITS[tier ?? "FREE"]
}

/** Check if a specific feature is available on a plan tier */
export function canAccessFeature(
  tier: OrgPlanTier | null | undefined,
  feature: keyof Omit<PlanLimits, "maxPositions" | "maxResumesPerPosition" | "maxTeamMembers" | "maxInterviewsPerMonth" | "maxAiReportsPerMonth">
): boolean {
  return getPlanLimits(tier)[feature]
}

/** Check if a quantity limit is reached (-1 = unlimited, always returns false) */
export function isLimitReached(limit: number, current: number): boolean {
  if (limit === -1) return false // unlimited
  return current >= limit
}

/** Human-readable limit label */
export function formatLimit(limit: number): string {
  if (limit === -1) return "Unlimited"
  if (limit === 0)  return "Not available"
  return `${limit}`
}

/** Human-readable tier name */
export function formatTierName(tier: OrgPlanTier | null | undefined): string {
  const names: Record<OrgPlanTier, string> = {
    FREE:        "Free",
    VENDOR_FREE: "Vendor",
    PLUS:        "Plus",
    ULTRA:       "Ultra",
    ENTERPRISE:  "Enterprise",
  }
  return names[tier ?? "FREE"]
}

/** Monthly price in USD (0 = free, -1 = custom) */
export function getTierPrice(tier: OrgPlanTier): number {
  const prices: Record<OrgPlanTier, number> = {
    FREE:        0,
    VENDOR_FREE: 0,
    PLUS:        49,
    ULTRA:       500,
    ENTERPRISE:  -1,  // custom
  }
  return prices[tier]
}

/** Annual price in USD (20% discount off monthly × 12) */
export function getTierAnnualPrice(tier: OrgPlanTier): number {
  const monthly = getTierPrice(tier)
  if (monthly <= 0) return monthly
  return Math.round(monthly * 12 * 0.8)
}

/** Check if this tier is a free tier (no payment required) */
export function isFreeTier(tier: OrgPlanTier | null | undefined): boolean {
  return tier === "FREE" || tier === "VENDOR_FREE" || !tier
}

/** Badge color classes for each tier */
export function getTierBadgeClass(tier: OrgPlanTier | null | undefined): string {
  const badges: Record<OrgPlanTier, string> = {
    FREE:        "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    VENDOR_FREE: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    PLUS:        "text-teal-400 bg-teal-500/10 border-teal-500/20",
    ULTRA:       "text-violet-400 bg-violet-500/10 border-violet-500/20",
    ENTERPRISE:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  }
  return badges[tier ?? "FREE"]
}
