"use server"

import { prisma } from "@/lib/prisma"
import { getCallerPermissions } from "@/lib/rbac"

// ── Types ────────────────────────────────────────────────────────────────────

export type RoundSummary = {
  stageIndex: number
  roundLabel: string
  roundType: string
  interviewId: string | null
  status: "COMPLETED" | "SCHEDULED" | "IN_PROGRESS" | "NOT_STARTED"
  completedAt: string | null
  compositeScore: number | null
  panelistScores: {
    interviewerName: string
    overallScore: number
    recommendation: string
    summary: string
    strengths: string | null
    concerns: string | null
    technicalScore: number
    communicationScore: number
    problemSolvingScore: number
    cultureFitScore: number
    submittedAt: string
  }[]
  aiSession: {
    overallScore: number | null
    recommendation: string | null
    executiveSummary: string | null
    questionCount: number
  } | null
  hasRecording: boolean
  recordingUrl: string | null
}

export type ConsolidatedReport = {
  resume: {
    id: string
    candidateName: string
    candidateEmail: string
    pipelineStatus: string
    pipelineStageIdx: number
  }
  position: {
    id: string
    title: string
    department: string | null
  }
  rounds: RoundSummary[]
  overallScore: number | null
  dimensionAverages: {
    technical: number
    communication: number
    problemSolving: number
    cultureFit: number
  } | null
  consensusSummary: {
    total: number
    strongHire: number
    hire: number
    noHire: number
    strongNoHire: number
  }
  discussions: {
    id: string
    authorName: string
    message: string
    createdAt: string
  }[]
}

// ── Action ───────────────────────────────────────────────────────────────────

export async function fetchConsolidatedReportAction(
  resumeId: string,
  positionId: string
): Promise<{ success: true; data: ConsolidatedReport } | { success: false; error: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms) return { success: false, error: "Unauthorized" }

    // Fetch resume with position
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        pipelineStatus: true,
        pipelineStageIdx: true,
        organizationId: true,
        position: { select: { id: true, title: true, department: true } },
      },
    })

    if (!resume) return { success: false, error: "Candidate not found" }
    if (resume.organizationId !== perms.orgId) return { success: false, error: "Forbidden" }

    // Fetch interview plan stages
    const plan = await prisma.interviewPlan.findUnique({
      where: { positionId },
      include: { stages: { orderBy: { stageIndex: "asc" } } },
    })

    const stages = plan?.stages ?? []

    // Fetch all interviews for this candidate + position
    const interviews = await prisma.interview.findMany({
      where: { resumeId, positionId },
      include: {
        panelistFeedbacks: {
          include: { interviewer: { select: { name: true, email: true } } },
          orderBy: { submittedAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // Fetch AI sessions
    const aiSessionsRaw = await prisma.aiInterviewSession.findMany({
      where: { resumeId, positionId },
      select: {
        id: true,
        overallScore: true,
        recommendation: true,
        finalScoreJson: true,
        questionSetJson: true,
      },
    })

    // Build rounds
    const rounds: RoundSummary[] = stages.map((stage) => {
      const interview = interviews.find((iv) => iv.stageIndex === stage.stageIndex)
      
      const sessionRaw = aiSessionsRaw[0]
      const aiSession = stage.roundType === "AI_SCREEN" && sessionRaw ? {
        overallScore: sessionRaw.overallScore,
        recommendation: sessionRaw.recommendation,
        executiveSummary: (sessionRaw.finalScoreJson as any)?.summary || null,
        questionCount: Array.isArray(sessionRaw.questionSetJson) ? sessionRaw.questionSetJson.length : 0,
      } : null

      const panelistScores = (interview?.panelistFeedbacks ?? []).map((pf) => ({
        interviewerName: pf.interviewer?.name || pf.interviewer?.email || "Interviewer",
        overallScore: pf.overallScore,
        recommendation: pf.recommendation,
        summary: pf.summary,
        strengths: pf.strengths,
        concerns: pf.concerns,
        technicalScore: pf.technicalScore,
        communicationScore: pf.communicationScore,
        problemSolvingScore: pf.problemSolvingScore,
        cultureFitScore: pf.cultureFitScore,
        submittedAt: pf.submittedAt.toISOString(),
      }))

      // Compute composite from panelist scores
      let compositeScore: number | null = null
      if (panelistScores.length > 0) {
        compositeScore = Math.round(
          panelistScores.reduce((s, p) => s + p.overallScore, 0) / panelistScores.length
        )
      } else if (aiSession?.overallScore != null) {
        compositeScore = aiSession.overallScore
      }

      const isCompleted = interview?.status === "COMPLETED"
      const isScheduled = interview?.status === "SCHEDULED"

      return {
        stageIndex: stage.stageIndex,
        roundLabel: stage.roundLabel,
        roundType: stage.roundType,
        interviewId: interview?.id ?? null,
        status: isCompleted ? "COMPLETED" as const
          : isScheduled ? "SCHEDULED" as const
          : "NOT_STARTED" as const,
        completedAt: interview?.status === "COMPLETED" ? interview.updatedAt.toISOString() : null,
        compositeScore,
        panelistScores,
        aiSession: aiSession ? {
          overallScore: aiSession.overallScore,
          recommendation: aiSession.recommendation,
          executiveSummary: aiSession.executiveSummary,
          questionCount: aiSession.questionCount,
        } : null,
        hasRecording: !!interview?.recordingUrl,
        recordingUrl: null, // Presigned URLs fetched on demand
      }
    })

    // Aggregate overall score
    const completedRounds = rounds.filter((r) => r.compositeScore != null)
    const overallScore = completedRounds.length > 0
      ? Math.round(completedRounds.reduce((s, r) => s + (r.compositeScore ?? 0), 0) / completedRounds.length)
      : null

    // Aggregate dimension averages
    const allPanelists = rounds.flatMap((r) => r.panelistScores)
    const dimensionAverages = allPanelists.length > 0 ? {
      technical: +(allPanelists.reduce((s, p) => s + p.technicalScore, 0) / allPanelists.length).toFixed(1),
      communication: +(allPanelists.reduce((s, p) => s + p.communicationScore, 0) / allPanelists.length).toFixed(1),
      problemSolving: +(allPanelists.reduce((s, p) => s + p.problemSolvingScore, 0) / allPanelists.length).toFixed(1),
      cultureFit: +(allPanelists.reduce((s, p) => s + p.cultureFitScore, 0) / allPanelists.length).toFixed(1),
    } : null

    // Consensus
    const consensusSummary = {
      total: allPanelists.length,
      strongHire: allPanelists.filter((p) => p.recommendation === "STRONG_HIRE").length,
      hire: allPanelists.filter((p) => p.recommendation === "HIRE").length,
      noHire: allPanelists.filter((p) => p.recommendation === "NO_HIRE").length,
      strongNoHire: allPanelists.filter((p) => p.recommendation === "STRONG_NO_HIRE").length,
    }

    // Fetch panel discussions
    const discussions = await prisma.panelDiscussion.findMany({
      where: { resumeId, positionId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })

    return {
      success: true,
      data: {
        resume: {
          id: resume.id,
          candidateName: resume.candidateName || resume.candidateEmail || "Unknown",
          candidateEmail: resume.candidateEmail || "",
          pipelineStatus: resume.pipelineStatus,
          pipelineStageIdx: resume.pipelineStageIdx,
        },
        position: {
          id: resume.position.id,
          title: resume.position.title,
          department: resume.position.department,
        },
        rounds,
        overallScore,
        dimensionAverages,
        consensusSummary,
        discussions: discussions.map((d) => ({
          id: d.id,
          authorName: d.author?.name || d.author?.email || "Team Member",
          message: d.message,
          createdAt: d.createdAt.toISOString(),
        })),
      },
    }
  } catch (error) {
    console.error("[fetchConsolidatedReport] Error:", error)
    return { success: false, error: "Failed to load report data" }
  }
}
