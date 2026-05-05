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
      where: { resumeId, positionId, status: { in: ["IN_PROGRESS", "QUEUED"] } },
    });
    if (existing) {
      return { success: true, sessionId: existing.id }; // idempotent
    }

    const posConfig = await prisma.aiInterviewConfig.findFirst({
      where: { positionId, interviewId: null },
    });
    const strategy = posConfig?.generationStrategy ?? "STANDARDIZED";

    // Try to find the candidate user by their email
    const candidateEmail = resume.overrideEmail || resume.candidateEmail;
    if (!candidateEmail) {
      return { success: false, error: "Candidate has no email. Cannot create AI interview session." };
    }
    const candidateUser = await prisma.user.findUnique({
      where: { email: candidateEmail },
    });

    if (strategy === "TAILORED") {
      // Create session in QUEUED state. A background job will generate questions and send email.
      const session = await prisma.aiInterviewSession.create({
        data: {
          candidateId: candidateUser?.id ?? null,
          resumeId: resume.id,
          positionId: resume.positionId,
          status: "QUEUED",
        },
      });

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

      revalidatePath(`/org-admin/positions/${positionId}`);
      revalidatePath(`/org-admin/resumes/${resumeId}`);
      return { success: true, sessionId: session.id };
    }

    // ── Strategy: STANDARDIZED ──
    // Fetch approved questions from Question Bank
    const approvedQuestions = await prisma.aiInterviewQuestion.findMany({
      where: { positionId, isApproved: true },
      orderBy: { sortOrder: "asc" },
    });

    if (approvedQuestions.length === 0) {
      return { success: false, error: "No Approved Question Bank found. Please go to Position Settings to generate one." };
    }

    const finalQuestions = approvedQuestions.map(q => ({
      category: q.category,
      question: q.questionText,
    }));

    // Create session
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

    // Log AI usage (only if we did dynamic generation - which doesn't happen inline here anymore)
    // Kept for backward compatibility if we re-introduce inline generation
    // if (generationUsage && generationUsage.totalTokens > 0) { ... }

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
    
    let errorMessage = err instanceof Error ? err.message : "Failed to create AI interview session";
    
    if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "AI Provider Quota Exceeded. Please check your API limits or try again in a moment.";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ── Upsert position-level AI interview config (Step 179) ──────────────────────

export interface AiInterviewConfigInput {
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  durationMinutes?: number;
  generationStrategy?: "STANDARDIZED" | "TAILORED";
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
          generationStrategy: config.generationStrategy ?? existing.generationStrategy,
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
          generationStrategy: config.generationStrategy ?? "STANDARDIZED",
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
    let errorMessage = err instanceof Error ? err.message : "Failed to generate questions";
    
    if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      errorMessage = "AI Provider Quota Exceeded. Please check your API limits or try again in a moment.";
    }
    
    return { success: false, error: errorMessage };
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

    // Fetch current session to snapshot previous AI values (Gap 3)
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
      select: {
        recommendation: true,
        recruiterRecommendation: true,
        overallScore: true,
        resumeId: true,
      },
    });

    await prisma.aiInterviewSession.update({
      where: { id: sessionId },
      data: {
        recruiterNotes: data.recruiterNotes ?? null,
        recruiterRecommendation: data.recruiterRecommendation ?? null,
        reviewedAt: new Date(),
        reviewedByUserId: perms.userId,
      },
    });

    // ── Gap 2: Audit trail for AI interview override ────────────────────
    if (data.recruiterRecommendation && session) {
      await prisma.auditLog.create({
        data: {
          organizationId: perms.orgId,
          userId: perms.userId,
          action: "AI_SESSION_REVIEWED",
          resourceType: "AI_SESSION",
          resourceId: sessionId,
          metadata: {
            positionId,
            resumeId: session.resumeId,
            previousAiRecommendation: session.recommendation,
            previousRecruiterOverride: session.recruiterRecommendation,
            newRecruiterRecommendation: data.recruiterRecommendation,
            aiOverallScore: session.overallScore,
            hasNotes: !!data.recruiterNotes,
            reviewedAt: new Date().toISOString(),
          },
        },
      }).catch((err) => {
        console.error("AUDIT: Failed to log AI session review:", err);
      });
    }

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
