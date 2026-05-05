/**
 * POST /api/ai-interview/score
 *
 * Loads all turns for a session, scores them via AI, saves results,
 * and marks the session as COMPLETED.
 *
 * Body: { sessionId: string }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiInterviewer } from "@/lib/ai-interview";
import type { TranscriptTurn, QuestionPlanContext, AiQuestionCategory } from "@/lib/ai-interview";
import { dispatchNotification } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    // Load the session with its turns and related context
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: { orderBy: { turnIndex: "asc" } },
        resume: {
          select: {
            candidateName: true,
            skillsJson: true,
            aiSummaryJson: true,
            position: { select: { title: true, jdText: true } },
          },
        },
        position: { select: { title: true, jdText: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.candidateId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (session.status === "COMPLETED") {
      // Already scored — return cached results
      return NextResponse.json({ summary: session.finalScoreJson });
    }

    // Build context
    const context: QuestionPlanContext = {
      positionTitle:
        session.resume?.position?.title ?? session.position?.title ?? undefined,
      jdText:
        session.resume?.position?.jdText ?? session.position?.jdText ?? undefined,
    };

    if (session.resume) {
      context.candidateName = session.resume.candidateName ?? undefined;
      if (Array.isArray(session.resume.skillsJson)) {
        context.skills = session.resume.skillsJson as string[];
      }
    }

    // Build turns array (skip CLOSING questions with no answer — they're for candidate to ask)
    const turns: TranscriptTurn[] = session.turns
      .filter((t) => t.category !== "CLOSING")
      .map((t) => ({
        turnIndex: t.turnIndex,
        category: t.category as AiQuestionCategory,
        question: t.question,
        candidateAnswer: t.candidateAnswer ?? "",
      }));

    // Score via AI
    const summary = await aiInterviewer.scoreSession(context, turns);

    // Persist scores back to individual turn rows
    await Promise.all(
      summary.perAnswer.map((score) =>
        prisma.aiInterviewTurn.updateMany({
          where: { sessionId, turnIndex: score.turnIndex },
          data: {
            scoreRaw: score.scoreRaw,
            scoreFeedback: score.scoreFeedback,
            suspiciousFlags: score.suspiciousFlags && score.suspiciousFlags.length > 0 ? score.suspiciousFlags : undefined,
          },
        })
      )
    );

    // Update session with final results
    await prisma.aiInterviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        finalScoreJson: summary as object,
        overallScore: summary.overallScore,
        recommendation: summary.recommendation,
        completedAt: new Date(),
      },
    });

    // Also mark the shadow Interview mode as COMPLETED so it reflects on global dashboards
    // We update pending AI_AVATAR interviews for this candidate & position
    await prisma.interview.updateMany({
      where: {
         candidateId: session.candidateId,
         positionId: session.positionId,
         interviewMode: "AI_AVATAR",
         status: "SCHEDULED"
      },
      data: { status: "COMPLETED" }
    });

    // Log usage
    if (summary.usage && summary.usage.totalTokens > 0) {
      await prisma.aiUsageLog.create({
        data: {
          aiSessionId: sessionId,
          positionId: session.positionId,
          provider: summary.usage.provider,
          model: summary.usage.model,
          taskType: "AI_INTERVIEW_SCORE",
          inputTokens: summary.usage.inputTokens,
          outputTokens: summary.usage.outputTokens,
          totalTokens: summary.usage.totalTokens,
          estimatedCost: summary.usage.estimatedCost,
          promptVersion: "v1",
        },
      });
    }

    // ── Notify ONLY the position owner (recruiter who created it) ───
    // We intentionally do NOT blast all admins/recruiters — that would
    // be noisy in orgs processing hundreds of AI interviews daily.
    // The position owner sees the result in their feed; others can check
    // the Intelligence Hub directly.
    const candidateName = session.resume?.candidateName || "A candidate";
    const posTitle = session.resume?.position?.title || session.position?.title || "a position";
    const positionData = session.positionId
      ? await prisma.position.findUnique({
          where: { id: session.positionId },
          select: { organizationId: true, createdById: true },
        })
      : null;
    if (positionData?.organizationId && positionData.createdById) {
      dispatchNotification({
        organizationId: positionData.organizationId,
        userId: positionData.createdById,
        type: "AI_INTERVIEW_COMPLETED",
        title: `AI Interview Complete`,
        body: `${candidateName} scored ${summary.overallScore}/100 for ${posTitle}`,
        link: `/org-admin/candidates/${session.resumeId}/intelligence`,
        sendPush: false, // Bell only — not urgent enough for browser interrupt
      }).catch(() => {});
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[AI Interview /score]", err);
    
    let errorMessage = err instanceof Error ? err.message : "Scoring failed.";
    
    if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "AI Provider Quota Exceeded. Please check your API limits or try again in a moment.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
