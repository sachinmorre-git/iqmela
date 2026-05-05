/**
 * POST /api/ai-interview/transcript
 *
 * Saves a candidate's answer for one turn of the interview.
 *
 * Body: { sessionId: string, turnIndex: number, answer: string }
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, turnIndex, answer, durationMs, confidence, providerName, antiCheat } = body as {
      sessionId: string;
      turnIndex: number;
      answer: string;
      durationMs?: number;
      confidence?: number;
      providerName?: string;
      antiCheat?: {
        tabSwitches?: number;
        pastes?: number;
        camPermission?: string;
        micPermission?: string;
      };
    };

    if (!sessionId || turnIndex === undefined || !answer) {
      return NextResponse.json(
        { error: "sessionId, turnIndex, and answer are required." },
        { status: 400 }
      );
    }

    // Verify the session belongs to this user
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
      select: { candidateId: true, status: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (session.candidateId !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Session is not in progress." },
        { status: 409 }
      );
    }

    // Step 219 + Step 225: Merge quality + anti-cheat warnings
    const warnings: string[] = [];
    if (answer.trim().length === 0) {
      warnings.push("MISSING_ANSWER");
    } else {
      if (confidence !== undefined && confidence < 0.6) warnings.push("LOW_CONFIDENCE");
      if (durationMs !== undefined && durationMs < 1500) warnings.push("INCOMPLETE_RESPONSE");
    }
    if (antiCheat?.micPermission === "denied") warnings.push("MIC_DENIED");
    if (antiCheat?.camPermission === "denied") warnings.push("CAM_DENIED");

    // Step 225: elevated anti-cheat flags go into suspiciousFlags for recruiter review
    const suspiciousFlags: string[] = [];
    if ((antiCheat?.tabSwitches ?? 0) >= 3) suspiciousFlags.push("EXCESSIVE_TAB_SWITCHES");
    if ((antiCheat?.pastes ?? 0) >= 1)      suspiciousFlags.push("PASTE_DETECTED");

    // ── AI Abuse Detection ──────────────────────────────────────────────────
    // Analyze answer for signs of AI-assisted cheating
    const { analyzeAnswer } = await import("@/lib/ai-interview/abuse-detector");
    const abuseAnalysis = analyzeAnswer({
      inputMethod: (antiCheat?.pastes ?? 0) > 0 ? "pasted" : "voice",
      answerDurationMs: durationMs,
      wordCount: answer.trim().split(/\s+/).length,
      tabSwitchesDuringQuestion: antiCheat?.tabSwitches ?? 0,
      pasteEventsDuringQuestion: antiCheat?.pastes ?? 0,
      appearedInstantly: durationMs !== undefined && durationMs < 2000 && answer.trim().split(/\s+/).length > 20,
      answerText: answer.trim(),
    });

    // Add abuse flags to suspicious flags if score is high enough
    if (abuseAnalysis.score > 20) {
      suspiciousFlags.push(`ABUSE_SCORE_${abuseAnalysis.score}`);
      for (const flag of abuseAnalysis.flags) {
        suspiciousFlags.push(flag.type);
      }
    }
    if (abuseAnalysis.level === "definite_ai") {
      suspiciousFlags.push("AI_GENERATED_ANSWER");
    }

    // Update the turn answer
    await prisma.aiInterviewTurn.updateMany({
      where: { sessionId, turnIndex },
      data: {
        candidateAnswer: answer.trim(),
        answeredAt: new Date(),
        answerDurationMs: durationMs,
        speechConfidence: confidence,
        speechProvider: providerName,
        transcriptWarnings: warnings.length > 0 ? warnings : undefined,
        suspiciousFlags: suspiciousFlags.length > 0 ? suspiciousFlags : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[AI Interview /transcript]", err);
    return NextResponse.json(
      { error: "Failed to save transcript." },
      { status: 500 }
    );
  }
}
