"use server"

import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { resumeParser } from "@/lib/resume-parser"
import { candidateExtractor } from "@/lib/candidate-extractor"
import { revalidatePath } from "next/cache"
import path from "path"

export async function extractResumeTextAction(resumeId: string) {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: "Unauthorized" }
  }

  // Find the resume ensuring user ownership
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.createdById !== userId) {
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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: "Unauthorized" }
  }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.createdById !== userId) {
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
  const { userId } = await auth()
  if (!userId) return { success: false, error: "Unauthorized" }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { position: true },
  })

  if (!resume || resume.position.createdById !== userId) {
    return { success: false, error: "Resume not found or unauthorized" }
  }

  if (!resume.extractedText) {
    return { success: false, error: "No raw text found. Please run 'Extract Resume Text' first." }
  }

  // Determine which provider is active (for audit logging)
  const provider = process.env.GEMINI_API_KEY ? "gemini" : "mock"

  try {
    // Flip to EXTRACTING state so the button disables and status badge transitions
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parsingStatus: "EXTRACTING" },
    })
    revalidatePath(`/org-admin/resumes/${resumeId}`)

    // Dynamically import (server-only, avoids client bundle pollution)
    const { resumeAiService } = await import("@/lib/ai/resume-ai-service")
    const { validateAndNormalizeExtraction } = await import("@/lib/ai/extraction-validator")

    const rawExtracted = await resumeAiService.extractResumeStructuredData(resume.extractedText)
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
        extractionConfidence:  null,
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
