"use server"

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resumeParser } from "@/lib/resume-parser"
import { fileExtractor } from "@/lib/file-extractor"
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

export async function deletePositionAction(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.createdById !== userId) return { success: false, error: "Not found or unauthorized" }

    await prisma.position.delete({ where: { id: positionId } })
    revalidatePath("/org-admin/positions")
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function archivePositionAction(positionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({ where: { id: positionId } })
    if (!position || position.createdById !== userId) return { success: false, error: "Not found or unauthorized" }

    await prisma.position.update({ where: { id: positionId }, data: { status: "ARCHIVED" } })
    revalidatePath("/org-admin/positions")
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
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Unauthorized" }

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { resumes: { orderBy: { uploadedAt: "asc" } } },
  })

  if (!position || position.createdById !== userId) return { success: false, error: "Position not found or unauthorized" }
  if (position.resumes.length === 0) return { success: false, error: "No resumes to process" }

  const result: TextExtractionResult = { total: position.resumes.length, succeeded: 0, failed: 0, skipped: 0, errors: [] }

  for (const resume of position.resumes) {
    try {
      // Skip resumes that already have raw text extracted
      if (resume.rawExtractedText || resume.extractedText) {
        result.skipped++
        continue
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
        continue
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

  // Update position-level AI timestamp
  await prisma.position.update({
    where: { id: positionId },
    data: { aiLastExtractionRunAt: new Date() },
  })

  revalidatePath(`/org-admin/positions/${positionId}`)
  return { success: true, result }
}

export async function bulkExtractAllAction(positionId: string, forceReExtract: boolean = false): Promise<{ success: boolean; result?: BulkExtractionResult; error?: string }> {
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

  const usageLogs: any[] = []

  // Load AI services once (not inside the loop to avoid repeated dynamic imports)
  const { hiringAi } = await import("@/lib/ai")
  const { aiConfig } = await import("@/lib/ai/config")
  const { validateAndNormalizeExtraction } = await import("@/lib/ai/extraction-validator")
  const provider = aiConfig.provider

  // Process each resume sequentially — safe for serverless, avoids rate-limit bursts
  for (const resume of position.resumes) {
    try {
      if (!forceReExtract && (resume.parsingStatus === "EXTRACTED" || resume.parsingStatus === "RANKED") && resume.candidateName) {
        result.skipped++
        continue
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
          continue
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

  const usageLogs: any[] = []

  const { hiringAi } = await import("@/lib/ai")
  const { aiConfig } = await import("@/lib/ai/config")
  const provider = aiConfig.provider;
  const emailMap = new Set<string>();
  const phoneMap = new Set<string>();

  for (const resume of resumesToRank) {
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
          structuredJd: position.structuredJdJson || {}
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
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        resumes: {
          where: { rankingStatus: "RANKED" },
          orderBy: { matchScore: "desc" },
        },
      },
    })

    if (!position || position.createdById !== userId) {
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

    for (const resume of resumesToJudge) {
      if (!force && resume.advancedJudgmentAt) {
        result.skipped++
        continue
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

        const recommendationData = await hiringAi.runAdvancedCandidateJudgment(rankData, extractedBase);
        if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

        const interviewPrepData = await hiringAi.generateInterviewPrep(extractedBase, rankData, position.jdText || "");
        if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

        const redFlagsData = await hiringAi.analyzeRedFlags(extractedBase, resume.extractedText || "");
        if (provider === "gemini") await new Promise((r) => setTimeout(r, 4100));

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
          },
        })

        result.succeeded++
      } catch (err: any) {
        result.failed++
        result.errors.push({ fileName: resume.originalFileName, error: err.message })
      }
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
}> {
  const extractRes = await bulkExtractAllAction(positionId, forceReExtract)
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

  const judgmentRes = await bulkAdvancedJudgmentAction(positionId, 10, forceReExtract)

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
      detailsJson: JSON.stringify({ extractErrors: extractRes.error, rankErrors: rankRes.error, judgmentErrors: judgmentRes.error })
    }
  })

  return { 
    success: true, 
    extractResult: extractRes.result, 
    rankResult: rankRes.result,
    judgmentResult: judgmentRes.result
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

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://iqmela.com"
      const inviteLink = `${baseUrl}/interview/${invite.id}`

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

      const mailRes = await mailService.sendInterviewInvite({
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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.createdById !== userId) return { success: false, error: "Not found or unauthorized" };

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

