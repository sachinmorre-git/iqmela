/**
 * POST /api/ai-interview/start
 *
 * Creates an AiInterviewSession, generates the question plan via AI,
 * persists the plan to the DB, and returns it to the client.
 *
 * Body: { resumeId?: string, positionId?: string }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiInterviewer } from "@/lib/ai-interview";
import type { QuestionPlanContext } from "@/lib/ai-interview";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { resumeId, positionId } = body as {
      resumeId?: string;
      positionId?: string;
    };

    // Build question plan context from available data
    const context: QuestionPlanContext = {
      questionCounts: {
        intro: parseInt(process.env.AI_INTERVIEW_INTRO_QUESTIONS ?? "2"),
        technical: parseInt(process.env.AI_INTERVIEW_TECHNICAL_QUESTIONS ?? "4"),
        behavioral: parseInt(process.env.AI_INTERVIEW_BEHAVIORAL_QUESTIONS ?? "3"),
      },
    };

    // Enrich context from resume if provided
    if (resumeId) {
      const resume = await prisma.resume.findUnique({
        where: { id: resumeId },
        select: {
          candidateName: true,
          skillsJson: true,
          aiSummaryJson: true,
          position: { select: { title: true, jdText: true } },
        },
      });

      if (resume) {
        context.candidateName = resume.candidateName ?? undefined;
        context.positionTitle = resume.position?.title ?? undefined;
        context.jdText = resume.position?.jdText ?? undefined;

        // skillsJson is stored as a JSON array of strings
        if (Array.isArray(resume.skillsJson)) {
          context.skills = resume.skillsJson as string[];
        }

        // aiSummaryJson may contain an "overallProfile" or "headline" string
        if (resume.aiSummaryJson && typeof resume.aiSummaryJson === "object") {
          const s = resume.aiSummaryJson as Record<string, unknown>;
          context.candidateSummary =
            (s.overallProfile as string) ?? (s.headline as string) ?? undefined;
        }
      }
    }

    // Fallback context from position alone
    if (!context.positionTitle && positionId) {
      const position = await prisma.position.findUnique({
        where: { id: positionId },
        select: { title: true, jdText: true },
      });
      if (position) {
        context.positionTitle = position.title;
        context.jdText = position.jdText ?? undefined;
      }
    }

    let finalQuestions: { category: string; question: string }[] = [];
    let generationUsage: any = null;

    // First try fetching approved questions from Question Bank if a position is provided
    let hasBank = false;
    if (positionId) {
      const approvedQuestions = await prisma.aiInterviewQuestion.findMany({
        where: { positionId, isApproved: true },
        orderBy: { sortOrder: "asc" },
      });
      if (approvedQuestions.length > 0) {
        finalQuestions = approvedQuestions.map(q => ({
          category: q.category,
          question: q.questionText,
        }));
        hasBank = true;
      }
    }

    // Fallback: Generate dynamically via AI if no approved bank exists
    if (!hasBank) {
      const plan = await aiInterviewer.generateQuestionPlan(context);
      finalQuestions = plan.questions;
      generationUsage = plan.usage;
    }

    // Persist session to DB
    const session = await prisma.aiInterviewSession.create({
      data: {
        candidateId: userId,
        resumeId: resumeId ?? null,
        positionId: positionId ?? null,
        status: "IN_PROGRESS",
        questionSetJson: finalQuestions as object[],
      },
    });

    // Persist turns (one row per question, no answer yet)
    await prisma.aiInterviewTurn.createMany({
      data: finalQuestions.map((q, index) => ({
        sessionId: session.id,
        turnIndex: index,
        category: q.category as any,
        question: q.question,
      })),
    });

    // Log AI usage if applicable
    if (generationUsage && generationUsage.totalTokens > 0) {
      await prisma.aiUsageLog.create({
        data: {
          aiSessionId: session.id,
          positionId: positionId ?? null,
          provider: generationUsage.provider,
          model: generationUsage.model,
          taskType: "AI_INTERVIEW_PLAN",
          inputTokens: generationUsage.inputTokens,
          outputTokens: generationUsage.outputTokens,
          totalTokens: generationUsage.totalTokens,
          estimatedCost: generationUsage.estimatedCost,
          promptVersion: "v1",
        },
      });
    }

    return NextResponse.json({
      sessionId: session.id,
      questions: finalQuestions,
    });
  } catch (err) {
    console.error("[AI Interview /start]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start interview" },
      { status: 500 }
    );
  }
}
