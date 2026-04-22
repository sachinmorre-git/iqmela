import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { evaluateAnswerPrompt } from "@/lib/ai/prompts";
import { cleanJsonFences } from "@/lib/ai/utils";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { question?: string; userAnswer?: string };
  if (!body.question?.trim() || !body.userAnswer?.trim()) {
    return NextResponse.json({ error: "question and userAnswer are required" }, { status: 400 });
  }

  const prompt = evaluateAnswerPrompt({ question: body.question, userAnswer: body.userAnswer });

  try {
    const result = await geminiClient.models.generateContent({
      model:    geminiModel,
      contents: prompt,
    });
    const text   = cleanJsonFences(result.text ?? "");
    const parsed = JSON.parse(text) as { score: number; feedback: string; tips: string[] };

    // Validate shape
    if (typeof parsed.score !== "number" || !parsed.feedback || !Array.isArray(parsed.tips)) {
      throw new Error("Malformed AI response");
    }

    return NextResponse.json({
      score:    Math.max(0, Math.min(100, Math.round(parsed.score))),
      feedback: parsed.feedback,
      tips:     parsed.tips.slice(0, 2),
    });
  } catch (e) {
    console.error("[evaluate-answer]", e);
    return NextResponse.json({ error: "AI evaluation failed — please try again" }, { status: 500 });
  }
}
