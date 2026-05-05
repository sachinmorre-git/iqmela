import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { saveFile } from "@/lib/storage"
import { runTier1Filter, KnockoutQuestion } from "@/lib/intake-tier1"
import { batchTier2Score, autoShortlistTopN } from "@/lib/intake-scoring"
import { calculatePurgeDate } from "@/lib/compliance-constants"
import { parseJsonArray } from "@/lib/intake-utils"
import { isIntakeOpen } from "@/lib/intake-window"
import crypto from "crypto"

/**
 * POST /api/webhooks/linkedin-apply
 *
 * Receives LinkedIn "Easy Apply" / "Apply Connect" webhook events.
 * Downloads the resume PDF to Cloudflare R2 and creates an IntakeCandidate.
 *
 * Security: HMAC-SHA256 signature verification using LINKEDIN_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    // ── HMAC Signature Verification ─────────────────────────────────────
    const webhookSecret = process.env.LINKEDIN_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = request.headers.get("x-linkedin-signature") || ""
      const rawBody = await request.text()

      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex")

      if (signature !== expected) {
        console.warn("[LinkedIn Webhook] HMAC signature mismatch — rejecting.")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }

      // Re-parse body from text
      var body = JSON.parse(rawBody)
    } else {
      console.warn("[LinkedIn Webhook] ⚠️ LINKEDIN_WEBHOOK_SECRET not set — skipping HMAC (dev mode).")
      var body = await request.json()
    }

    // ── Parse LinkedIn Application Payload ──────────────────────────────
    const applicant = body.applicant || body
    const positionRef = body.jobPosting?.integrationContext || body.job_reference || body.positionId
    const candidateName = applicant.firstName
      ? `${applicant.firstName} ${applicant.lastName || ""}`.trim()
      : applicant.name || null
    const candidateEmail = applicant.emailAddress || applicant.email || ""
    const phone = applicant.phoneNumber?.number || applicant.phone || null
    const linkedinUrl = applicant.publicProfileUrl || applicant.linkedinUrl || null
    const location = applicant.location?.name || applicant.location || null
    const resumeUrl = applicant.resume?.url || applicant.resumeUrl || null
    const resumeFileName = applicant.resume?.fileName || "linkedin_resume.pdf"

    if (!positionRef || !candidateEmail) {
      return NextResponse.json({ error: "Missing positionId or email" }, { status: 400 })
    }

    // ── Find Position ───────────────────────────────────────────────────
    const position = await prisma.position.findFirst({
      where: { id: positionRef, isPublished: true, isDeleted: false },
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
        isPublished: true,
        createdAt: true,
        intakeWindowDays: true,
      },
    })

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 })
    }

    // ── Intake Window Check ─────────────────────────────────────────────
    if (!isIntakeOpen(position)) {
      return NextResponse.json(
        { error: "Application window has closed" },
        { status: 410 }
      )
    }

    // ── Duplicate Check ─────────────────────────────────────────────────
    const existing = await prisma.intakeCandidate.findUnique({
      where: {
        positionId_candidateEmail: {
          positionId: position.id,
          candidateEmail,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { status: "duplicate", message: "Already applied" },
        { status: 200 }
      )
    }

    // ── Download Resume from LinkedIn's Temporary URL ───────────────────
    let resumeFileUrl: string | null = null
    let resumeText: string | null = null

    if (resumeUrl) {
      try {
        const downloadRes = await fetch(resumeUrl)
        if (downloadRes.ok) {
          const buffer = Buffer.from(await downloadRes.arrayBuffer())
          const { storagePath } = await saveFile(buffer, position.id, resumeFileName)
          resumeFileUrl = storagePath
          console.log(`[LinkedIn Webhook] Downloaded resume → ${storagePath}`)
        }
      } catch (dlErr) {
        console.error("[LinkedIn Webhook] Resume download failed:", dlErr)
      }
    }

    // ── Create IntakeCandidate ──────────────────────────────────────────
    const now = new Date()
    const intakeCandidate = await prisma.intakeCandidate.create({
      data: {
        positionId: position.id,
        organizationId: position.organizationId,
        source: "LINKEDIN",
        candidateName,
        candidateEmail,
        phone,
        linkedinUrl,
        location,
        resumeText,
        resumeFileName,
        resumeFileUrl,
        consentSource: "linkedin_tos",
        dataProcessingBasis: "legitimate_interest",
        purgeScheduledAt: calculatePurgeDate(now),
        tier1Status: "RECEIVED",
        finalStatus: "RECEIVED",
      },
    })

    console.log(
      `[LinkedIn Webhook] ✅ New application: ${candidateName || candidateEmail} → ${position.title} (${intakeCandidate.id})`
    )

    // ── Run Tier 1 Filter ───────────────────────────────────────────────
    const requiredSkills = parseJsonArray(position.jdRequiredSkillsJson)
    const preferredSkills = parseJsonArray(position.jdPreferredSkillsJson)

    const tier1Result = runTier1Filter({
      resumeText: resumeText || "",
      requiredSkills,
      preferredSkills,
      experienceMin: position.experienceMin,
      experienceMax: position.experienceMax,
      location: position.location,
      remotePolicy: position.remotePolicy,
      knockoutAnswers: null,
      knockoutConfig: parseJsonArray(position.knockoutQuestionsJson) as unknown as KnockoutQuestion[],
    })

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
    })

    // ── Queue Tier 2 (async) ────────────────────────────────────────────
    if (tier1Result.pass && resumeText) {
      batchTier2Score(
        position.id,
        [{ intakeCandidateId: intakeCandidate.id, resumeText }],
        position.jdText || position.description || "",
        position.title,
        requiredSkills,
        preferredSkills
      )
        .then(() => autoShortlistTopN(position.id, position.intakeTopN))
        .catch((err) => console.error("[LinkedIn Webhook] Tier 2 error:", err))
    }

    // Increment application count on distribution record
    await prisma.jobDistribution.updateMany({
      where: { positionId: position.id, boardName: "LINKEDIN" },
      data: { applicationCount: { increment: 1 } },
    })

    return NextResponse.json(
      { status: "received", intakeCandidateId: intakeCandidate.id },
      { status: 200 }
    )
  } catch (err) {
    console.error("[LinkedIn Webhook] Unhandled error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
