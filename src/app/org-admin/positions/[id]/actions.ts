"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resumeParser } from "@/lib/resume-parser"
import { fileExtractor } from "@/lib/file-extractor"
import { mailService } from "@/lib/mail"
import { revalidatePath } from "next/cache"
import path from "path"
import { getCallerPermissions } from "@/lib/rbac"
import { atsPreScreen } from "@/lib/ats-prescreen"

export interface BulkExtractionResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  warnings: number
  errors: Array<{ fileName: string; error: string }>
}

export async function deletePositionAction(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Not found or unauthorized" }

    await prisma.position.delete({ where: { id: positionId } })

    // ── Audit log ──────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: "POSITION_DELETED",
        resourceType: "Position",
        resourceId: positionId,
        metadata: { title: position.title, status: position.status },
      },
    }).catch((err) => console.error("[DeletePosition] Audit log failed:", err));

    revalidatePath("/org-admin/positions")
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function archivePositionAction(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Not found or unauthorized" }

    // ── Close all LIVE distributions before archiving ──────────────────
    await prisma.jobDistribution.updateMany({
      where: { positionId, status: "LIVE" },
      data: { status: "CLOSED", unpublishedAt: new Date() },
    })

    // ── Unpublish position + archive ──────────────────────────────────
    await prisma.position.update({
      where: { id: positionId },
      data: { status: "ARCHIVED", isPublished: false },
    })

    // ── Audit log ──────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: "POSITION_ARCHIVED",
        resourceType: "Position",
        resourceId: positionId,
        metadata: { title: position.title, previousStatus: position.status },
      },
    }).catch((err) => console.error("[ArchivePosition] Audit log failed:", err));

    revalidatePath("/org-admin/positions")
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function closePositionAction(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Not found or unauthorized" }
    if (position.status === "CLOSED" || position.status === "ARCHIVED") {
      return { success: false, error: "Position is already closed or archived" }
    }

    // ── Close all LIVE distributions ─────────────────────────────────
    await prisma.jobDistribution.updateMany({
      where: { positionId, status: "LIVE" },
      data: { status: "CLOSED", unpublishedAt: new Date() },
    })

    // ── Update position status ───────────────────────────────────────
    await prisma.position.update({
      where: { id: positionId },
      data: { status: "CLOSED", isPublished: false },
    })

    // ── Audit log ────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: "POSITION_CLOSED",
        resourceType: "Position",
        resourceId: positionId,
        metadata: { title: position.title, previousStatus: position.status, closedBy: "MANUAL" },
      },
    }).catch((err) => console.error("[ClosePosition] Audit log failed:", err));

    // ── Notify recruiters ────────────────────────────────────────────
    try {
      const { createBulkNotifications } = await import("@/lib/notification-service")
      const recruiters = await prisma.user.findMany({
        where: {
          organizationId: perms.orgId,
          roles: { hasSome: ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"] },
          isDeleted: false,
          id: { not: perms.userId }, // Don't notify the person who closed it
        },
        select: { id: true },
      })
      if (recruiters.length > 0) {
        await createBulkNotifications(
          recruiters.map((u) => ({
            organizationId: perms.orgId,
            userId: u.id,
            type: "POSITION_CLOSED" as const,
            title: "Position Closed",
            body: `"${position.title}" has been manually closed. All job board listings have been unpublished.`,
            link: `/org-admin/positions/${positionId}`,
          })),
        )
      }
    } catch (notifyErr) {
      console.warn("[ClosePosition] Notification failed (non-blocking):", notifyErr)
    }

    revalidatePath("/org-admin/positions")
    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
export async function dispatchVendorInvites(positionId: string, vendorOrgIds: string[]) {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Not found or unauthorized" }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com";
    const dropzoneUrl = `${appUrl}/vendor/positions/${positionId}`;

    // Get client org name for email context
    const clientOrg = await prisma.organization.findUnique({
      where: { id: perms.orgId },
      select: { name: true },
    });
    const clientOrgName = clientOrg?.name || "A client organization";

    // Execute bulk upsert mapping logic
    for (const vendorOrgId of vendorOrgIds) {
      await prisma.positionVendor.upsert({
        where: { positionId_vendorOrgId: { positionId, vendorOrgId } },
        update: { status: "ACTIVE" },
        create: { positionId, vendorOrgId, status: "ACTIVE", dispatchedById: perms.userId },
      });

      // Send dispatch email to vendor's contact email
      const vendorRelation = await prisma.clientVendorRelation.findUnique({
        where: { clientOrgId_vendorOrgId: { clientOrgId: perms.orgId, vendorOrgId } },
        select: { contactEmail: true },
      });
      const vendorOrg = await prisma.organization.findUnique({
        where: { id: vendorOrgId },
        select: { name: true },
      });

      if (vendorRelation?.contactEmail) {
        // Non-blocking — don't let email failure break the dispatch
        mailService.sendGenericEmail({
          to: vendorRelation.contactEmail,
          subject: `New Position Dispatched: ${position.title}`,
          heading: `\ud83d\udccb New Position: ${position.title}`,
          body: [
            `<strong>${clientOrgName}</strong> has dispatched a position to your agency.`,
            ``,
            `<strong>Position:</strong> ${position.title}`,
            `<strong>Organization:</strong> ${clientOrgName}`,
            ``,
            `You can start uploading candidate resumes immediately using the secure dropzone link below.`,
          ].join("\n"),
          ctaLabel: "Open Dropzone & Upload Candidates",
          ctaUrl: dropzoneUrl,
        }).catch((err) => console.error(`[dispatchVendorInvites] Email to ${vendorRelation.contactEmail} failed:`, err));
      }
    }

    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// ── New Email-Based Vendor Dispatch (uses auto-provisioning) ──────────────────

export async function dispatchToVendorByEmail(positionId: string, vendorEmail: string) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

  const { dispatchPositionToVendor } = await import("@/lib/vendor-provisioning")
  return dispatchPositionToVendor({
    positionId,
    vendorEmail,
    dispatchedById: perms.userId,
    clientOrgId: perms.orgId,
  })
}

export async function revokeVendorAction(positionId: string, vendorOrgId: string) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

  const { revokeVendorDispatch } = await import("@/lib/vendor-provisioning")
  return revokeVendorDispatch({
    positionId,
    vendorOrgId,
    revokedById: perms.userId,
    clientOrgId: perms.orgId,
  })
}

// ── Vendor Stage Update (client updates candidate stage for vendor tracking) ──

export async function updateVendorStageAction(
  resumeId: string,
  stage: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: true },
    })

    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Resume not found or unauthorized" }
    }

    if (!resume.vendorOrgId) {
      return { success: false, error: "This resume was not submitted by a vendor." }
    }

    const previousStage = resume.vendorStage || "SUBMITTED";

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        vendorStage: stage as any,
        vendorStageUpdatedAt: new Date(),
        vendorStageNotes: notes || null,
      },
    })

    // ── Audit log for stage change ───────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: "VENDOR_STAGE_UPDATE",
        resourceType: "Resume",
        resourceId: resumeId,
        metadata: {
          candidateName: resume.candidateName || resume.originalFileName,
          positionId: resume.positionId,
          positionTitle: resume.position.title,
          vendorOrgId: resume.vendorOrgId,
          previousStage,
          newStage: stage,
          notes: notes || null,
        },
      },
    });

    // ── Notify vendor of stage change (non-blocking) ────────────────────
    const vendorRelation = await prisma.clientVendorRelation.findUnique({
      where: {
        clientOrgId_vendorOrgId: {
          clientOrgId: perms.orgId,
          vendorOrgId: resume.vendorOrgId,
        },
      },
      select: { contactEmail: true },
    });

    if (vendorRelation?.contactEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com";
      const candidateLabel = resume.candidateName || resume.originalFileName;
      const stageLabel = stage.replace(/_/g, " ");
      const prevLabel = previousStage.replace(/_/g, " ");

      mailService.sendGenericEmail({
        to: vendorRelation.contactEmail,
        subject: `Candidate Update: ${candidateLabel} — ${stageLabel}`,
        heading: `📊 Candidate Stage Updated`,
        body: [
          `Your candidate <strong>${candidateLabel}</strong> for <strong>${resume.position.title}</strong> has been moved to a new stage.`,
          ``,
          `<strong>Previous Stage:</strong> ${prevLabel}`,
          `<strong>New Stage:</strong> ${stageLabel}`,
          ...(notes ? [``, `<strong>Client Notes:</strong> ${notes}`] : []),
          ``,
          `View the full details in your Vendor Portal.`,
        ].join("\n"),
        ctaLabel: "View in Vendor Portal",
        ctaUrl: `${appUrl}/org-admin/vendor-portal/${resume.positionId}`,
      }).catch((err) => console.error(`[updateVendorStage] Email notification failed:`, err));
    }

    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export interface TextExtractionResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ fileName: string; error: string }>
}

export async function bulkExtractTextAction(positionId: string): Promise<{ success: boolean; result?: TextExtractionResult; error?: string }> {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { resumes: { orderBy: { uploadedAt: "asc" } } },
  })

  if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Position not found or unauthorized" }
  if (position.resumes.length === 0) return { success: false, error: "No resumes to process" }

  const result: TextExtractionResult = { total: position.resumes.length, succeeded: 0, failed: 0, skipped: 0, errors: [] }

  const { aiConfig } = await import("@/lib/ai/config");
  const processResume = async (resume: typeof position.resumes[0]) => {
    try {
      // Skip resumes that already have raw text extracted
      if (resume.rawExtractedText || resume.extractedText) {
        result.skipped++
        return
      }

      // Mark as extracting
      await prisma.resume.update({
        where: { id: resume.id },
        data: { extractionStatus: "EXTRACTING" },
      })

      // Extract raw text from the file
      const textResult = await fileExtractor.extractText(
        resume.storagePath,
        resume.mimeType,
        resume.originalFileName
      )

      if (!textResult.success || !textResult.text) {
        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            extractionStatus: "FAILED",
            parsingNotes: textResult.error || "Text extraction failed",
          },
        })
        result.failed++
        result.errors.push({ fileName: resume.originalFileName, error: textResult.error || "Text extraction failed" })
        return
      }

      // Save raw text — both fields for backward compat + new schema
      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          extractedText:    textResult.text,
          rawExtractedText: textResult.text,
          extractionStatus: "EXTRACTED",
          extractedAt:      new Date(),
          parsingNotes:     textResult.warnings.length > 0
            ? `Parser (${textResult.parser}): ${textResult.warnings.join("; ")}`
            : `Extracted via ${textResult.parser} — ${textResult.charCount} chars`,
        },
      })

      result.succeeded++
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`[bulkExtractTextAction] Failed for ${resume.originalFileName}:`, errMsg)

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          extractionStatus: "FAILED",
          parsingNotes: `Text extraction error: ${errMsg}`,
        },
      })

      result.failed++
      result.errors.push({ fileName: resume.originalFileName, error: errMsg })
    }
  }

  if (aiConfig.mode === "prod") {
    await Promise.all(position.resumes.map(processResume))
  } else {
    for (const r of position.resumes) await processResume(r)
  }

  // Update position-level AI timestamp
  await prisma.position.update({
    where: { id: positionId },
    data: { aiLastExtractionRunAt: new Date() },
  })

  revalidatePath(`/org-admin/positions/${positionId}`)
  return { success: true, result }
}

export async function bulkExtractAllAction(positionId: string, forceReExtract: boolean = false): Promise<{ success: boolean; result?: BulkExtractionResult; error?: string }> {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: {
      resumes: {
        orderBy: { uploadedAt: "asc" },
      },
    },
  })

  if (!position || position.organizationId !== perms.orgId) {
    return { success: false, error: "Position not found or unauthorized" }
  }

  if (position.resumes.length === 0) {
    return { success: false, error: "No resumes to process" }
  }

  const result: BulkExtractionResult = {
    total: position.resumes.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    warnings: 0,
    errors: [],
  }

  const usageLogs: any[] = []

  // Load AI services once (not inside the loop to avoid repeated dynamic imports)
  const { hiringAi } = await import("@/lib/ai")
  const { aiConfig } = await import("@/lib/ai/config")
  const { validateAndNormalizeExtraction } = await import("@/lib/ai/extraction-validator")
  const provider = aiConfig.provider

  // Process each resume (sequential in dev, parallel in prod)
  const processResume = async (resume: typeof position.resumes[0]) => {
    try {
      if (!forceReExtract && (resume.parsingStatus === "EXTRACTED" || resume.parsingStatus === "RANKED") && resume.candidateName) {
        result.skipped++
        return
      }

      // ── Step 1: Extract raw text if not already done ──────────────────
      let rawText = resume.extractedText

      if (!rawText) {
        // Mark as extracting
        await prisma.resume.update({
          where: { id: resume.id },
          data: { parsingStatus: "EXTRACTING", extractionStatus: "EXTRACTING" },
        })

        // Use the new fileExtractor — handles both Vercel Blob URLs and local paths
        const textResult = await fileExtractor.extractText(
          resume.storagePath,
          resume.mimeType,
          resume.originalFileName
        )

        if (!textResult.success || !textResult.text) {
          await prisma.resume.update({
            where: { id: resume.id },
            data: {
              parsingStatus:    "FAILED",
              extractionStatus: "FAILED",
              parsingNotes:     textResult.error || "Text extraction failed",
            },
          })
          result.failed++
          result.errors.push({ fileName: resume.originalFileName, error: textResult.error || "Text extraction failed" })
          return
        }

        rawText = textResult.text

        // Save raw text immediately — visible on details page before AI runs
        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            extractedText:    rawText,   // legacy compat field
            rawExtractedText: rawText,   // new dedicated field (Step 116)
            parsingNotes:     textResult.warnings.length > 0
              ? `Parser warnings: ${textResult.warnings.join("; ")}`
              : null,
          },
        })
      }

      // ── Step 2: Run AI structured extraction ─────────────────────────
      const rawExtracted = await hiringAi.extractResumeJson(rawText)
      const { data: extracted, warnings } = validateAndNormalizeExtraction(rawExtracted)

      // ── Step 2.5: Vendor Conflict Detection Engine ─────────────────
      let isDuplicate = false;
      if (extracted.candidateEmail || extracted.phoneNumber) {
        const queryOr = [];
        if (extracted.candidateEmail) queryOr.push({ candidateEmail: extracted.candidateEmail });
        if (extracted.phoneNumber) queryOr.push({ phoneNumber: extracted.phoneNumber });
        
        if (queryOr.length > 0) {
          const conflicts = await prisma.resume.findFirst({
            where: {
              positionId,
              id: { not: resume.id }, // Exclude self
              OR: queryOr
            },
            select: { id: true }
          });
          if (conflicts) isDuplicate = true;
        }
      }

      if (rawExtracted.usage) {
        usageLogs.push({
          positionId,
          resumeId: resume.id,
          provider: rawExtracted.usage.provider,
          model: rawExtracted.usage.model,
          taskType: "EXTRACTION",
          inputTokens: rawExtracted.usage.inputTokens,
          outputTokens: rawExtracted.usage.outputTokens,
          totalTokens: rawExtracted.usage.totalTokens,
          estimatedCost: rawExtracted.usage.estimatedCost,
          promptVersion: rawExtracted.usage.promptVersion
        })
      }

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus:          "EXTRACTED",
          extractionStatus:       "EXTRACTED",
          isDuplicate:            isDuplicate,
          extractedAt:            new Date(),
          candidateName:          extracted.candidateName,
          candidateEmail:         extracted.candidateEmail,
          phoneNumber:            extracted.phoneNumber,
          linkedinUrl:            extracted.linkedinUrl,
          location:               extracted.location,
          skillsJson:             extracted.skills,
          experienceYears:        extracted.experienceYears,
          educationJson:          extracted.education,
          companiesJson:          extracted.companies,
          extractionProvider:     provider,
          extractionConfidence:   extracted.extractionConfidence ?? null,
          aiRawOutputJson:        extracted.rawOutput ?? Prisma.JsonNull,
          validationWarningsJson: warnings.length > 0 ? warnings : Prisma.JsonNull,
          parsingNotes:           warnings.length > 0 ? `${warnings.length} validation warning(s)` : null,
        },
      })

      result.succeeded++
      if (warnings.length > 0) result.warnings++

      // Throttle for free-tier Gemini API Limits (15 requests per minute)
      if (provider === "gemini") await new Promise((r) => setTimeout(r, 4000))

    } catch (error) {
      // Log and continue — a single resume failure must not stop the rest
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`[bulkExtractAllAction] Failed for ${resume.originalFileName}:`, errMsg)

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus: "FAILED",
          parsingNotes:  `Bulk extraction error: ${errMsg}`,
        },
      })

      result.failed++
      result.errors.push({ fileName: resume.originalFileName, error: errMsg })
    }
  }

  if (aiConfig.mode === "prod") {
    await Promise.all(position.resumes.map(processResume))
  } else {
    for (const r of position.resumes) await processResume(r)
  }

  // Log the batch run
  await prisma.positionBatchRun.create({
    data: {
      positionId,
      actionType: "EXTRACTION",
      status: result.failed === 0 ? "COMPLETED" : result.succeeded > 0 ? "PARTIAL_SUCCESS" : "FAILED",
      totalProcessed: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      detailsJson: result.errors.length > 0 ? JSON.stringify(result.errors) : undefined
    }
  })

  // Revalidate both the position page and each individual resume page
  revalidatePath(`/org-admin/positions/${positionId}`)
  for (const resume of position.resumes) {
    revalidatePath(`/org-admin/resumes/${resume.id}`)
  }

  return { success: true, result }
}

export interface BulkRankingResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ fileName: string; error: string }>
}

export async function bulkRankAllAction(positionId: string, filterResumeIds?: string[]): Promise<{ success: boolean; result?: BulkRankingResult; error?: string }> {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: {
      resumes: {
        orderBy: { uploadedAt: "asc" },
      },
    },
  })

  if (!position || position.organizationId !== perms.orgId) {
    return { success: false, error: "Position not found or unauthorized" }
  }

  if (!position.jdText || position.jdText.trim() === "") {
    return { success: false, error: "Position has no Job Description. Add one before ranking." }
  }

  // Only rank resumes that have been extracted (+ optional pre-screen filter)
  let resumesToRank = position.resumes.filter(
    (r) => r.extractedText && (r.parsingStatus === "EXTRACTED" || r.parsingStatus === "RANKED")
  )

  // If a pre-screen filter is provided, only rank those specific resumes
  if (filterResumeIds && filterResumeIds.length > 0) {
    const filterSet = new Set(filterResumeIds)
    resumesToRank = resumesToRank.filter((r) => filterSet.has(r.id))
  }

  if (resumesToRank.length === 0) {
    return { success: false, error: "No extracted resumes available to rank. Run extraction first." }
  }

  const result: BulkRankingResult = {
    total: resumesToRank.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  const usageLogs: any[] = []

  const { hiringAi } = await import("@/lib/ai")
  const { aiConfig } = await import("@/lib/ai/config")
  const provider = aiConfig.provider;
  const emailMap = new Set<string>();
  const phoneMap = new Set<string>();

  const processResume = async (resume: typeof resumesToRank[0]) => {
    try {
      await prisma.resume.update({
        where: { id: resume.id },
        data: { parsingStatus: "RANKING" },
      })

      const extractedBase = {
        candidateName: resume.candidateName,
        candidateEmail: resume.candidateEmail,
        phoneNumber: resume.phoneNumber,
        linkedinUrl: resume.linkedinUrl,
        location: resume.location,
        skills: Array.isArray(resume.skillsJson) ? (resume.skillsJson as string[]) : [],
        summary: null,
        experienceYears: resume.experienceYears,
        education: Array.isArray(resume.educationJson) ? resume.educationJson as any[] : [],
        companies: Array.isArray(resume.companiesJson) ? resume.companiesJson as any[] : [],
      };

      let jdAnalysis;
      if (position.jdKeywordsJson && position.jdRequiredSkillsJson) {
        jdAnalysis = {
          keywords: position.jdKeywordsJson as string[],
          requiredSkills: position.jdRequiredSkillsJson as string[],
          preferredSkills: (position.jdPreferredSkillsJson as string[]) || [],
          seniority: null,
          roleType: null,
          structuredJd: (position.structuredJdJson as Record<string, any>) || {}
        };
      }

      const rankData = await hiringAi.rankCandidateAgainstJd(
        extractedBase,
        resume.extractedText || "", 
        position.jdText || "",
        jdAnalysis
      )
      if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

      if (rankData.usage) {
        usageLogs.push({
          positionId,
          resumeId: resume.id,
          provider: rankData.usage.provider,
          model: rankData.usage.model,
          taskType: "RANKING",
          inputTokens: rankData.usage.inputTokens,
          outputTokens: rankData.usage.outputTokens,
          totalTokens: rankData.usage.totalTokens,
          estimatedCost: rankData.usage.estimatedCost,
          promptVersion: rankData.usage.promptVersion
        })
      }

      let isNearDuplicate = false;
      let duplicateReason = null;

      if (extractedBase.candidateEmail) emailMap.add(extractedBase.candidateEmail.toLowerCase());
      if (extractedBase.phoneNumber) phoneMap.add(extractedBase.phoneNumber);

      // ── Gap 3: Snapshot previous ranking before overwrite ───────────
      const prevRankSnapshot = (resume.jdMatchScore != null || resume.matchScore != null) ? {
        _aiDecisionSnapshot: {
          jdMatchScore: resume.jdMatchScore,
          jdMatchLabel: resume.jdMatchLabel,
          matchScore: resume.matchScore,
          matchLabel: resume.matchLabel,
          rankingExplanation: resume.rankingExplanation,
          rankedAt: resume.rankedAt?.toISOString() ?? null,
          snapshotAt: new Date().toISOString(),
          snapshotReason: "RE_RANKED",
        }
      } : null

      const existingRankHistory = Array.isArray(resume.aiRawOutputJson)
        ? (resume.aiRawOutputJson as any[])
        : resume.aiRawOutputJson && typeof resume.aiRawOutputJson === "object"
          ? [resume.aiRawOutputJson]
          : []

      const updatedRankHistory = prevRankSnapshot
        ? [...existingRankHistory, prevRankSnapshot]
        : existingRankHistory

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus: "RANKED",
          rankingStatus: "RANKED",
          matchScore: rankData.matchScore,
          matchLabel: rankData.matchLabel,
          jdMatchScore: rankData.jdMatchScore,
          jdMatchLabel: rankData.jdMatchLabel,
          matchedSkillsJson: rankData.matchedSkills as any,
          missingSkillsJson: rankData.missingSkills as any,
          rankingExplanation: rankData.rankingExplanation,
          notableStrengthsJson: rankData.notableStrengths as any,
          possibleGapsJson: rankData.possibleGaps as any,
          rankedAt: new Date(),
          aiRawOutputJson: updatedRankHistory.length > 0 ? (updatedRankHistory as any) : undefined,

          isNearDuplicate,
          duplicateReason
        },
      })

      result.succeeded++
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error"
      console.error(`[bulkRankAllAction] Failed for ${resume.originalFileName}:`, errMsg)

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus: "FAILED",
          parsingNotes: `Bulk ranking error: ${errMsg}`,
        },
      })

      result.failed++
      result.errors.push({ fileName: resume.originalFileName, error: errMsg })
    }
  }

  if (aiConfig.mode === "prod") {
    await Promise.all(resumesToRank.map(processResume))
  } else {
    for (const r of resumesToRank) await processResume(r)
  }

  // Log the batch run
  await prisma.positionBatchRun.create({
    data: {
      positionId,
      actionType: "RANKING",
      status: result.failed === 0 ? "COMPLETED" : result.succeeded > 0 ? "PARTIAL_SUCCESS" : "FAILED",
      totalProcessed: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      detailsJson: result.errors.length > 0 ? JSON.stringify(result.errors) : undefined
    }
  })

  if (usageLogs.length > 0) {
    await prisma.aiUsageLog.createMany({ data: usageLogs })
  }

  revalidatePath(`/org-admin/positions/${positionId}`)
  for (const resume of position.resumes) {
    revalidatePath(`/org-admin/resumes/${resume.id}`)
  }

  return { success: true, result }
}

export interface BulkAdvancedJudgmentResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ fileName: string; error: string }>
}

export async function bulkAdvancedJudgmentAction(positionId: string, limit: number = 10, force: boolean = false): Promise<{ success: boolean; result?: BulkAdvancedJudgmentResult; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        resumes: {
          where: { rankingStatus: "RANKED" },
          orderBy: { matchScore: "desc" },
        },
      },
    })

    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found or unauthorized" }
    }

    const resumesToJudge = position.resumes.slice(0, limit)
    if (resumesToJudge.length === 0) {
      return { success: false, error: "No ranked resumes available for advanced judgment. Run ranking first." }
    }

    const { hiringAi } = await import("@/lib/ai")
    const { aiConfig } = await import("@/lib/ai/config")
    const provider = aiConfig.provider;

    const result: BulkAdvancedJudgmentResult = {
      total: resumesToJudge.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    const usageLogs: any[] = []

    const processResume = async (resume: typeof resumesToJudge[0]) => {
      if (!force && resume.advancedJudgmentAt) {
        result.skipped++
        return
      }
      try {
        const extractedBase = {
          candidateName: resume.candidateName,
          candidateEmail: resume.candidateEmail,
          phoneNumber: resume.phoneNumber,
          linkedinUrl: resume.linkedinUrl,
          location: resume.location,
          skills: Array.isArray(resume.skillsJson) ? (resume.skillsJson as string[]) : [],
          summary: null,
          experienceYears: resume.experienceYears,
          education: Array.isArray(resume.educationJson) ? resume.educationJson as any[] : [],
          companies: Array.isArray(resume.companiesJson) ? resume.companiesJson as any[] : [],
        };

        const rankData = {
          matchScore: resume.matchScore ?? 0,
          matchLabel: resume.matchLabel ?? "WEAK_MATCH",
          jdMatchScore: resume.jdMatchScore ?? 0,
          jdMatchLabel: resume.jdMatchLabel ?? "WEAK_MATCH",
          matchedSkills: Array.isArray(resume.matchedSkillsJson) ? resume.matchedSkillsJson as string[] : [],
          missingSkills: Array.isArray(resume.missingSkillsJson) ? resume.missingSkillsJson as string[] : [],
          rankingExplanation: resume.rankingExplanation ?? "",
          notableStrengths:     Array.isArray(resume.notableStrengthsJson) ? resume.notableStrengthsJson as string[] : [],
          possibleGaps:         Array.isArray(resume.possibleGapsJson) ? resume.possibleGapsJson as string[] : [],
        };

        let recommendationData, interviewPrepData, redFlagsData;

        if (aiConfig.mode === "prod") {
          // PROD: Run all 3 heavy sub-tasks concurrently to cut advanced judgment time from 120s down to 40s
          [recommendationData, interviewPrepData, redFlagsData] = await Promise.all([
            hiringAi.runAdvancedCandidateJudgment(rankData, extractedBase),
            hiringAi.generateInterviewPrep(extractedBase, rankData, position.jdText || ""),
            hiringAi.analyzeRedFlags(extractedBase, resume.extractedText || "")
          ]);
        } else {
          // DEV: Sequential with strict 4s throttles for free-tier protection
          recommendationData = await hiringAi.runAdvancedCandidateJudgment(rankData, extractedBase);
          if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

          interviewPrepData = await hiringAi.generateInterviewPrep(extractedBase, rankData, position.jdText || "");
          if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

          redFlagsData = await hiringAi.analyzeRedFlags(extractedBase, resume.extractedText || "");
          if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));
        }

        const logsToAdd = [recommendationData, interviewPrepData, redFlagsData];
        logsToAdd.forEach((logItem) => {
          if (logItem.usage) {
            usageLogs.push({
              positionId,
              resumeId: resume.id,
              provider: logItem.usage.provider,
              model: logItem.usage.model,
              taskType: "ADVANCED_JUDGMENT",
              inputTokens: logItem.usage.inputTokens,
              outputTokens: logItem.usage.outputTokens,
              totalTokens: logItem.usage.totalTokens,
              estimatedCost: logItem.usage.estimatedCost,
              promptVersion: logItem.usage.promptVersion
            })
          }
        });
        
        // ── Gap 3: Snapshot previous judgment before overwrite ──────────
        const prevJudgmentSnapshot = resume.aiRecommendationLabel ? {
          _aiDecisionSnapshot: {
            aiRecommendationLabel: resume.aiRecommendationLabel,
            aiRecommendationRationale: resume.aiRecommendationRationale,
            finalRecommendationLabel: resume.finalRecommendationLabel,
            advancedJudgmentProvider: resume.advancedJudgmentProvider,
            advancedJudgmentAt: resume.advancedJudgmentAt?.toISOString() ?? null,
            snapshotAt: new Date().toISOString(),
            snapshotReason: "RE_JUDGED",
          }
        } : null

        const existingJudgHistory = Array.isArray(resume.aiRawOutputJson)
          ? (resume.aiRawOutputJson as any[])
          : resume.aiRawOutputJson && typeof resume.aiRawOutputJson === "object"
            ? [resume.aiRawOutputJson]
            : []

        const updatedJudgHistory = prevJudgmentSnapshot
          ? [...existingJudgHistory, prevJudgmentSnapshot]
          : existingJudgHistory

        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            advancedJudgmentProvider: provider,
            advancedJudgmentAt: new Date(),
            finalRecommendationLabel: recommendationData.recommendation,
            finalRecommendationReason: recommendationData.rationale,

            aiRecommendationLabel: recommendationData.recommendation,
            aiRecommendationRationale: recommendationData.rationale,
            aiInterviewFocusJson: interviewPrepData.focusAreas as any,
            aiInterviewQuestionsJson: interviewPrepData.questions as any,
            aiRedFlagsJson: redFlagsData.flags as any,
            aiRawOutputJson: updatedJudgHistory.length > 0 ? (updatedJudgHistory as any) : undefined,
          },
        })

        result.succeeded++
      } catch (err: any) {
        result.failed++
        result.errors.push({ fileName: resume.originalFileName, error: err.message })
      }
    }

    if (aiConfig.mode === "prod") {
      await Promise.all(resumesToJudge.map(processResume))
    } else {
      for (const r of resumesToJudge) await processResume(r)
    }

    if (usageLogs.length > 0) {
      await prisma.aiUsageLog.createMany({ data: usageLogs })
    }

    await prisma.positionBatchRun.create({
      data: {
        positionId,
        actionType: "ADVANCED_JUDGMENT" as any,
        status: result.failed === 0 ? "COMPLETED" : result.succeeded > 0 ? "PARTIAL_SUCCESS" : "FAILED",
        totalProcessed: result.total,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
        detailsJson: result.errors.length > 0 ? JSON.stringify(result.errors) : undefined
      }
    })

    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true, result }
  } catch (error) {
     return { success: false, error: "System error running advanced judgment" }
  }
}

export async function bulkProcessAllAction(positionId: string, forceReExtract: boolean = false): Promise<{
  success: boolean
  error?: string
  warning?: string
  extractResult?: BulkExtractionResult
  rankResult?: BulkRankingResult
  judgmentResult?: BulkAdvancedJudgmentResult
  preScreened?: number
  autoShortlisted?: number
  autoInvited?: number
}> {
  // Fetch position settings for the funnel
  const posSettings = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      atsPreScreenSize: true,
      aiShortlistSize: true,
      autoInviteAiScreen: true,
      jdRequiredSkillsJson: true,
      jdPreferredSkillsJson: true,
    },
  })

  const atsTopN = posSettings?.atsPreScreenSize ?? 100
  const aiTopN = posSettings?.aiShortlistSize ?? 10

  // ── Step 1: Extract all ──────────────────────────────────────────────────
  const extractRes = await bulkExtractAllAction(positionId, forceReExtract)
  if (!extractRes.success) {
    return { success: false, error: `Extraction failed: ${extractRes.error}` }
  }

  // ── Step 2: ATS Pre-Screen (zero-cost keyword matching) ──────────────────
  const allResumes = await prisma.resume.findMany({
    where: {
      positionId,
      extractedText: { not: null },
      parsingStatus: { in: ["EXTRACTED", "RANKED"] },
    },
    select: {
      id: true,
      rawExtractedText: true,
      extractedText: true,
    },
  })

  const requiredSkills = Array.isArray(posSettings?.jdRequiredSkillsJson)
    ? (posSettings.jdRequiredSkillsJson as string[])
    : []
  const preferredSkills = Array.isArray(posSettings?.jdPreferredSkillsJson)
    ? (posSettings.jdPreferredSkillsJson as string[])
    : []

  let preScreenedIds: string[] | undefined
  let preScreenedCount = allResumes.length

  if (allResumes.length > atsTopN && (requiredSkills.length > 0 || preferredSkills.length > 0)) {
    // Only run pre-screen if we have more resumes than the limit and skills to match against
    const { topIds } = atsPreScreen(allResumes, requiredSkills, preferredSkills, atsTopN)
    preScreenedIds = topIds
    preScreenedCount = topIds.length
    console.log(`[pipeline] ATS pre-screen: ${allResumes.length} → ${preScreenedCount} resumes`)
  } else {
    console.log(`[pipeline] ATS pre-screen: skipped (${allResumes.length} ≤ ${atsTopN} or no skills)`)
  }

  // ── Step 3: AI Rank (only the pre-screened pool) ─────────────────────────
  const rankRes = await bulkRankAllAction(positionId, preScreenedIds)
  if (!rankRes.success) {
    return { 
      success: true, 
      warning: `Extraction completed, but Ranking failed: ${rankRes.error}`,
      extractResult: extractRes.result,
      preScreened: preScreenedCount,
    }
  }

  const judgmentRes = await bulkAdvancedJudgmentAction(positionId, aiTopN, forceReExtract)

  // ── Step 4: Auto-shortlist top N by matchScore ───────────────────────────
  let autoShortlisted = 0
  try {
    const topResumes = await prisma.resume.findMany({
      where: {
        positionId,
        matchScore: { gte: 60 }, // Only auto-shortlist candidates with at least 60% match
        parsingStatus: "RANKED",
      },
      orderBy: { matchScore: "desc" },
      take: aiTopN,
      select: { id: true },
    })

    if (topResumes.length > 0) {
      // Clear all existing shortlists for this position first
      await prisma.resume.updateMany({
        where: { positionId, isShortlisted: true },
        data: { isShortlisted: false },
      })

      // Shortlist the top N
      await prisma.resume.updateMany({
        where: { id: { in: topResumes.map((r) => r.id) } },
        data: { isShortlisted: true },
      })

      autoShortlisted = topResumes.length
      console.log(`[pipeline] Auto-shortlisted top ${autoShortlisted} candidates`)
    }
  } catch (e) {
    console.error("[pipeline] Auto-shortlist failed:", e)
  }

  // ── Step 5: Auto-Invite AI Screen (if enabled) ─────────────────────────
  let autoInvited = 0
  if (posSettings?.autoInviteAiScreen && autoShortlisted > 0) {
    try {
      // Check if position has an AI interview config
      const aiConfig = await prisma.aiInterviewConfig.findFirst({
        where: { positionId, interviewId: null },
        select: { id: true },
      })

      if (aiConfig) {
        // Get shortlisted candidates who don't already have an invite
        const shortlisted = await prisma.resume.findMany({
          where: {
            positionId,
            isShortlisted: true,
            invite: null, // no existing invite
            OR: [
              { candidateEmail: { not: null } },
              { overrideEmail: { not: null } },
            ],
          },
          select: { id: true, candidateEmail: true, overrideEmail: true, candidateName: true, overrideName: true, originalFileName: true },
        })

        const positionData = await prisma.position.findUnique({
          where: { id: positionId },
          select: { title: true },
        })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com"

        for (const resume of shortlisted) {
          const email = resume.overrideEmail || resume.candidateEmail
          if (!email) continue

          try {
            const invite = await prisma.interviewInvite.create({
              data: {
                resumeId: resume.id,
                positionId,
                targetEmail: email,
                status: "SENT",
              },
            })

            const candidateName = resume.overrideName || resume.candidateName || "Candidate"
            const inviteLink = `${baseUrl}/candidate/ai-interview/pre-check?inviteId=${invite.id}`

            await mailService.sendAiInterviewInvite({
              to: email,
              candidateName,
              positionTitle: positionData?.title || "Open Position",
              inviteLink,
              inviteId: invite.id,
            })

            autoInvited++
          } catch (inviteErr) {
            console.error(`[pipeline] Auto-invite failed for ${resume.originalFileName}:`, inviteErr)
          }
        }

        if (autoInvited > 0) {
          console.log(`[pipeline] Auto-invited ${autoInvited} shortlisted candidates for AI screening`)
        }
      } else {
        console.log("[pipeline] Auto-invite skipped — no AiInterviewConfig found for this position")
      }
    } catch (e) {
      console.error("[pipeline] Auto-invite failed:", e)
    }
  }

  // Log the batch run for the entire pipeline
  await prisma.positionBatchRun.create({
    data: {
      positionId,
      actionType: "FULL_PIPELINE",
      status: (!rankRes.success || (judgmentRes && !judgmentRes.success)) ? "PARTIAL_SUCCESS" : "COMPLETED",
      totalProcessed: extractRes.result?.total || 0,
      succeeded: extractRes.result?.succeeded || 0,
      failed: (extractRes.result?.failed || 0) + (rankRes.result?.failed || 0) + (judgmentRes.result?.failed || 0),
      skipped: (extractRes.result?.skipped || 0) + (rankRes.result?.skipped || 0) + (judgmentRes.result?.skipped || 0),
      detailsJson: JSON.stringify({
        extractErrors: extractRes.error,
        rankErrors: rankRes.error,
        judgmentErrors: judgmentRes.error,
        preScreened: preScreenedCount,
        autoShortlisted,
        autoInvited,
      })
    }
  })

  return { 
    success: true, 
    extractResult: extractRes.result, 
    rankResult: rankRes.result,
    judgmentResult: judgmentRes.result,
    preScreened: preScreenedCount,
    autoShortlisted,
    autoInvited,
  }
}

export async function toggleShortlistAction(resumeId: string, isShortlisted: boolean, notes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: true },
    })

    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Resume not found or unauthorized" }
    }

    await prisma.resume.update({
      where: { id: resumeId },
      data: { 
        isShortlisted,
        ...(notes !== undefined ? { recruiterNotes: notes } : {})
      },
    })
    
    // Log the update directly into batch trail so it shows up in activity globally
    await prisma.positionBatchRun.create({
      data: {
        positionId: resume.positionId,
        actionType: "SHORTLIST_UPDATE",
        status: "COMPLETED",
        totalProcessed: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        detailsJson: JSON.stringify([`Candidate ${resume.originalFileName} shortlisting set to ${isShortlisted}`])
      }
    })

    // ── Audit log — hiring decision step ────────────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: isShortlisted ? "CANDIDATE_SHORTLISTED" : "CANDIDATE_UNSHORTLISTED",
        resourceType: "Resume",
        resourceId: resumeId,
        metadata: {
          positionId: resume.positionId,
          candidateName: resume.overrideName || resume.candidateName || resume.originalFileName,
          isShortlisted,
          aiMatchScore: resume.matchScore,
          aiRecommendation: resume.finalRecommendationLabel,
          notes: notes || null,
        },
      },
    }).catch((err) => console.error("[Shortlist] Audit log failed:", err));

    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function overrideCandidateAction(
  resumeId: string, 
  data: { overrideName: string; overrideEmail: string; overridePhone: string; overrideLinkedinUrl: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: true },
    })

    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Resume not found or unauthorized" }
    }

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        overrideName: data.overrideName.trim() || null,
        overrideEmail: data.overrideEmail.trim() || null,
        overridePhone: data.overridePhone.trim() || null,
        overrideLinkedinUrl: data.overrideLinkedinUrl.trim() || null,
      },
    })
    
    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function bulkCreateInviteDraftsAction(positionId: string, resumeIds: string[]): Promise<{
  success: boolean
  error?: string
  result?: { created: number; skipped: number; total: number; failedLog?: string[] }
}> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { resumes: { where: { id: { in: resumeIds } } } }
    })

    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found or unauthorized" }
    }

    let created = 0
    let skipped = 0
    const failedLog: string[] = []

    for (const resume of position.resumes) {
      if (!resume.isShortlisted) {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (Not shortlisted)`)
        continue
      }
      
      const targetEmail = resume.overrideEmail || resume.candidateEmail
      if (!targetEmail) {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (No candidate email found)`)
        continue
      }

      await prisma.interviewInvite.upsert({
        where: { resumeId: resume.id },
        update: { targetEmail, status: "DRAFT" },
        create: {
          resumeId: resume.id,
          positionId: position.id,
          targetEmail,
          status: "DRAFT"
        }
      })
      created++
    }

    // Log the batch run
    await prisma.positionBatchRun.create({
      data: {
        positionId,
        actionType: "INVITE_DRAFTS",
        status: failedLog.length === 0 ? "COMPLETED" : created > 0 ? "PARTIAL_SUCCESS" : "FAILED",
        totalProcessed: resumeIds.length,
        succeeded: created,
        failed: 0,
        skipped,
        detailsJson: failedLog.length > 0 ? JSON.stringify(failedLog) : undefined
      }
    })

    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true, result: { created, skipped, total: resumeIds.length, failedLog } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function bulkSendInvitesAction(positionId: string, resumeIds: string[]): Promise<{
  success: boolean
  error?: string
  result?: { sent: number; skipped: number; total: number; failedLog?: string[] }
}> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { 
        resumes: { 
          where: { id: { in: resumeIds } },
          include: { invite: true }
        },
        // Step 224: detect AI interview config to choose correct invite route
        aiInterviewConfigs: {
          where: { interviewId: null },
          take: 1,
        },
        interviewPlan: {
          include: {
            stages: {
              orderBy: { stageIndex: "asc" }
            }
          }
        }
      }
    })

    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found or unauthorized" }
    }

    // Validation: Check if the first round is a human interview without a panel
    if (position.interviewPlan && position.interviewPlan.stages.length > 0) {
      const firstStage = position.interviewPlan.stages[0]
      if (firstStage.roundType !== "AI_SCREEN") {
        const hasPanel = firstStage.assignedPanelJson && Array.isArray(firstStage.assignedPanelJson) && firstStage.assignedPanelJson.length > 0
        if (!hasPanel) {
          return { success: false, error: "Cannot send invites: No interview panel assigned for the first round. Please edit the pipeline and select a panel." }
        }
      }
    }

    let sent = 0
    let skipped = 0
    const failedLog: string[] = []

    for (const resume of position.resumes) {
      let invite = resume.invite
      
      if (invite && invite.status !== "DRAFT") {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (Invite already ${invite.status})`)
        continue
      }

      if (!invite) {
        if (!resume.isShortlisted) {
           skipped++
           failedLog.push(`Skipped: ${resume.originalFileName} (Not shortlisted)`)
           continue
        }
        
        const targetEmail = resume.overrideEmail || resume.candidateEmail
        if (!targetEmail) {
          skipped++
          failedLog.push(`Skipped: ${resume.originalFileName} (No candidate email found)`)
          continue
        }

        invite = await prisma.interviewInvite.create({
          data: {
            resumeId: resume.id,
            positionId: position.id,
            targetEmail,
            status: "DRAFT"
          }
        })
      }

      const candidateName = resume.overrideName || resume.candidateName || "Candidate"

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com"
      // Step 224: Route to AI pre-check page when position has AI interview enabled
      const hasAiInterview = (position.aiInterviewConfigs?.length ?? 0) > 0
      const inviteLink = hasAiInterview
        ? `${baseUrl}/candidate/ai-interview/pre-check?inviteId=${invite.id}`
        : `${baseUrl}/interview/${invite.id}`

      // ── IDEMPOTENCY LOCK: Prevent Duplicate Sends ──────────────────────────
      // Atomically attempt to transition this specific invite from DRAFT to SENT.
      // If of 5 concurrent rapid clicks only 1 succeeds, it locks out the others.
      const lockClaim = await prisma.interviewInvite.updateMany({
        where: { id: invite.id, status: "DRAFT" },
        data: { status: "SENT" }
      })

      if (lockClaim.count === 0) {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (Race condition intercepted - already processing)`)
        continue
      }
      // ───────────────────────────────────────────────────────────────────────

      // Step 223/224: Use AI-specific email when position has AI interview enabled
      const mailRes = hasAiInterview
        ? await mailService.sendAiInterviewInvite({
            to: invite.targetEmail,
            candidateName,
            positionTitle: position.title,
            inviteLink,
            inviteId: invite.id,
          })
        : await mailService.sendInterviewInvite({
            to: invite.targetEmail,
            candidateName,
            positionTitle: position.title,
            inviteLink,
            inviteId: invite.id,
          })

      if (!mailRes.success) {
        // Revert the lock if the network provider completely failed
        await prisma.interviewInvite.update({
          where: { id: invite.id },
          data: { status: "DRAFT" }
        })
        skipped++
        failedLog.push(`Failed sending to ${invite.targetEmail} (${resume.originalFileName}): ${mailRes.error}`)
        continue
      }

      sent++
    }

    // Log the batch run
    await prisma.positionBatchRun.create({
      data: {
        positionId,
        actionType: "INVITE_SEND",
        status: failedLog.length === 0 ? "COMPLETED" : sent > 0 ? "PARTIAL_SUCCESS" : "FAILED",
        totalProcessed: resumeIds.length,
        succeeded: sent,
        failed: 0,
        skipped,
        detailsJson: failedLog.length > 0 ? JSON.stringify(failedLog) : undefined
      }
    })

    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true, result: { sent, skipped, total: resumeIds.length, failedLog } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function analyzeJdAction(positionId: string, forceReAnalyze: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) return { success: false, error: "Not found or unauthorized" };

    if (!position.jdText) return { success: false, error: "No Job Description text available" };

    if (!forceReAnalyze && position.structuredJdJson) {
      return { success: true };
    }

    const { hiringAi } = await import("@/lib/ai");
    const analysis = await hiringAi.analyzeJdJson(position.jdText, position.title);

    await prisma.position.update({
      where: { id: positionId },
      data: {
        structuredJdJson: analysis.structuredJd as any,
        jdKeywordsJson: analysis.keywords as any,
        jdRequiredSkillsJson: analysis.requiredSkills as any,
        jdPreferredSkillsJson: analysis.preferredSkills as any,
      }
    });

    if (analysis.usage) {
      await prisma.aiUsageLog.create({
        data: {
          positionId,
          provider: analysis.usage.provider,
          model: analysis.usage.model,
          taskType: "JD_ANALYSIS",
          inputTokens: analysis.usage.inputTokens,
          outputTokens: analysis.usage.outputTokens,
          totalTokens: analysis.usage.totalTokens,
          estimatedCost: analysis.usage.estimatedCost,
          promptVersion: analysis.usage.promptVersion
        }
      });
    }

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Internal error" };
  }
}

// ── Soft Delete Resume ──────────────────────────────────────────────────────
export async function softDeleteResumeAction(resumeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: { select: { id: true, organizationId: true } } },
    })

    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Resume not found or unauthorized" }
    }

    if (resume.isDeleted) {
      return { success: false, error: "Resume already deleted" }
    }

    // Soft delete: mark as deleted, unmark shortlist to avoid phantom counts
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isShortlisted: false, // clear shortlist to avoid phantom counts
      },
    })

    // Log the deletion in activity trail
    await prisma.positionBatchRun.create({
      data: {
        positionId: resume.position.id,
        actionType: "RESUME_DELETED",
        status: "COMPLETED",
        totalProcessed: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        detailsJson: JSON.stringify([`Removed candidate: ${resume.overrideName || resume.candidateName || resume.originalFileName}`]),
      },
    })

    revalidatePath(`/org-admin/positions/${resume.position.id}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete resume" }
  }
}

// ── Gap 1+2+3: Human Override of AI Recommendation with Audit Trail ─────────

export async function overrideAiRecommendationAction(
  resumeId: string,
  positionId: string,
  data: {
    overrideLabel: string;  // STRONG_HIRE | HIRE | MAYBE | NO_HIRE
    overrideReason: string; // Recruiter's rationale
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: { select: { id: true, organizationId: true } } },
    })
    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found or unauthorized" }
    }

    // ── Gap 3: Snapshot previous AI decision before overwriting ──────────
    const previousSnapshot = {
      aiRecommendationLabel: resume.aiRecommendationLabel,
      aiRecommendationRationale: resume.aiRecommendationRationale,
      finalRecommendationLabel: resume.finalRecommendationLabel,
      finalRecommendationReason: resume.finalRecommendationReason,
      jdMatchScore: resume.jdMatchScore,
      jdMatchLabel: resume.jdMatchLabel,
      advancedJudgmentProvider: resume.advancedJudgmentProvider,
      advancedJudgmentAt: resume.advancedJudgmentAt?.toISOString() ?? null,
      snapshotAt: new Date().toISOString(),
      snapshotReason: "HUMAN_OVERRIDE",
    }

    // Append to existing history array (or create new)
    const existingHistory = Array.isArray(resume.aiRawOutputJson)
      ? (resume.aiRawOutputJson as any[])
      : resume.aiRawOutputJson && typeof resume.aiRawOutputJson === "object"
        ? [resume.aiRawOutputJson]
        : []

    const updatedHistory = [...existingHistory, { _aiDecisionSnapshot: previousSnapshot }]

    // ── Update the resume with human override ─────────────────────────────
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        finalRecommendationLabel: data.overrideLabel,
        finalRecommendationReason: data.overrideReason,
        recruiterReviewNeeded: false,
        aiRawOutputJson: updatedHistory as any,
      },
    })

    // ── Gap 2: Immutable audit trail for the override ─────────────────────
    await prisma.auditLog.create({
      data: {
        organizationId: perms.orgId,
        userId: perms.userId,
        action: "AI_RECOMMENDATION_OVERRIDDEN",
        resourceType: "RESUME",
        resourceId: resumeId,
        metadata: {
          positionId,
          previousAiRecommendation: resume.aiRecommendationLabel,
          newHumanRecommendation: data.overrideLabel,
          humanRationale: data.overrideReason,
          overriddenAt: new Date().toISOString(),
        },
      },
    })

    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to override" }
  }
}
