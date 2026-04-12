"use server"

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resumeParser } from "@/lib/resume-parser"
import { mailService } from "@/lib/mail"
import { revalidatePath } from "next/cache"
import path from "path"

export interface BulkExtractionResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  warnings: number
  errors: Array<{ fileName: string; error: string }>
}

export async function bulkExtractAllAction(positionId: string): Promise<{ success: boolean; result?: BulkExtractionResult; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Unauthorized" }

  // Verify ownership
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: {
      resumes: {
        orderBy: { uploadedAt: "asc" },
      },
    },
  })

  if (!position || position.createdById !== userId) {
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

  // Load AI services once (not inside the loop to avoid repeated dynamic imports)
  const { resumeAiService } = await import("@/lib/ai/resume-ai-service")
  const { validateAndNormalizeExtraction } = await import("@/lib/ai/extraction-validator")
  const provider = process.env.GEMINI_API_KEY ? "gemini" : "mock"

  // Process each resume sequentially — safe for serverless, avoids rate-limit bursts
  for (const resume of position.resumes) {
    try {
      // ── Step 1: Extract raw text if not already done ──────────────────
      let rawText = resume.extractedText

      if (!rawText) {
        await prisma.resume.update({
          where: { id: resume.id },
          data: { parsingStatus: "EXTRACTING" },
        })

        const absolutePath = path.join(process.cwd(), "public", resume.storagePath)
        const textResult = await resumeParser.extractText({
          filePath: absolutePath,
          mimeType: resume.mimeType,
        })

        if (!textResult.success || !textResult.text) {
          await prisma.resume.update({
            where: { id: resume.id },
            data: {
              parsingStatus: "FAILED",
              parsingNotes: textResult.error || "Text extraction failed",
            },
          })
          result.failed++
          result.errors.push({ fileName: resume.originalFileName, error: textResult.error || "Text extraction failed" })
          continue // Move to next resume — don't stop the batch
        }

        rawText = textResult.text
        // Save the raw text now so it's visible on the detail page
        await prisma.resume.update({
          where: { id: resume.id },
          data: { extractedText: rawText },
        })
      }

      // ── Step 2: Run AI structured extraction ─────────────────────────
      const rawExtracted = await resumeAiService.extractResumeStructuredData(rawText)
      const { data: extracted, warnings } = validateAndNormalizeExtraction(rawExtracted)

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus:          "EXTRACTED",
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
          extractionConfidence:   null,
          aiRawOutputJson:        extracted.rawOutput ?? Prisma.JsonNull,
          validationWarningsJson: warnings.length > 0 ? warnings : Prisma.JsonNull,
          parsingNotes:           warnings.length > 0 ? `${warnings.length} validation warning(s)` : null,
        },
      })

      result.succeeded++
      if (warnings.length > 0) result.warnings++

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

export async function bulkRankAllAction(positionId: string): Promise<{ success: boolean; result?: BulkRankingResult; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Unauthorized" }

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: {
      resumes: {
        orderBy: { uploadedAt: "asc" },
      },
    },
  })

  if (!position || position.createdById !== userId) {
    return { success: false, error: "Position not found or unauthorized" }
  }

  if (!position.jdText || position.jdText.trim() === "") {
    return { success: false, error: "Position has no Job Description. Add one before ranking." }
  }

  // Only rank resumes that have been extracted
  const resumesToRank = position.resumes.filter(
    (r) => r.extractedText && (r.parsingStatus === "EXTRACTED" || r.parsingStatus === "RANKED")
  )

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

  const { resumeAiService } = await import("@/lib/ai/resume-ai-service")

  for (const resume of resumesToRank) {
    try {
      await prisma.resume.update({
        where: { id: resume.id },
        data: { parsingStatus: "RANKING" },
      })

      const rankData = await resumeAiService.rankResumeAgainstJD(resume.extractedText, position.jdText)

      await prisma.resume.update({
        where: { id: resume.id },
        data: {
          parsingStatus: "RANKED",
          rankingStatus: "RANKED",
          matchScore: rankData.matchScore,
          matchLabel: rankData.matchLabel,
          matchedSkillsJson: rankData.matchedSkills,
          missingSkillsJson: rankData.missingSkills,
          rankingExplanation: rankData.rankingExplanation,
          notableStrengthsJson: rankData.notableStrengths,
          possibleGapsJson: rankData.possibleGaps,
          rankedAt: new Date(),
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

  revalidatePath(`/org-admin/positions/${positionId}`)
  for (const resume of position.resumes) {
    revalidatePath(`/org-admin/resumes/${resume.id}`)
  }

  return { success: true, result }
}

export async function bulkProcessAllAction(positionId: string): Promise<{
  success: boolean
  error?: string
  warning?: string
  extractResult?: BulkExtractionResult
  rankResult?: BulkRankingResult
}> {
  const extractRes = await bulkExtractAllAction(positionId)
  if (!extractRes.success) {
    return { success: false, error: `Extraction failed: ${extractRes.error}` }
  }

  const rankRes = await bulkRankAllAction(positionId)
  if (!rankRes.success) {
    return { 
      success: true, 
      warning: `Extraction completed, but Ranking failed: ${rankRes.error}`,
      extractResult: extractRes.result
    }
  }

  // Log the batch run for the entire pipeline
  await prisma.positionBatchRun.create({
    data: {
      positionId,
      actionType: "FULL_PIPELINE",
      status: !rankRes.success ? "PARTIAL_SUCCESS" : "COMPLETED",
      totalProcessed: extractRes.result?.total || 0,
      succeeded: extractRes.result?.succeeded || 0,
      failed: (extractRes.result?.failed || 0) + (rankRes.result?.failed || 0),
      skipped: (extractRes.result?.skipped || 0) + (rankRes.result?.skipped || 0),
      detailsJson: JSON.stringify({ extractErrors: extractRes.error, rankErrors: rankRes.error })
    }
  })

  return { 
    success: true, 
    extractResult: extractRes.result, 
    rankResult: rankRes.result 
  }
}

export async function toggleShortlistAction(resumeId: string, isShortlisted: boolean, notes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: true },
    })

    if (!resume || resume.position.createdById !== userId) {
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
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { position: true },
    })

    if (!resume || resume.position.createdById !== userId) {
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
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { resumes: { where: { id: { in: resumeIds } } } }
    })

    if (!position || position.createdById !== userId) {
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
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: { 
        resumes: { 
          where: { id: { in: resumeIds } },
          include: { invite: true }
        } 
      }
    })

    if (!position || position.createdById !== userId) {
      return { success: false, error: "Position not found or unauthorized" }
    }

    let sent = 0
    let skipped = 0
    const failedLog: string[] = []

    for (const resume of position.resumes) {
      const invite = resume.invite
      if (!invite) {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (No invite draft found)`)
        continue
      }
      
      if (invite.status !== "DRAFT") {
        skipped++
        failedLog.push(`Skipped: ${resume.originalFileName} (Invite already ${invite.status})`)
        continue
      }

      const candidateName = resume.overrideName || resume.candidateName || "Candidate"

      const mailRes = await mailService.sendInterviewInvite({
        to: invite.targetEmail,
        candidateName,
        positionTitle: position.title,
      })

      if (!mailRes.success) {
        skipped++
        failedLog.push(`Failed sending to ${invite.targetEmail} (${resume.originalFileName}): ${mailRes.error}`)
        continue
      }

      // Success – update DB
      await prisma.interviewInvite.update({
        where: { id: invite.id },
        data: { status: "SENT" }
      })
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
