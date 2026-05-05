import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiInterviewer } from "@/lib/ai-interview";
import type { QuestionPlanContext } from "@/lib/ai-interview";

// Optional: prevent this from timing out quickly on Vercel Pro
export const maxDuration = 300; 
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Find all QUEUED sessions
    const queuedSessions = await prisma.aiInterviewSession.findMany({
      where: { status: "QUEUED" },
      include: {
        resume: {
          include: {
            position: true,
          }
        }
      },
      take: 5 // process in small batches to avoid hitting rate limits all at once
    });

    if (queuedSessions.length === 0) {
      return NextResponse.json({ success: true, message: "No queued sessions" });
    }

    const { emailService } = await import("@/lib/email");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const session of queuedSessions) {
      if (!session.resume || !session.resume.position) continue;
      
      const resume = session.resume;
      const position = resume.position;

      // Build question context
      const config = await prisma.aiInterviewConfig.findFirst({
        where: { positionId: position.id, interviewId: null },
      });

      const context: QuestionPlanContext = {
        candidateName: resume.overrideName || resume.candidateName || undefined,
        positionTitle: position.title,
        jdText: position.jdText ?? undefined,
        skills: Array.isArray(resume.skillsJson) ? (resume.skillsJson as string[]) : [],
        questionCounts: {
          intro: config?.introQuestions ?? 2,
          technical: config?.technicalQuestions ?? 4,
          behavioral: config?.behavioralQuestions ?? 3,
        },
      };

      if (resume.aiSummaryJson && typeof resume.aiSummaryJson === "object") {
        const s = resume.aiSummaryJson as Record<string, unknown>;
        context.candidateSummary = (s.overallProfile as string) ?? (s.headline as string) ?? undefined;
      }

      try {
        const plan = await aiInterviewer.generateQuestionPlan(context);
        const finalQuestions = plan.questions;
        const generationUsage = plan.usage;

        // Update session
        await prisma.aiInterviewSession.update({
          where: { id: session.id },
          data: {
            status: "IN_PROGRESS",
            questionSetJson: finalQuestions as object[],
          }
        });

        // Seed turn rows
        await prisma.aiInterviewTurn.createMany({
          data: finalQuestions.map((q, index) => ({
            sessionId: session.id,
            turnIndex: index,
            category: q.category as any,
            question: q.question,
          })),
        });

        // Log AI usage
        if (generationUsage && generationUsage.totalTokens > 0) {
          await prisma.aiUsageLog.create({
            data: {
              aiSessionId: session.id,
              positionId: resume.positionId,
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

        // Send Email
        const candidateEmail = resume.overrideEmail || resume.candidateEmail;
        if (candidateEmail) {
          const inviteLink = `${baseUrl}/ai-interview/${session.id}`;
          const candidateName = resume.overrideName || resume.candidateName || "Candidate";
          await emailService.sendAiInterviewInvite({
            to: candidateEmail,
            candidateName,
            positionTitle: position.title,
            inviteLink,
          });
        }
      } catch (err: any) {
        console.error(`Failed to process session ${session.id}:`, err);
        // If it's a 429 rate limit, leave it as QUEUED to retry later.
        // Otherwise, mark as FAILED
        const isRateLimit = err?.message?.includes("429") || err?.message?.includes("Quota exceeded") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (!isRateLimit) {
          await prisma.aiInterviewSession.update({
            where: { id: session.id },
            data: { status: "FAILED" }
          });
        }
      }
    }

    return NextResponse.json({ success: true, processed: queuedSessions.length });
  } catch (error) {
    console.error("Queue processor error:", error);
    return NextResponse.json({ success: false, error: "Failed to process queue" }, { status: 500 });
  }
}

// Vercel Cron triggers via GET by default
export async function GET(req: Request) {
  return POST(req);
}
