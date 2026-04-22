import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { runTier1Filter, KnockoutQuestion } from "@/lib/intake-tier1";
import { batchTier2Score, autoShortlistTopN } from "@/lib/intake-scoring";
import { calculatePurgeDate } from "@/lib/compliance-constants";
import { parseJsonArray } from "@/lib/intake-utils";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Simple IP rate limiter (in-memory — resets on deploy)
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 5; // 5 applications per IP per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_LIMIT) {
    rateMap.set(ip, timestamps); // Update with cleaned list
    return false;
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);

  // Periodic cleanup: every 100 checks, purge stale entries
  if (rateMap.size > 100 && Math.random() < 0.01) {
    for (const [key, vals] of rateMap) {
      const active = vals.filter((t) => now - t < RATE_WINDOW);
      if (active.length === 0) rateMap.delete(key);
      else rateMap.set(key, active);
    }
  }

  return true;
}

/**
 * POST /api/public/apply
 *
 * Public endpoint — no authentication required.
 * Receives candidate applications from the IQMela Careers page.
 * Creates IntakeCandidate, runs Tier 1/2 scoring, stores resume.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Rate limit ─────────────────────────────────────────────────────────
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many applications. Please try again later." },
        { status: 429 }
      );
    }

    // ── Parse form data ────────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 }
      );
    }

    const positionId = (formData.get("positionId") as string)?.trim();
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const consent = formData.get("consent") as string;
    const resumeFile = formData.get("resume") as File | null;

    // ── Validate ───────────────────────────────────────────────────────────
    if (!positionId || !name || !email || !resumeFile) {
      return NextResponse.json(
        { error: "All fields are required: positionId, name, email, resume" },
        { status: 400 }
      );
    }

    if (consent !== "true") {
      return NextResponse.json(
        { error: "Consent is required to process your application" },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (!ACCEPTED_MIME.has(resumeFile.type)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are accepted" },
        { status: 400 }
      );
    }

    if (resumeFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be under 10 MB" },
        { status: 400 }
      );
    }

    // ── Find position ──────────────────────────────────────────────────────
    const position = await prisma.position.findFirst({
      where: { id: positionId, isPublished: true, isDeleted: false },
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
      return NextResponse.json(
        { error: "This position is no longer accepting applications" },
        { status: 404 }
      );
    }

    // ── Duplicate check ────────────────────────────────────────────────────
    const existing = await prisma.intakeCandidate.findUnique({
      where: {
        positionId_candidateEmail: {
          positionId: position.id,
          candidateEmail: email,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "duplicate", message: "You've already applied for this role" },
        { status: 200 }
      );
    }

    // ── Save resume file ───────────────────────────────────────────────────
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const { storagePath } = await saveFile(buffer, positionId, resumeFile.name);

    // ── Extract text from resume (best-effort) ─────────────────────────────
    let resumeText: string | null = null;
    try {
      if (resumeFile.type === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        resumeText = result.text;
      } else {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        resumeText = result.value;
      }
    } catch (err) {
      console.warn("[PublicApply] Text extraction failed (non-blocking):", err);
    }

    // ── Create IntakeCandidate ─────────────────────────────────────────────
    const now = new Date();
    const intakeCandidate = await prisma.intakeCandidate.create({
      data: {
        positionId: position.id,
        organizationId: position.organizationId,
        source: "IQMELA_DIRECT",
        candidateName: name,
        candidateEmail: email,
        resumeText,
        resumeFileName: resumeFile.name,
        resumeFileUrl: storagePath,
        resumeMimeType: resumeFile.type,
        resumeFileSizeBytes: resumeFile.size,
        consentSource: "direct_consent",
        dataProcessingBasis: "consent",
        purgeScheduledAt: calculatePurgeDate(now),
        tier1Status: "RECEIVED",
        finalStatus: "RECEIVED",
      },
    });

    console.log(
      `[PublicApply] ✅ New application: ${name} (${email}) → ${position.title} (${intakeCandidate.id})`
    );

    // ── Run Tier 1 Filter ──────────────────────────────────────────────────
    const requiredSkills = parseJsonArray(position.jdRequiredSkillsJson);
    const preferredSkills = parseJsonArray(position.jdPreferredSkillsJson);

    const tier1Result = runTier1Filter({
      resumeText: resumeText || "",
      requiredSkills,
      preferredSkills,
      experienceMin: position.experienceMin,
      experienceMax: position.experienceMax,
      location: position.location,
      remotePolicy: position.remotePolicy,
      knockoutAnswers: null,
      knockoutConfig: parseJsonArray(
        position.knockoutQuestionsJson
      ) as unknown as KnockoutQuestion[],
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

    // ── Queue Tier 2 (async) ───────────────────────────────────────────────
    if (tier1Result.pass && resumeText) {
      runTier2Async(
        position.id,
        intakeCandidate.id,
        resumeText,
        position.jdText || position.description || "",
        position.title,
        requiredSkills,
        preferredSkills,
        position.intakeTopN
      ).catch((err) =>
        console.error("[PublicApply] Tier 2 background error:", err)
      );
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: position.organizationId,
        userId: "public_apply",
        action: "PUBLIC_APPLICATION_RECEIVED",
        resourceType: "IntakeCandidate",
        resourceId: intakeCandidate.id,
        metadata: {
          source: "CAREERS_PAGE",
          email,
          tier1Pass: tier1Result.pass,
          tier1Score: tier1Result.score,
          ip,
        },
      },
    });

    // ── Send confirmation email (fire-and-forget) ──────────────────────────
    const { emailService } = await import("@/lib/email");
    emailService
      .sendGenericEmail({
        to: email,
        subject: `Application received — ${position.title}`,
        heading: "We received your application",
        body: `Hi ${name},\n\nThank you for applying for the <strong>${position.title}</strong> position through IQMela.\n\nOur team will review your profile and reach out if there's a match. Average response time is 48 hours.\n\nIn the meantime, you can join the <strong>IQMela Talent Network</strong> to get automatically matched to future roles tailored to your skills.`,
        ctaLabel: "Join the Talent Network",
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"}/careers/join?intake=${intakeCandidate.id}`,
      })
      .catch((err: unknown) =>
        console.warn("[PublicApply] Confirmation email failed (non-blocking):", err)
      );

    return NextResponse.json({
      success: true,
      intakeCandidateId: intakeCandidate.id,
      tier1: { pass: tier1Result.pass, score: tier1Result.score },
    });
  } catch (error) {
    console.error("[PublicApply] Error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function runTier2Async(
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
  await autoShortlistTopN(positionId, topN);
}

