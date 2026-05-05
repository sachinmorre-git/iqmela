/**
 * ATS Pre-Screen — Zero-cost keyword matching
 *
 * Scores resumes by counting keyword matches against the JD's
 * required and preferred skills. No AI API calls are made.
 *
 * Flow: takes all extracted resumes → scores them → returns top N IDs.
 */

interface ResumeEntry {
  id: string
  rawExtractedText: string | null
  extractedText: string | null
}

/**
 * Score a single resume against the JD keywords.
 * Required skill matches count 2x, preferred count 1x.
 */
function scoreResume(
  resume: ResumeEntry,
  requiredSkills: string[],
  preferredSkills: string[]
): number {
  const text = (resume.rawExtractedText || resume.extractedText || "").toLowerCase()
  if (!text) return 0

  let score = 0

  for (const skill of requiredSkills) {
    const normalised = skill.toLowerCase().trim()
    if (!normalised) continue
    // Count occurrences (capped at 3 per skill to avoid keyword stuffing)
    const regex = new RegExp(escapeRegex(normalised), "gi")
    const matches = (text.match(regex) || []).length
    score += Math.min(matches, 3) * 2 // 2x weight for required
  }

  for (const skill of preferredSkills) {
    const normalised = skill.toLowerCase().trim()
    if (!normalised) continue
    const regex = new RegExp(escapeRegex(normalised), "gi")
    const matches = (text.match(regex) || []).length
    score += Math.min(matches, 3) * 1 // 1x weight for preferred
  }

  return score
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Run the zero-cost ATS pre-screen on all resumes.
 * Returns the IDs of the top N resumes, sorted by keyword score descending.
 */
export function atsPreScreen(
  resumes: ResumeEntry[],
  requiredSkills: string[],
  preferredSkills: string[],
  topN: number
): { topIds: string[]; scores: Map<string, number> } {
  const scored = resumes
    .map((r) => ({
      id: r.id,
      score: scoreResume(r, requiredSkills, preferredSkills),
    }))
    .sort((a, b) => b.score - a.score)

  const scores = new Map<string, number>()
  for (const s of scored) scores.set(s.id, s.score)

  const topIds = scored.slice(0, topN).map((s) => s.id)

  return { topIds, scores }
}
