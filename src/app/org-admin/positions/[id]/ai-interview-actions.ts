/**
 * Server action — Step 178
 * Creates an AI Avatar interview session for a shortlisted candidate.
 * Called from the position detail page when Org Admin clicks "Send AI Interview".
 */

"use server";

import { getCallerPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { aiInterviewer } from "@/lib/ai-interview";
import type { QuestionPlanContext } from "@/lib/ai-interview";

export interface AiInterviewInviteResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

export async function createAiInterviewSessionAction(
  resumeId: string,
  positionId: string,
  config?: {
    difficulty?: string;
    introQuestions?: number;
    technicalQuestions?: number;
    behavioralQuestions?: number;
    followUpEnabled?: boolean;
    retriesAllowed?: boolean;
  }
): Promise<AiInterviewInviteResult> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canScheduleAiInterview) return { success: false, error: "Unauthorized" };

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: {
        position: { select: { id: true, title: true, jdText: true, organizationId: true } },
      },
    });

    if (!resume || resume.position.organizationId !== perms.orgId) {
      return { success: false, error: "Resume not found or unauthorized" };
    }

    if (!resume.isShortlisted) {
      return { success: false, error: "Candidate must be shortlisted before assigning an AI interview." };
    }

    // Check if a session already exists — don't create duplicates
    const existing = await prisma.aiInterviewSession.findFirst({
      where: { resumeId, positionId, status: "IN_PROGRESS" },
    });
    if (existing) {
      return { success: true, sessionId: existing.id }; // idempotent
    }

    // Build question context
    const context: QuestionPlanContext = {
      candidateName: resume.overrideName || resume.candidateName || undefined,
      positionTitle: resume.position.title,
      jdText: resume.position.jdText ?? undefined,
      skills: Array.isArray(resume.skillsJson) ? (resume.skillsJson as string[]) : [],
      questionCounts: {
        intro: config?.introQuestions ?? parseInt(process.env.AI_INTERVIEW_INTRO_QUESTIONS ?? "2"),
        technical: config?.technicalQuestions ?? parseInt(process.env.AI_INTERVIEW_TECHNICAL_QUESTIONS ?? "4"),
        behavioral: config?.behavioralQuestions ?? parseInt(process.env.AI_INTERVIEW_BEHAVIORAL_QUESTIONS ?? "3"),
      },
    };

    if (resume.aiSummaryJson && typeof resume.aiSummaryJson === "object") {
      const s = resume.aiSummaryJson as Record<string, unknown>;
      context.candidateSummary =
        (s.overallProfile as string) ?? (s.headline as string) ?? undefined;
    }

    // Fetch approved questions from Question Bank
    const approvedQuestions = await prisma.aiInterviewQuestion.findMany({
      where: { positionId, isApproved: true },
      orderBy: { sortOrder: "asc" },
    });

    let finalQuestions: { category: string; question: string }[] = [];
    let generationUsage: any = null;

    if (approvedQuestions.length > 0) {
      finalQuestions = approvedQuestions.map(q => ({
        category: q.category,
        question: q.questionText,
      }));
    } else {
      // Fallback: Generate question plan dynamically if bank is empty or unapproved
      const plan = await aiInterviewer.generateQuestionPlan(context);
      finalQuestions = plan.questions;
      generationUsage = plan.usage;
    }

    // Try to find the candidate user by their email (may not exist yet — that's OK)
    const candidateEmail = resume.overrideEmail || resume.candidateEmail;
    if (!candidateEmail) {
      return { success: false, error: "Candidate has no email. Cannot create AI interview session." };
    }

    // Look up user but don't block if they haven't signed up yet
    const candidateUser = await prisma.user.findUnique({
      where: { email: candidateEmail },
    });

    // Create session — candidateId is optional, linked when candidate opens the link
    const session = await prisma.aiInterviewSession.create({
      data: {
        candidateId: candidateUser?.id ?? null,
        resumeId: resume.id,
        positionId: resume.positionId,
        status: "IN_PROGRESS",
        questionSetJson: finalQuestions as object[],
      },
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

    // Save AI interview config for this session
    if (config) {
      await prisma.aiInterviewConfig.create({
        data: {
          positionId: resume.positionId,
          difficulty: (config.difficulty as any) ?? "MEDIUM",
          introQuestions: config.introQuestions ?? 2,
          technicalQuestions: config.technicalQuestions ?? 4,
          behavioralQuestions: config.behavioralQuestions ?? 3,
          followUpEnabled: config.followUpEnabled ?? false,
          retriesAllowed: config.retriesAllowed ?? false,
        },
      });
    }

    // Log AI usage (only if we did dynamic generation)
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

    // Send AI interview invite email to the candidate
    const { emailService } = await import("@/lib/email");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/ai-interview/${session.id}`;
    const candidateName = resume.overrideName || resume.candidateName || "Candidate";

    try {
      const emailResult = await emailService.sendAiInterviewInvite({
        to: candidateEmail,
        candidateName,
        positionTitle: resume.position.title,
        orgName: undefined, // TODO: pass org name if available
        inviteLink,
      });
      if (!emailResult.success) {
        console.warn("[createAiInterviewSessionAction] Email send failed:", emailResult.error);
      } else {
        console.log("[createAiInterviewSessionAction] AI invite email sent to", candidateEmail);
      }
    } catch (emailErr) {
      // Don't fail the session creation if email fails
      console.error("[createAiInterviewSessionAction] Email error (non-blocking):", emailErr);
    }

    revalidatePath(`/org-admin/positions/${positionId}`);
    revalidatePath(`/org-admin/resumes/${resumeId}`);

    return { success: true, sessionId: session.id };
  } catch (err) {
    console.error("[createAiInterviewSessionAction]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create AI interview session",
    };
  }
}

// ── Upsert position-level AI interview config (Step 179) ──────────────────────

export interface AiInterviewConfigInput {
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  durationMinutes?: number;
  introQuestions?: number;
  technicalQuestions?: number;
  behavioralQuestions?: number;
  avatarProvider?: string;
  visualMode?: string;
  voiceProvider?: string;
  scoringProvider?: string;
  followUpEnabled?: boolean;
  cameraRequired?: boolean;
  retriesAllowed?: boolean;
}

export async function upsertPositionAiConfigAction(
  positionId: string,
  config: AiInterviewConfigInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found or unauthorized" };
    }

    // Find an existing config for this position (no interviewId = position-level default)
    const existing = await prisma.aiInterviewConfig.findFirst({
      where: { positionId, interviewId: null },
    });

    if (existing) {
      await prisma.aiInterviewConfig.update({
        where: { id: existing.id },
        data: {
          difficulty: config.difficulty ?? existing.difficulty,
          durationMinutes: config.durationMinutes ?? existing.durationMinutes,
          introQuestions: config.introQuestions ?? existing.introQuestions,
          technicalQuestions: config.technicalQuestions ?? existing.technicalQuestions,
          behavioralQuestions: config.behavioralQuestions ?? existing.behavioralQuestions,
          avatarProvider: config.avatarProvider ?? existing.avatarProvider,
          visualMode: config.visualMode ?? existing.visualMode,
          voiceProvider: config.voiceProvider ?? existing.voiceProvider,
          scoringProvider: config.scoringProvider ?? existing.scoringProvider,
          followUpEnabled: config.followUpEnabled ?? existing.followUpEnabled,
          cameraRequired: config.cameraRequired ?? existing.cameraRequired,
          retriesAllowed: config.retriesAllowed ?? existing.retriesAllowed,
        },
      });
    } else {
      await prisma.aiInterviewConfig.create({
        data: {
          positionId,
          difficulty: config.difficulty ?? "MEDIUM",
          durationMinutes: config.durationMinutes ?? 30,
          introQuestions: config.introQuestions ?? 2,
          technicalQuestions: config.technicalQuestions ?? 4,
          behavioralQuestions: config.behavioralQuestions ?? 3,
          avatarProvider: config.avatarProvider,
          visualMode: config.visualMode ?? "orb",
          voiceProvider: config.voiceProvider,
          scoringProvider: config.scoringProvider,
          followUpEnabled: config.followUpEnabled ?? false,
          cameraRequired: config.cameraRequired ?? false,
          retriesAllowed: config.retriesAllowed ?? false,
        },
      });
    }

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (err) {
    console.error("[upsertPositionAiConfigAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to save config" };
  }
}

// ── Question Bank Server Actions (Step 189 & 191) ───────────────────────────────────

import { AiQuestionCategory } from "@prisma/client";

export async function generateQuestionBankAction(positionId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found or unauthorized" };
    }

    const config = await prisma.aiInterviewConfig.findFirst({
      where: { positionId, interviewId: null },
    });

    const context: QuestionPlanContext = {
      positionTitle: position.title,
      jdText: position.jdText ?? undefined,
      questionCounts: {
        intro: config?.introQuestions ?? 2,
        technical: config?.technicalQuestions ?? 4,
        behavioral: config?.behavioralQuestions ?? 3,
      },
    };

    const plan = await aiInterviewer.generateQuestionPlan(context);

    if (!plan.questions || plan.questions.length === 0) {
       return { success: false, error: "No questions generated." };
    }

    const data = plan.questions.map((q, index) => ({
      positionId,
      questionText: q.question,
      category: q.category as AiQuestionCategory,
      rationale: (q as any).rationale,
      isApproved: false, // Must be approved by org admin
      sortOrder: index,
    }));

    // Insert new questions
    await prisma.aiInterviewQuestion.createMany({ data });

    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true, count: data.length };
  } catch (err) {
    console.error("[generateQuestionBankAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate questions" };
  }
}

export async function toggleQuestionApprovalAction(questionId: string, isApproved: boolean): Promise<{ success: boolean }> {
  const perms = await getCallerPermissions();
  if (!perms || !perms.canManagePositions) return { success: false };

  const q = await prisma.aiInterviewQuestion.findUnique({ where: { id: questionId }, include: { position: true } });
  if (!q || q.position.organizationId !== perms.orgId) return { success: false };

  await prisma.aiInterviewQuestion.update({
    where: { id: questionId },
    data: { isApproved },
  });
  
  revalidatePath(`/org-admin/positions/${q.positionId}`);
  return { success: true };
}

export async function editQuestionTextAction(questionId: string, newText: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false, error: "Unauthorized" };

    const q = await prisma.aiInterviewQuestion.findUnique({ where: { id: questionId }, include: { position: true } });
    if (!q || q.position.organizationId !== perms.orgId) return { success: false, error: "Not found" };

    await prisma.aiInterviewQuestion.update({
      where: { id: questionId },
      data: { questionText: newText },
    });
    
    revalidatePath(`/org-admin/positions/${q.positionId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: "Failed to update" };
  }
}

export async function deleteQuestionAction(questionId: string): Promise<{ success: boolean }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false };

    const q = await prisma.aiInterviewQuestion.findUnique({ where: { id: questionId }, include: { position: true } });
    if (!q || q.position.organizationId !== perms.orgId) return { success: false };

    await prisma.aiInterviewQuestion.delete({
      where: { id: questionId },
    });
    
    revalidatePath(`/org-admin/positions/${q.positionId}`);
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

// ── Step 227: Recruiter review ────────────────────────────────────────────────

export async function reviewAiSessionAction(
  sessionId: string,
  positionId: string,
  data: {
    recruiterNotes?: string;
    recruiterRecommendation?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canViewReviews) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Not found or unauthorized" };
    }

    await prisma.aiInterviewSession.update({
      where: { id: sessionId },
      data: {
        recruiterNotes: data.recruiterNotes ?? null,
        recruiterRecommendation: data.recruiterRecommendation ?? null,
        reviewedAt: new Date(),
        reviewedByUserId: perms.userId,
      },
    });

    revalidatePath(`/org-admin/positions/${positionId}`);
    revalidatePath(`/org-admin/resumes`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function saveQuestionOrderAction(positionId: string, orderedIds: string[]): Promise<{ success: boolean }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) return { success: false };
    
    const pos = await prisma.position.findUnique({ where: { id: positionId } });
    if (!pos || pos.organizationId !== perms.orgId) return { success: false };

    // Update individually
    await Promise.all(orderedIds.map((id, index) => 
      prisma.aiInterviewQuestion.update({
        where: { id },
        data: { sortOrder: index }
      }).catch(() => null)
    ));
    
    revalidatePath(`/org-admin/positions/${positionId}`);
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}
