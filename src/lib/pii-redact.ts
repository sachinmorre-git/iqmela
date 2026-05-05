/**
 * PII Redaction Utility
 *
 * Centralizes all personally identifiable information (PII) masking logic.
 * Used to enforce role-based visibility of candidate contact data.
 *
 * Roles with FULL PII access: ORG_ADMIN, ADMIN, DEPT_ADMIN, RECRUITER
 * Roles with LIMITED access:  HIRING_MANAGER (name only)
 * Roles with NO PII access:   B2B_INTERVIEWER, VENDOR (own candidates only)
 */

// ── Role Groups ────────────────────────────────────────────────────────────────

const FULL_ACCESS_ROLES = ["ORG_ADMIN", "ADMIN", "DEPT_ADMIN", "RECRUITER"];

/**
 * Check if a user's roles grant them full PII access.
 */
export function canSeePII(callerRoles: string[]): boolean {
  return callerRoles.some((r) => FULL_ACCESS_ROLES.includes(r));
}

// ── Redaction Functions ────────────────────────────────────────────────────────

type RedactableFields = {
  candidateName?: string | null;
  candidateEmail?: string | null;
  phoneNumber?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
};

/**
 * Redact PII fields from a candidate data object based on caller role.
 *
 * - Full-access roles: data returned unchanged.
 * - Limited roles: name masked to "First L.", contact fields nulled.
 *
 * @example
 * const safe = redactPII(resume, userRoles);
 * // For an interviewer: { candidateName: "Sachin M.", candidateEmail: null, ... }
 */
export function redactPII<T extends RedactableFields>(
  data: T,
  callerRoles: string[]
): T {
  if (canSeePII(callerRoles)) return data;

  return {
    ...data,
    candidateName: maskName(data.candidateName),
    candidateEmail: null,
    phoneNumber: null,
    phone: null,
    linkedinUrl: null,
  };
}

/**
 * Batch-redact an array of candidate records.
 */
export function redactPIIBatch<T extends RedactableFields>(
  items: T[],
  callerRoles: string[]
): T[] {
  if (canSeePII(callerRoles)) return items;
  return items.map((item) => redactPII(item, callerRoles));
}

// ── Masking Helpers ────────────────────────────────────────────────────────────

/**
 * Masks a full name to "First L." format.
 *
 * @example
 * maskName("Sachin Morre")  → "Sachin M."
 * maskName("Madonna")       → "Madonna"
 * maskName(null)             → "Candidate"
 */
export function maskName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "Candidate";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/**
 * Masks an email to "s***@example.com" format.
 * Used for display purposes where a partial hint is acceptable.
 *
 * @example
 * maskEmail("sachin@iqmela.com")  → "s***@iqmela.com"
 * maskEmail(null)                  → null
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const atIdx = email.indexOf("@");
  if (atIdx < 1) return "***@***.com";
  const domain = email.slice(atIdx);
  return `${email.charAt(0)}***${domain}`;
}

/**
 * Masks a phone number to "***-**-1234" format (last 4 digits visible).
 *
 * @example
 * maskPhone("+1 555-867-5309")  → "***5309"
 * maskPhone(null)                → null
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `***${digits.slice(-4)}`;
}

// ── Prisma Select Helper ───────────────────────────────────────────────────────

/**
 * Returns a Prisma `select` object for candidate PII fields,
 * only including contact fields if the caller has access.
 *
 * Usage in server actions:
 *   const piiSelect = getCandidatePIISelect(callerRoles);
 *   const resume = await prisma.resume.findUnique({
 *     select: { candidateName: true, ...piiSelect, skills: true }
 *   });
 */
export function getCandidatePIISelect(callerRoles: string[]) {
  const full = canSeePII(callerRoles);
  return {
    candidateEmail: full,
    phoneNumber: full,
    linkedinUrl: full,
  };
}
