import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { candidatePrepQuestionsPrompt } from "@/lib/ai/prompts";
import { cleanJsonFences } from "@/lib/ai/utils";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { interviewId?: string };
  if (!body.interviewId) return NextResponse.json({ error: "interviewId required" }, { status: 400 });

  // Verify candidate owns this interview
  const interview = await prisma.interview.findUnique({
    where: { id: body.interviewId },
    include: { position: { select: { title: true, jdText: true, description: true } } },
  });

  if (!interview || interview.candidateId !== userId) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  const positionTitle = interview.position?.title ?? interview.title;
  const roundLabel    = interview.roundLabel ?? "Interview";
  const jd            = interview.position?.jdText ?? interview.position?.description ?? "";

  const prompt = candidatePrepQuestionsPrompt({ roundLabel, positionTitle, jd });

  try {
    const result = await geminiClient.models.generateContent({
      model:    geminiModel,
      contents: prompt,
    });
    const text   = cleanJsonFences(result.text ?? "");
    const parsed = JSON.parse(text) as { questions: { question: string; modelAnswer: string }[] };
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Invalid AI response structure");
    }
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[prep-questions]", e);
    return NextResponse.json({ error: "AI generation failed — please try again" }, { status: 500 });
  }
}
