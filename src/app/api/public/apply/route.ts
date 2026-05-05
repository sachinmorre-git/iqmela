import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { runTier1Filter, KnockoutQuestion } from "@/lib/intake-tier1";
import { batchTier2Score } from "@/lib/intake-scoring";
import { calculatePurgeDate } from "@/lib/compliance-constants";
import { parseJsonArray } from "@/lib/intake-utils";
import { isIntakeOpen } from "@/lib/intake-window";

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

    // ── Parse request body (FormData or JSON for Quick Apply) ───────────
    const contentType = request.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");
    
    let positionId: string;
    let name: string;
    let email: string;
    let consent: string;
    let resumeFile: File | null = null;
    let isQuickApply = false;
    let profileId: string | null = null;
    let workAuthorizedRaw: string | null = null;
    let sponsorshipNeededRaw: string | null = null;

    if (isJsonRequest) {
      // Quick Apply — JSON body
      const json = await request.json();
      positionId = (json.positionId || "").trim();
      name = (json.name || "").trim();
      email = (json.email || "").trim().toLowerCase();
      consent = json.consent || "";
      isQuickApply = json.quickApply === true;
      profileId = json.profileId || null;
      workAuthorizedRaw = json.workAuthorized != null ? String(json.workAuthorized) : null;
      sponsorshipNeededRaw = json.sponsorshipNeeded != null ? String(json.sponsorshipNeeded) : null;
    } else {
      // Standard FormData apply
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
      }
      positionId = (formData.get("positionId") as string)?.trim() || "";
      name = (formData.get("name") as string)?.trim() || "";
      email = (formData.get("email") as string)?.trim().toLowerCase() || "";
      consent = (formData.get("consent") as string) || "";
      resumeFile = formData.get("resume") as File | null;
      workAuthorizedRaw = formData.get("workAuthorized") as string | null;
      sponsorshipNeededRaw = formData.get("sponsorshipNeeded") as string | null;
    }

    // Parse work auth booleans
    const workAuthorized = workAuthorizedRaw === "true" ? true : workAuthorizedRaw === "false" ? false : null;
    const sponsorshipNeeded = sponsorshipNeededRaw === "true" ? true : sponsorshipNeededRaw === "false" ? false : null;

    // ── Validate ───────────────────────────────────────────────────────────
    if (!positionId || !name || !email) {
      return NextResponse.json(
        { error: "Required: positionId, name, email" },
        { status: 400 }
      );
    }

    // For standard apply, resume file is required unless Quick Apply
    if (!isQuickApply && !resumeFile) {
      return NextResponse.json(
        { error: "Resume is required" },
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

    if (resumeFile) {
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
        tier1PassThreshold: true,
        isPublished: true,
        createdAt: true,
        intakeWindowDays: true,
      },
    });

    if (!position) {
      return NextResponse.json(
        { error: "This position is no longer accepting applications" },
        { status: 404 }
      );
    }

    // ── Intake window check ─────────────────────────────────────────────────
    if (!isIntakeOpen(position)) {
      return NextResponse.json(
        { error: "The application window for this position has closed" },
        { status: 410 }
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

    // ── Resume handling ─────────────────────────────────────────────────────────
    let storagePath: string | null = null;
    let resumeText: string | null = null;
    let resumeFileName: string | null = null;
    let resumeMimeType: string | null = null;
    let resumeFileSizeBytes: number | null = null;

    if (resumeFile) {
      // Standard apply — save uploaded resume
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const saveResult = await saveFile(buffer, positionId, resumeFile.name);
      storagePath = saveResult.storagePath;
      resumeFileName = resumeFile.name;
      resumeMimeType = resumeFile.type;
      resumeFileSizeBytes = resumeFile.size;

      // Extract text (best-effort)
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
    } else if (isQuickApply && profileId) {
      // Quick Apply — reuse resume from CandidateProfile
      const profile = await prisma.candidateProfile.findUnique({
        where: { id: profileId },
        select: { resumeUrl: true },
      });
      if (profile?.resumeUrl) {
        storagePath = profile.resumeUrl;
        resumeFileName = "profile_resume";
      }
    }

    // ── Create IntakeCandidate ─────────────────────────────────────────────────
    const now = new Date();
    const intakeCandidate = await prisma.intakeCandidate.create({
      data: {
        positionId: position.id,
        organizationId: position.organizationId,
        source: isQuickApply ? "IQMELA_QUICK_APPLY" : "IQMELA_DIRECT",
        candidateName: name,
        candidateEmail: email,
        resumeText,
        resumeFileName,
        resumeFileUrl: storagePath,
        resumeMimeType,
        resumeFileSizeBytes,
        workAuthorized,
        sponsorshipNeeded,
        linkedProfileId: profileId,
        consentSource: isQuickApply ? "talent_network_consent" : "direct_consent",
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
      passThreshold: position.tier1PassThreshold,
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
    // NOTE: Shortlisting is NOT done per-application to prevent race conditions.
    // It runs ONCE when the intake window closes (via cron/process-closed-positions).
    if (tier1Result.pass && resumeText) {
      runTier2Async(
        position.id,
        intakeCandidate.id,
        resumeText,
        position.jdText || position.description || "",
        position.title,
        requiredSkills,
        preferredSkills,
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

    const { emailService } = await import("@/lib/email");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com";
    emailService
      .sendGenericEmail({
        to: email,
        subject: `Application received — ${position.title}`,
        heading: "We received your application",
        body: `Hi ${name},\n\nThank you for applying for the <strong>${position.title}</strong> position through IQMela.\n\nOur team will review your profile and reach out if there's a match. Average response time is 48 hours.\n\n<strong>Track your application:</strong> <a href="${appUrl}/careers/status?token=${intakeCandidate.id}">View Application Status</a>\n\nIn the meantime, you can join the <strong>IQMela Talent Network</strong> to get automatically matched to future roles tailored to your skills.`,
        ctaLabel: "Track Application Status",
        ctaUrl: `${appUrl}/careers/status?token=${intakeCandidate.id}`,
      })
      .catch((err: unknown) =>
        console.warn("[PublicApply] Confirmation email failed (non-blocking):", err)
      );

    // ── Increment distribution application count (fire-and-forget) ────────
    prisma.jobDistribution
      .updateMany({
        where: { positionId: position.id, status: "LIVE" },
        data: { applicationCount: { increment: 1 } },
      })
      .catch((err: unknown) =>
        console.warn("[PublicApply] Distribution metric increment failed (non-blocking):", err)
      );

    // ── Notify recruiters/HMs about new application (fire-and-forget) ────
    if (position.organizationId) {
      const orgId = position.organizationId;
      (async () => {
        try {
          const { createBulkNotifications } = await import("@/lib/notification-service");
          const recruiters = await prisma.user.findMany({
            where: {
              organizationId: orgId,
              roles: { hasSome: ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"] },
              isDeleted: false,
            },
            select: { id: true },
          });

          if (recruiters.length > 0) {
            await createBulkNotifications(
              recruiters.map((u) => ({
                organizationId: orgId,
                userId: u.id,
                type: "INTAKE_APPLICATION_RECEIVED" as const,
                title: "New Application Received",
                body: `${name} applied for ${position.title} via ${isQuickApply ? "Quick Apply" : "Careers Page"}.${tier1Result.pass ? ` AI Score: ${tier1Result.score}` : " (Filtered by Tier 1)"}`,
                link: `/org-admin/positions/${position.id}`,
              })),
            );
          }
        } catch (notifyErr) {
          console.warn("[PublicApply] Recruiter notification failed (non-blocking):", notifyErr);
        }
      })();
    }

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
) {
  await batchTier2Score(
    positionId,
    [{ intakeCandidateId, resumeText }],
    jdText,
    positionTitle,
    requiredSkills,
    preferredSkills
  );
  // Shortlisting is deferred to intake window close (cron)
  // to prevent race conditions from concurrent applications.
}

