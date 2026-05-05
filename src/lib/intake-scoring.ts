/**
 * Tier 2: AI Semantic Intake Scoring (Gemini Flash)
 *
 * Only runs on candidates that survived Tier 1 rules filter.
 * Uses Gemini to deeply analyze resume-JD fit including:
 * - Career trajectory alignment
 * - Transferable skills detection
 * - Cultural fit signals
 * - Red flag identification
 *
 * Cost: ~$0.002 per resume (Gemini Flash pricing)
 */

import { geminiClient, geminiModel } from "@/lib/ai/client";
import { prisma } from "@/lib/prisma";

export interface Tier2Input {
  resumeText: string;
  jdText: string;
  positionTitle: string;
  requiredSkills: string[];
  preferredSkills: string[];
}

export interface Tier2Result {
  score: number | null; // 0-100, null if scoring failed
  label: "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH" | "SCORING_FAILED";
  rationale: string;
  matchedSkills: string[];
  missingSkills: string[];
  transferableSkills: string[];
  redFlags: string[];
  inputTokens: number;
  outputTokens: number;
  scoringFailed: boolean;
}

const TIER2_PROMPT = `You are an expert technical recruiter AI. Analyze the following resume against the job description and provide a structured assessment.

## Job Description
{JD_TEXT}

## Required Skills
{REQUIRED_SKILLS}

## Preferred Skills
{PREFERRED_SKILLS}

## Candidate Resume
{RESUME_TEXT}

---

Evaluate the candidate's fit for this specific role. Return a JSON object with EXACTLY this structure:

{
  "score": <number 0-100>,
  "label": "<STRONG_MATCH|GOOD_MATCH|PARTIAL_MATCH|WEAK_MATCH>",
  "rationale": "<2-3 sentence summary of why this score was given>",
  "matchedSkills": ["<skills from the required/preferred list found in resume>"],
  "missingSkills": ["<required skills NOT found in resume>"],
  "transferableSkills": ["<skills not in the JD but valuable for the role>"],
  "redFlags": ["<any concerns: career gaps, job hopping, mismatched seniority, etc.>"]
}

Scoring guide:
- 80-100: STRONG_MATCH — Meets almost all requirements, strong career trajectory
- 60-79: GOOD_MATCH — Meets most requirements, minor gaps easily trainable
- 40-59: PARTIAL_MATCH — Meets some requirements, significant skill gaps
- 0-39: WEAK_MATCH — Poor fit for this specific role

Be precise and fair. Do not discriminate based on name, gender, ethnicity, age, or any protected characteristic. Focus ONLY on skills, experience, and role fit.

Return ONLY the JSON object, no markdown, no explanation outside the JSON.`;

/**
 * Runs Tier 2 AI semantic scoring on a single candidate.
 * On failure, returns scoringFailed=true with score=null instead of a fake score.
 */
export async function runTier2Scoring(input: Tier2Input): Promise<Tier2Result> {
  const prompt = TIER2_PROMPT
    .replace("{JD_TEXT}", input.jdText.substring(0, 4000)) // Cap to avoid token overflow
    .replace("{REQUIRED_SKILLS}", input.requiredSkills.join(", ") || "Not specified")
    .replace("{PREFERRED_SKILLS}", input.preferredSkills.join(", ") || "None specified")
    .replace("{RESUME_TEXT}", input.resumeText.substring(0, 6000)); // Cap resume text

  try {
    const result = await geminiClient.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        temperature: 0.2, // Low temperature for consistent scoring
        maxOutputTokens: 1024,
      },
    });

    const responseText = result.text?.trim() || "";

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Estimate tokens for cost tracking
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(responseText.length / 4);

    return {
      score: Math.max(0, Math.min(100, parsed.score || 0)),
      label: validateLabel(parsed.label),
      rationale: parsed.rationale || "No rationale provided",
      matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      transferableSkills: Array.isArray(parsed.transferableSkills) ? parsed.transferableSkills : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      inputTokens,
      outputTokens,
      scoringFailed: false,
    };
  } catch (error) {
    console.error("[IntakeScoring] Tier 2 AI scoring failed:", error);
    // Return FAILED state — NOT a fake score of 50
    return {
      score: null,
      label: "SCORING_FAILED",
      rationale: "AI scoring failed — manual review recommended",
      matchedSkills: [],
      missingSkills: [],
      transferableSkills: [],
      redFlags: ["AI_SCORING_ERROR"],
      inputTokens: 0,
      outputTokens: 0,
      scoringFailed: true,
    };
  }
}

/**
 * Batch scores multiple candidates for a position.
 * Runs sequentially to avoid API rate limits.
 * Logs AI usage to AiUsageLog for cost tracking.
 */
export async function batchTier2Score(
  positionId: string,
  candidates: Array<{
    intakeCandidateId: string;
    resumeText: string;
  }>,
  jdText: string,
  positionTitle: string,
  requiredSkills: string[],
  preferredSkills: string[]
): Promise<void> {
  console.log(
    `[IntakeScoring] Starting Tier 2 batch scoring for ${candidates.length} candidates on position ${positionId}`
  );

  for (const candidate of candidates) {
    try {
      // Mark as scoring
      await prisma.intakeCandidate.update({
        where: { id: candidate.intakeCandidateId },
        data: {
          tier1Status: "TIER2_SCORING",
          finalStatus: "TIER2_SCORING",
        },
      });

      const result = await runTier2Scoring({
        resumeText: candidate.resumeText,
        jdText,
        positionTitle,
        requiredSkills,
        preferredSkills,
      });

      if (result.scoringFailed) {
        // Mark as NEEDS_REVIEW instead of faking a score
        await prisma.intakeCandidate.update({
          where: { id: candidate.intakeCandidateId },
          data: {
            tier2Score: null,
            tier2Label: "SCORING_FAILED",
            tier2Rationale: result.rationale,
            tier2At: new Date(),
            tier1Status: "TIER2_SCORED", // Still mark as processed
            finalStatus: "NEEDS_REVIEW", // New: flag for recruiter attention
          },
        });
        console.warn(
          `[IntakeScoring] Scoring failed for candidate ${candidate.intakeCandidateId} — flagged as NEEDS_REVIEW`
        );
        continue;
      }

      // Update candidate with valid scores
      await prisma.intakeCandidate.update({
        where: { id: candidate.intakeCandidateId },
        data: {
          tier2Score: result.score,
          tier2Label: result.label,
          tier2Rationale: result.rationale,
          tier2MatchedSkills: result.matchedSkills,
          tier2MissingSkills: result.missingSkills,
          tier2At: new Date(),
          tier1Status: "TIER2_SCORED",
          finalStatus: "TIER2_SCORED",
        },
      });

      // Log AI usage for cost tracking
      await prisma.aiUsageLog.create({
        data: {
          positionId,
          provider: "gemini",
          model: geminiModel,
          taskType: "INTAKE_TIER2_SCORING",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.inputTokens + result.outputTokens,
          estimatedCost:
            (result.inputTokens * 0.000000075 + result.outputTokens * 0.0000003), // Gemini Flash rates
        },
      });
    } catch (error) {
      console.error(
        `[IntakeScoring] Error scoring candidate ${candidate.intakeCandidateId}:`,
        error
      );
    }
  }

  console.log(
    `[IntakeScoring] Tier 2 batch scoring complete for position ${positionId}`
  );
}

/**
 * Auto-shortlists the Top N candidates for a position based on Tier 2 scores.
 *
 * RACE-SAFE: Only operates on candidates with valid (non-null) tier2Scores.
 * Candidates with SCORING_FAILED are excluded from auto-shortlisting and
 * left as NEEDS_REVIEW for recruiter attention.
 *
 * Called ONCE when the intake window closes (not per-application) to prevent
 * the race condition where concurrent shortlisting corrupts rankings.
 */
export async function autoShortlistTopN(
  positionId: string,
  topN: number
): Promise<{ shortlisted: number; total: number; needsReview: number }> {
  // Get all successfully scored candidates (exclude SCORING_FAILED)
  const scored = await prisma.intakeCandidate.findMany({
    where: {
      positionId,
      finalStatus: "TIER2_SCORED",
      tier2Score: { not: null }, // Only candidates with valid AI scores
    },
    orderBy: { tier2Score: "desc" },
    select: { id: true, tier2Score: true },
  });

  // Count candidates needing manual review (scoring failed)
  const needsReview = await prisma.intakeCandidate.count({
    where: {
      positionId,
      finalStatus: "NEEDS_REVIEW",
    },
  });

  // Mark top N as shortlisted
  const topCandidates = scored.slice(0, topN);
  const restCandidates = scored.slice(topN);

  if (topCandidates.length > 0) {
    await prisma.intakeCandidate.updateMany({
      where: {
        id: { in: topCandidates.map((c) => c.id) },
      },
      data: {
        finalStatus: "SHORTLISTED",
      },
    });
  }

  // Archive the rest (those BELOW the top N cutoff)
  if (restCandidates.length > 0) {
    await prisma.intakeCandidate.updateMany({
      where: {
        id: { in: restCandidates.map((c) => c.id) },
      },
      data: {
        finalStatus: "ARCHIVED",
        archivedAt: new Date(),
      },
    });
  }

  const total = scored.length + needsReview;

  console.log(
    `[IntakeScoring] Shortlisted ${topCandidates.length}/${total} candidates for position ${positionId} (${needsReview} need manual review)`
  );

  return { shortlisted: topCandidates.length, total, needsReview };
}

function validateLabel(
  label: string
): "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH" {
  const valid = ["STRONG_MATCH", "GOOD_MATCH", "PARTIAL_MATCH", "WEAK_MATCH"];
  return valid.includes(label)
    ? (label as "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH")
    : "PARTIAL_MATCH";
}
