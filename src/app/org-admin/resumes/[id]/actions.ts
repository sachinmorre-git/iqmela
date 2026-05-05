"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resumeParser } from "@/lib/resume-parser"
import { candidateExtractor } from "@/lib/candidate-extractor"
import { revalidatePath } from "next/cache"
import path from "path"
import { getCallerPermissions } from "@/lib/rbac"

export async function getFullResumeData(resumeId: string) {
  const perms = await getCallerPermissions()
  if (!perms) return null

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: {
      position: {
        include: {
          interviewPlan: { include: { stages: { orderBy: { stageIndex: "asc" } } } },
        },
      },
      interviews: {
        orderBy: { stageIndex: "asc" },
        include: {
          panelists:        { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          panelistFeedbacks: { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          feedback:   true,
          aiAnalysis: true,
          behaviorReport: true,
        },
      },
      aiInterviewSessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { 
          candidate: { select: { name: true, email: true } },
          turns: { orderBy: { turnIndex: "asc" } }
        },
      },
      panelistFeedbacks: {
        include: { interviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { submittedAt: "asc" },
      },
      hiringDecisions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { decidedBy: { select: { name: true, email: true } } },
      },
      bgvChecks: { orderBy: { createdAt: "desc" } },
      jobOffers: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!resume || resume.position?.organizationId !== perms.orgId) return null
  return resume
}

export async function extractResumeTextAction(resumeId: string) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.organizationId !== perms.orgId) {
    return { success: false, error: "Resume not found or unauthorized" }
  }

  try {
    // Quick status update before heavy processing
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsingStatus: "EXTRACTING" }
    })
    
    // Resolve absolute path from the relative string stored in DB
    const absolutePath = path.join(process.cwd(), "public", resume.storagePath)

    // Pass it to the abstraction service
    const result = await resumeParser.extractText({
      filePath: absolutePath,
      mimeType: resume.mimeType,
    })

    if (!result.success) {
      await prisma.resume.update({
        where: { id: resumeId },
        data: {
          parsingStatus: "FAILED",
          parsingNotes: result.error || "Parsing failed",
        }
      })
      revalidatePath(`/org-admin/resumes/${resumeId}`)
      revalidatePath(`/org-admin/positions/${resume.positionId}`)
      return { success: false, error: result.error || "Parsing failed" }
    }

    // Success - update text and mark EXTRACTED
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parsingStatus: "EXTRACTED",
        extractedText: result.text,
      }
    })

    revalidatePath(`/org-admin/resumes/${resumeId}`)
    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true }

  } catch (error) {
    console.error(`[extractResumeTextAction] Error:`, error)
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsingStatus: "FAILED", parsingNotes: "Internal error during extraction" }
    })
    revalidatePath(`/org-admin/resumes/${resumeId}`)
    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: false, error: "Internal server error" }
  }
}

export async function extractCandidateDetailsAction(resumeId: string) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.organizationId !== perms.orgId) {
    return { success: false, error: "Resume not found or unauthorized" }
  }

  if (!resume.extractedText) {
    return { success: false, error: "No raw text found to extract from. Please extract text first." }
  }

  try {
    const candidateData = await candidateExtractor.extractDetails(resume.extractedText)

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        candidateName: candidateData.candidateName,
        candidateEmail: candidateData.candidateEmail,
        phoneNumber: candidateData.phoneNumber,
        linkedinUrl: candidateData.linkedinUrl,
      }
    })

    revalidatePath(`/org-admin/resumes/${resumeId}`)
    return { success: true }

  } catch (error) {
    console.error(`[extractCandidateDetailsAction] Error:`, error)
    return { success: false, error: "Internal server error" }
  }
}

export async function runAiExtractionAction(resumeId: string) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canRunAI) return { success: false, error: "Unauthorized" }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.organizationId !== perms.orgId) {
    return { success: false, error: "Resume not found or unauthorized" }
  }

  if (!resume.extractedText) {
    return { success: false, error: "No raw text found. Please run 'Extract Resume Text' first." }
  }

  // Determine which provider is active (for audit logging)
  const { aiConfig } = await import("@/lib/ai/config")
  const provider = aiConfig.provider

  try {
    // Flip to EXTRACTING state so the button disables and status badge transitions
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsingStatus: "EXTRACTING" },
    })
    revalidatePath(`/org-admin/resumes/${resumeId}`)

    // Dynamically import (server-only, avoids client bundle pollution)
    const { hiringAi } = await import("@/lib/ai")
    const { validateAndNormalizeExtraction } = await import("@/lib/ai/extraction-validator")

    const rawExtracted = await hiringAi.extractResumeJson(resume.extractedText)
    const { data: extracted, warnings } = validateAndNormalizeExtraction(rawExtracted)

    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parsingStatus:         "EXTRACTED",
        candidateName:         extracted.candidateName,
        candidateEmail:        extracted.candidateEmail,
        phoneNumber:           extracted.phoneNumber,
        linkedinUrl:           extracted.linkedinUrl,
        location:              extracted.location,
        skillsJson:            extracted.skills,
        experienceYears:       extracted.experienceYears,
        educationJson:         extracted.education,
        companiesJson:         extracted.companies,
        extractionProvider:    provider,
        extractionConfidence:  extracted.extractionConfidence ?? null,
        aiRawOutputJson:       extracted.rawOutput ?? Prisma.JsonNull,
        validationWarningsJson: warnings.length > 0 ? warnings : Prisma.JsonNull,
        parsingNotes:          warnings.length > 0 ? `${warnings.length} validation warning(s)` : null,
      },
    })

    revalidatePath(`/org-admin/resumes/${resumeId}`)
    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true, provider }

  } catch (error) {
    console.error(`[runAiExtractionAction] Error:`, error)
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parsingStatus: "FAILED",
        parsingNotes:  error instanceof Error ? error.message : "AI extraction failed",
      },
    })
    revalidatePath(`/org-admin/resumes/${resumeId}`)
    return { success: false, error: "AI extraction failed. Check server logs." }
  }
}

export async function overrideAiDecision(
  resumeId: string,
  newScore: number,
  newLabel: string,
  reason: string
) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.canMakeHireDecision) return { success: false, error: "Unauthorized" }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.organizationId !== perms.orgId) {
    return { success: false, error: "Resume not found or unauthorized" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update the Resume with override data and replace active score
      await tx.resume.update({
        where: { id: resumeId },
        data: {
          jdMatchScore: newScore,
          jdMatchLabel: newLabel,
          aiOverrideScore: newScore,
          aiOverrideLabel: newLabel,
          aiOverrideReason: reason,
          aiOverrideById: perms.userId,
          aiOverrideAt: new Date(),
        },
      })

      // 2. Create the compliance Audit Log entry
      await tx.hiringDecision.create({
        data: {
          resumeId,
          positionId: resume.positionId,
          decidedById: perms.userId,
          action: "AI_OVERRIDE",
          note: `AI Override: ${reason} (New Score: ${newScore}, Label: ${newLabel})`,
        },
      })
    })

    revalidatePath(`/org-admin/resumes/${resumeId}`)
    revalidatePath(`/org-admin/positions/${resume.positionId}`)
    return { success: true }
  } catch (error) {
    console.error(`[overrideAiDecision] Error:`, error)
    return { success: false, error: "Failed to override AI decision" }
  }
}
