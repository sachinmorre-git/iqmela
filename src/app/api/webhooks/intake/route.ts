import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTier1Filter, KnockoutQuestion } from "@/lib/intake-tier1";
import { batchTier2Score, autoShortlistTopN } from "@/lib/intake-scoring";
import { calculatePurgeDate } from "@/lib/compliance-constants";
import { parseJsonArray } from "@/lib/intake-utils";

/**
 * POST /api/webhooks/intake
 *
 * Receives incoming candidate applications from job boards / aggregators.
 * Supports Indeed, Broadbean, and generic webhook formats.
 *
 * Flow:
 * 1. Validate payload
 * 2. Create IntakeCandidate record (RECEIVED)
 * 3. Run Tier 1 rules filter (synchronous — fast)
 * 4. If Tier 1 passes → queue Tier 2 AI scoring (async)
 * 5. Return 200 immediately (aggregators require fast responses)
 */
export async function POST(request: Request) {
  try {
    // ── API Key Authentication ──────────────────────────────────────────
    // Aggregators (Indeed, Broadbean, etc.) include the key in x-api-key header.
    // Backward-compatible: if INTAKE_WEBHOOK_SECRET isn't set, allow through (dev mode).
    const webhookSecret = process.env.INTAKE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const apiKey = request.headers.get("x-api-key");
      if (apiKey !== webhookSecret) {
        console.warn("[Intake] Webhook rejected — invalid or missing x-api-key.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      console.warn("[Intake] ⚠️ INTAKE_WEBHOOK_SECRET not set — skipping auth (dev mode).");
    }

    const body = await request.json();

    // ── Parse the incoming payload ──────────────────────────────────────────
    // Support multiple formats: Indeed, generic aggregator, and direct API
    const parsed = parseIncomingApplication(body);

    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 }
      );
    }

    // ── Find the position ──────────────────────────────────────────────────
    const position = await prisma.position.findFirst({
      where: {
        id: parsed.positionId,
        isPublished: true,
        isDeleted: false,
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        jdText: true,
        description: true,
        jdRequiredSkillsJson: true,
        jdPreferredSkillsJson: true,
        experienceMin: true,
        experienceMax: true,
        location: true,
        remotePolicy: true,
        knockoutQuestionsJson: true,
        intakeTopN: true,
        intakeAutoPromote: true,
      },
    });

    if (!position) {
      console.warn(`[Intake] Position not found or not published: ${parsed.positionId}`);
      return NextResponse.json(
        { error: "Position not found or not published" },
        { status: 404 }
      );
    }

    // ── Check for duplicate applications ────────────────────────────────────
    const existing = await prisma.intakeCandidate.findUnique({
      where: {
        positionId_candidateEmail: {
          positionId: position.id,
          candidateEmail: parsed.email,
        },
      },
    });

    if (existing) {
      console.log(`[Intake] Duplicate application from ${parsed.email} for position ${position.id}`);
      return NextResponse.json(
        { status: "duplicate", message: "Application already received" },
        { status: 200 }
      );
    }

    // ── Create IntakeCandidate record ───────────────────────────────────────
    const now = new Date();
    const intakeCandidate = await prisma.intakeCandidate.create({
      data: {
        positionId: position.id,
        organizationId: position.organizationId,
        source: parsed.source,
        sourceBoardJobId: parsed.boardJobId,
        externalAppId: parsed.externalAppId,
        candidateName: parsed.name,
        candidateEmail: parsed.email,
        phone: parsed.phone,
        linkedinUrl: parsed.linkedinUrl,
        location: parsed.location,
        resumeText: parsed.resumeText,
        resumeFileName: parsed.resumeFileName,
        resumeFileUrl: parsed.resumeFileUrl,
        knockoutAnswersJson: parsed.knockoutAnswers || undefined,
        consentSource: `${parsed.source.toLowerCase()}_tos`,
        dataProcessingBasis: "legitimate_interest",
        purgeScheduledAt: calculatePurgeDate(now),
        tier1Status: "RECEIVED",
        finalStatus: "RECEIVED",
      },
    });

    console.log(
      `[Intake] New application received: ${parsed.name || parsed.email} → Position: ${position.title} (${intakeCandidate.id})`
    );

    // ── Run Tier 1 Rules Filter (synchronous — fast) ───────────────────────
    const requiredSkills = parseJsonArray(position.jdRequiredSkillsJson);
    const preferredSkills = parseJsonArray(position.jdPreferredSkillsJson);

    const tier1Result = runTier1Filter({
      resumeText: parsed.resumeText || "",
      requiredSkills,
      preferredSkills,
      experienceMin: position.experienceMin,
      experienceMax: position.experienceMax,
      location: position.location,
      remotePolicy: position.remotePolicy,
      knockoutAnswers: parsed.knockoutAnswers,
      knockoutConfig: parseJsonArray(position.knockoutQuestionsJson) as unknown as KnockoutQuestion[],
    });

    await prisma.intakeCandidate.update({
      where: { id: intakeCandidate.id },
      data: {
        tier1Status: tier1Result.pass ? "TIER1_PASS" : "TIER1_FAIL",
        tier1Score: tier1Result.score,
        tier1Reasons: tier1Result.reasons,
        tier1At: new Date(),
        finalStatus: tier1Result.pass ? "TIER1_PASS" : "ARCHIVED",
        ...(tier1Result.pass ? {} : { archivedAt: new Date() }),
      },
    });

    console.log(
      `[Intake] Tier 1 result for ${parsed.email}: ${tier1Result.pass ? "PASS" : "FAIL"} (score: ${tier1Result.score})`
    );

    // ── Queue Tier 2 AI Scoring (async — only for Tier 1 survivors) ────────
    if (tier1Result.pass && parsed.resumeText) {
      // Run asynchronously — don't block the webhook response
      // In production, this would go to a proper job queue (Bull, SQS, etc.)
      // For now, we use a fire-and-forget promise
      runTier2AndShortlist(
        position.id,
        intakeCandidate.id,
        parsed.resumeText,
        position.jdText || position.description || "",
        position.title,
        requiredSkills,
        preferredSkills,
        position.intakeTopN,
      ).catch((err) =>
        console.error("[Intake] Tier 2 background scoring error:", err)
      );
    }

    return NextResponse.json(
      {
        status: "received",
        intakeCandidateId: intakeCandidate.id,
        tier1: {
          pass: tier1Result.pass,
          score: tier1Result.score,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Intake] Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }
}

/**
 * Runs Tier 2 AI scoring and auto-shortlists Top N.
 * Executed asynchronously after the webhook returns 200.
 */
async function runTier2AndShortlist(
  positionId: string,
  intakeCandidateId: string,
  resumeText: string,
  jdText: string,
  positionTitle: string,
  requiredSkills: string[],
  preferredSkills: string[],
  topN: number
) {
  await batchTier2Score(
    positionId,
    [{ intakeCandidateId, resumeText }],
    jdText,
    positionTitle,
    requiredSkills,
    preferredSkills
  );

  // After each scoring, re-evaluate Top N
  await autoShortlistTopN(positionId, topN);
}

/**
 * Parses incoming webhook payloads from various sources.
 * Returns a normalized structure or null if invalid.
 */
function parseIncomingApplication(body: Record<string, unknown>) {
  // ── Format 1: IQMela Direct API / Generic ──────────────────────────────
  if (body.positionId && body.email) {
    return {
      positionId: String(body.positionId),
      source: (String(body.source || "API").toUpperCase()) as "INDEED" | "LINKEDIN" | "API",
      boardJobId: body.boardJobId ? String(body.boardJobId) : null,
      externalAppId: body.externalAppId ? String(body.externalAppId) : null,
      name: body.name ? String(body.name) : null,
      email: String(body.email),
      phone: body.phone ? String(body.phone) : null,
      linkedinUrl: body.linkedinUrl ? String(body.linkedinUrl) : null,
      location: body.location ? String(body.location) : null,
      resumeText: body.resumeText ? String(body.resumeText) : null,
      resumeFileName: body.resumeFileName ? String(body.resumeFileName) : null,
      resumeFileUrl: body.resumeFileUrl ? String(body.resumeFileUrl) : null,
      knockoutAnswers: (body.knockoutAnswers as Record<string, string | number | boolean>) || null,
    };
  }

  // ── Format 2: Indeed Webhook ────────────────────────────────────────────
  // Indeed sends a different payload structure
  if (body.job_reference && body.applicant) {
    const applicant = body.applicant as Record<string, unknown>;
    return {
      positionId: String(body.job_reference),
      source: "INDEED" as const,
      boardJobId: body.indeed_job_id ? String(body.indeed_job_id) : null,
      externalAppId: body.application_id ? String(body.application_id) : null,
      name: applicant.name ? String(applicant.name) : null,
      email: String(applicant.email || ""),
      phone: applicant.phone ? String(applicant.phone) : null,
      linkedinUrl: null,
      location: applicant.location ? String(applicant.location) : null,
      resumeText: applicant.resume_text ? String(applicant.resume_text) : null,
      resumeFileName: applicant.resume_file_name
        ? String(applicant.resume_file_name)
        : null,
      resumeFileUrl: applicant.resume_url
        ? String(applicant.resume_url)
        : null,
      knockoutAnswers: (applicant.screening_answers as Record<string, string | number | boolean>) || null,
    };
  }

  return null;
}

