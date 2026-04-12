/**
 * Deterministic validation and normalization layer.
 * Runs after AI extraction to flag suspicious or malformed values.
 * Does NOT block extraction — only populates validationWarnings.
 */

import type { ExtractedResumeData } from "./resume-ai-service"

export interface NormalizationResult {
  data: ExtractedResumeData
  warnings: string[]
}

// ── Individual validators ────────────────────────────────────────────────────

/**
 * Validates a basic RFC-5322-ish email shape.
 * Not exhaustive — just catches obvious AI hallucination patterns.
 */
function validateEmail(email: string | null): string | null {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
  return valid ? trimmed : null
}

/**
 * Normalizes phone number to digits-only and checks for minimum plausible length.
 */
function validatePhone(phone: string | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  const digitsOnly = trimmed.replace(/\D/g, "")
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return null
  return trimmed // Keep original format but validated
}

/**
 * Ensures LinkedIn URL is a properly shaped linkedin.com/in/ URL.
 */
function normalizeLinkedIn(url: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  const linkedInPattern = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i
  if (!linkedInPattern.test(trimmed)) return null
  // Ensure it has a protocol prefix
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/**
 * Deduplicates the skills array (case-insensitive).
 * Returns cleaned array and the count of removed duplicates.
 */
function deduplicateSkills(skills: string[]): { skills: string[]; duplicatesRemoved: number } {
  const seen = new Set<string>()
  const clean: string[] = []
  for (const skill of skills) {
    const normalized = skill.trim()
    const key = normalized.toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      clean.push(normalized)
    }
  }
  return { skills: clean, duplicatesRemoved: skills.length - clean.length }
}

/**
 * Checks for blank, suspiciously short, or placeholder-looking strings.
 */
function isSuspicious(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  const suspiciousPatterns = [
    /^(n\/a|na|none|null|undefined|unknown|not\s*provided|not\s*available|n\.a\.)$/i,
    /^[.]{2,}$/,   // multiple dots
    /^x+$/i,       // "xxx"
    /^test/i,      // "test candidate"
    /^sample/i,
    /^lorem/i,
  ]
  return suspiciousPatterns.some((p) => p.test(v))
}

// ── Main normalization function ──────────────────────────────────────────────

export function validateAndNormalizeExtraction(
  raw: ExtractedResumeData
): NormalizationResult {
  const warnings: string[] = []

  // --- Email ---
  const validEmail = validateEmail(raw.candidateEmail)
  if (raw.candidateEmail && !validEmail) {
    warnings.push(`Email "${raw.candidateEmail}" failed validation and was cleared.`)
  }
  if (validEmail && isSuspicious(validEmail)) {
    warnings.push(`Email "${validEmail}" looks suspicious (placeholder value).`)
  }

  // --- Phone ---
  const validPhone = validatePhone(raw.phoneNumber)
  if (raw.phoneNumber && !validPhone) {
    warnings.push(`Phone "${raw.phoneNumber}" has an implausible digit count and was cleared.`)
  }

  // --- LinkedIn ---
  const validLinkedIn = normalizeLinkedIn(raw.linkedinUrl)
  if (raw.linkedinUrl && !validLinkedIn) {
    warnings.push(`LinkedIn URL "${raw.linkedinUrl}" does not match expected linkedin.com/in/* shape and was cleared.`)
  }

  // --- Suspicious scalar fields ---
  if (isSuspicious(raw.candidateName)) {
    warnings.push(`Candidate name "${raw.candidateName}" looks like a placeholder value.`)
  }
  if (isSuspicious(raw.location)) {
    warnings.push(`Location "${raw.location}" looks like a placeholder value.`)
  }

  // --- Skills dedup ---
  const { skills: cleanSkills, duplicatesRemoved } = deduplicateSkills(raw.skills ?? [])
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} duplicate skill(s) removed during normalization.`)
  }
  const suspiciousSkills = cleanSkills.filter((s) => isSuspicious(s))
  if (suspiciousSkills.length > 0) {
    warnings.push(`Suspicious skill values flagged: ${suspiciousSkills.join(", ")}.`)
  }

  // --- Experience sanity ---
  if (raw.experienceYears !== null && raw.experienceYears !== undefined) {
    if (raw.experienceYears < 0 || raw.experienceYears > 60) {
      warnings.push(`Experience years value "${raw.experienceYears}" is out of plausible range (0–60).`)
    }
  }

  // --- Education sanity ---
  const cleanEducation = (raw.education ?? []).filter((e) => {
    const blank = !e.degree?.trim() && !e.institution?.trim()
    if (blank) warnings.push("An education entry with no degree or institution was removed.")
    return !blank
  })

  // --- Companies sanity ---
  const cleanCompanies = (raw.companies ?? []).filter((c) => {
    const blank = !c.company?.trim() && !c.role?.trim()
    if (blank) warnings.push("A company entry with no company name or role was removed.")
    return !blank
  })

  // --- Missing fields advisory (non-blocking) ---
  if (!raw.candidateName)  warnings.push("Candidate name could not be extracted.")
  if (!validEmail)         warnings.push("No valid email address found in the resume.")
  if (!validPhone)         warnings.push("No valid phone number found in the resume.")

  const normalizedData: ExtractedResumeData = {
    ...raw,
    candidateEmail: validEmail,
    phoneNumber:    validPhone,
    linkedinUrl:    validLinkedIn,
    skills:         cleanSkills,
    education:      cleanEducation,
    companies:      cleanCompanies,
    validationWarnings: warnings,
  }

  if (warnings.length > 0) {
    console.warn(`[validateAndNormalizeExtraction] ${warnings.length} warning(s):`, warnings)
  }

  return { data: normalizedData, warnings }
}
