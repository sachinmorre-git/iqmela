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
  score: number; // 0-100
  label: "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH";
  rationale: string;
  matchedSkills: string[];
  missingSkills: string[];
  transferableSkills: string[];
  redFlags: string[];
  inputTokens: number;
  outputTokens: number;
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
    };
  } catch (error) {
    console.error("[IntakeScoring] Tier 2 AI scoring failed:", error);
    // Return a safe fallback — don't block the pipeline
    return {
      score: 50,
      label: "PARTIAL_MATCH",
      rationale: "AI scoring failed — manual review recommended",
      matchedSkills: [],
      missingSkills: [],
      transferableSkills: [],
      redFlags: ["AI_SCORING_ERROR"],
      inputTokens: 0,
      outputTokens: 0,
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

      // Update candidate with scores
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
 * Called after batch scoring completes.
 */
export async function autoShortlistTopN(
  positionId: string,
  topN: number
): Promise<{ shortlisted: number; total: number }> {
  // Get all scored candidates, ordered by score descending
  const scored = await prisma.intakeCandidate.findMany({
    where: {
      positionId,
      finalStatus: "TIER2_SCORED",
    },
    orderBy: { tier2Score: "desc" },
    take: topN,
    select: { id: true, tier2Score: true },
  });

  // Mark top N as shortlisted
  if (scored.length > 0) {
    await prisma.intakeCandidate.updateMany({
      where: {
        id: { in: scored.map((c) => c.id) },
      },
      data: {
        finalStatus: "SHORTLISTED",
      },
    });
  }

  // Archive the rest
  await prisma.intakeCandidate.updateMany({
    where: {
      positionId,
      finalStatus: "TIER2_SCORED",
    },
    data: {
      finalStatus: "ARCHIVED",
      archivedAt: new Date(),
    },
  });

  const total = await prisma.intakeCandidate.count({
    where: { positionId, finalStatus: { not: "RECEIVED" } },
  });

  console.log(
    `[IntakeScoring] Shortlisted ${scored.length}/${total} candidates for position ${positionId}`
  );

  return { shortlisted: scored.length, total };
}

function validateLabel(
  label: string
): "STRONG_MATCH" | "GOOD_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH" {
  const valid = ["STRONG_MATCH", "GOOD_MATCH", "PARTIAL_MATCH", "WEAK_MATCH"];
  return valid.includes(label)
    ? (label as Tier2Result["label"])
    : "PARTIAL_MATCH";
}
