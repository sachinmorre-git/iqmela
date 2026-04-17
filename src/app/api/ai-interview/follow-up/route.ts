/**
 * POST /api/ai-interview/follow-up
 *
 * Evaluates a candidate's answer and decides whether a follow-up
 * question should be injected into the interview.
 *
 * Body: { sessionId: string, turnIndex: number, candidateAnswer: string }
 *
 * Response: { shouldFollowUp: boolean, followUpQuestion?: string, newTurnIndex?: number }
 *
 * Guardrails (Step 205):
 * - Only active if followUpEnabled = true in the position's AiInterviewConfig.
 * - Maximum 1 follow-up per root question (prevents infinite chaining).
 * - INTRO and CLOSING categories never get follow-ups.
 * - The AI prompt itself enforces professional, non-discriminatory content.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiInterviewer } from "@/lib/ai-interview";
import type { AiQuestionCategory } from "@/lib/ai-interview";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, turnIndex, candidateAnswer } = body as {
      sessionId: string;
      turnIndex: number;
      candidateAnswer: string;
    };

    if (!sessionId || turnIndex === undefined || !candidateAnswer) {
      return NextResponse.json(
        { error: "sessionId, turnIndex, and candidateAnswer are required." },
        { status: 400 }
      );
    }

    // ── Load session with context ────────────────────────────────────────────
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: { orderBy: { turnIndex: "asc" } },
        position: { select: { id: true, title: true, jdText: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.candidateId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Guardrail: Check if follow-ups are enabled ──────────────────────────
    const positionConfig = session.positionId
      ? await prisma.aiInterviewConfig.findFirst({
          where: { positionId: session.positionId, interviewId: null },
        })
      : null;

    if (!positionConfig?.followUpEnabled) {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Guardrail: Find the current turn ────────────────────────────────────
    const currentTurn = session.turns.find((t) => t.turnIndex === turnIndex);
    if (!currentTurn) {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Guardrail: Never follow up on INTRO or CLOSING ──────────────────────
    if (currentTurn.category === "INTRO" || currentTurn.category === "CLOSING") {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Guardrail: Max 1 follow-up depth ────────────────────────────────────
    // Check if the current question itself is already a follow-up
    // (we tag follow-up turns by prefixing the question with "[FOLLOW-UP]")
    if (currentTurn.question.startsWith("[FOLLOW-UP]")) {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // Also check if there is already a follow-up queued for this turn
    const existingFollowUp = session.turns.find(
      (t) =>
        t.turnIndex > turnIndex &&
        t.question.startsWith("[FOLLOW-UP]") &&
        t.turnIndex === turnIndex + 1
    );
    if (existingFollowUp) {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Call AI provider ────────────────────────────────────────────────────
    const result = await aiInterviewer.evaluateFollowUp({
      positionTitle: session.position?.title ?? "Software Engineer",
      jdText: session.position?.jdText ?? undefined,
      questionCategory: currentTurn.category as AiQuestionCategory,
      questionText: currentTurn.question,
      candidateAnswer,
    });

    if (!result.shouldFollowUp || !result.followUpQuestion) {
      return NextResponse.json({ shouldFollowUp: false });
    }

    // ── Insert the follow-up turn into the DB ───────────────────────────────
    // Shift all subsequent turns forward by 1 to make room
    const subsequentTurns = session.turns.filter(
      (t) => t.turnIndex > turnIndex
    );

    // Increment turnIndex of all subsequent turns
    for (const t of subsequentTurns) {
      await prisma.aiInterviewTurn.update({
        where: { id: t.id },
        data: { turnIndex: t.turnIndex + 1 },
      });
    }

    // Create the follow-up turn at turnIndex + 1
    const newTurnIndex = turnIndex + 1;
    await prisma.aiInterviewTurn.create({
      data: {
        sessionId,
        turnIndex: newTurnIndex,
        category: currentTurn.category,
        question: `[FOLLOW-UP] ${result.followUpQuestion}`,
      },
    });

    // ── Log AI usage ────────────────────────────────────────────────────────
    if (result.usage && result.usage.totalTokens > 0) {
      await prisma.aiUsageLog.create({
        data: {
          aiSessionId: sessionId,
          positionId: session.positionId,
          provider: result.usage.provider,
          model: result.usage.model,
          taskType: "AI_INTERVIEW_FOLLOW_UP",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          estimatedCost: result.usage.estimatedCost,
          promptVersion: "v1",
        },
      });
    }

    return NextResponse.json({
      shouldFollowUp: true,
      followUpQuestion: result.followUpQuestion,
      newTurnIndex,
    });
  } catch (err) {
    console.error("[AI Interview /follow-up]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Follow-up evaluation failed." },
      { status: 500 }
    );
  }
}
