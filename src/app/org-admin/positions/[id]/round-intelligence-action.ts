"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { decisionBriefPrompt } from "@/lib/ai/prompts/interview.prompts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PanelistScore {
  interviewerName: string;
  interviewerEmail: string;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  cultureFitScore: number;
  overallScore: number;
  recommendation: string;
  summary: string;
  strengths: string | null;
  concerns: string | null;
  submittedAt: string; // ISO
}

export interface ConsensusSummary {
  total: number;
  strongHire: number;
  hire: number;
  noHire: number;
  strongNoHire: number;
}

export interface BehaviorReportData {
  integrityScore: number | null;
  confidenceScore: number | null;
  composureScore: number | null;
  engagementScore: number | null;
  answerQualityAvg: number | null;
  behaviorFlags: Array<{ type: string; severity: string; description: string }>;
  topStrengths: string[];
  perAnswerScores: Array<{ question: string; score: number; rationale: string }>;
}

export interface AiSessionData {
  overallScore: number | null;
  recommendation: string | null;
  questionCount: number;
  completedAt: string | null; // ISO
  executiveSummary: string | null;
}

export interface RecordingData {
  hasRecording: boolean;
  durationSecs: number | null;
  presignedUrl: string | null;
}

export interface RoundIntelligence {
  // Interview metadata
  interview: {
    id: string;
    status: string;
    roundLabel: string | null;
    stageIndex: number | null;
    scheduledAt: string | null;
    completedAt: string | null;
    candidateName: string;
    candidateEmail: string;
  };

  // Lead interviewer feedback
  leadFeedback: {
    rating: number;
    recommendation: string;
    summary: string;
    notes: string | null;
  } | null;

  // All panelist scorecards
  panelistScores: PanelistScore[];

  // AI Behavior Report
  behaviorReport: BehaviorReportData | null;

  // AI Interview Session (for AI_SCREEN rounds)
  aiSession: AiSessionData | null;

  // Recording
  recording: RecordingData;

  // Computed aggregates
  compositeScore: number | null;
  consensusSummary: ConsensusSummary;

  // AI Decision Brief
  aiBrief: string | null;
}

// ── Main Action ──────────────────────────────────────────────────────────────

export async function fetchRoundIntelligenceAction(
  interviewId: string
): Promise<{ success: true; data: RoundIntelligence } | { success: false; error: string }> {
  try {
    // ── RBAC ──────────────────────────────────────────────────────────────
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    const allowedRoles = ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"];
    const hasRole = perms.roles?.some((r: string) => allowedRoles.includes(r));
    if (!hasRole && !perms.canManagePositions) {
      return { success: false, error: "You do not have permission to view round intelligence." };
    }

    // ── Fetch all data in parallel ────────────────────────────────────────
    const [interview, leadFeedback, panelistFeedbacks, behaviorReport] = await Promise.all([
      prisma.interview.findUnique({
        where: { id: interviewId },
        select: {
          id: true,
          status: true,
          roundLabel: true,
          stageIndex: true,
          scheduledAt: true,
          updatedAt: true, // used as "completedAt" proxy when status is COMPLETED
          recordingUrl: true,
          recordingDurationSecs: true,
          resumeId: true,
          positionId: true,
          organizationId: true,
          candidate: { select: { name: true, email: true } },
        },
      }),

      prisma.interviewFeedback.findUnique({
        where: { interviewId },
        select: { rating: true, recommendation: true, summary: true, notes: true },
      }),

      prisma.panelistFeedback.findMany({
        where: { interviewId },
        include: {
          interviewer: { select: { name: true, email: true } },
        },
        orderBy: { submittedAt: "desc" },
      }),

      prisma.interviewBehaviorReport.findUnique({
        where: { interviewId },
        select: {
          integrityScore: true,
          confidenceScore: true,
          composureScore: true,
          engagementScore: true,
          answerQualityAvg: true,
          behaviorFlags: true,
          topStrengths: true,
          perAnswerScores: true,
        },
      }),
    ]);

    if (!interview) return { success: false, error: "Interview not found." };

    // ── Org scope check ────────────────────────────────────────────────────
    if (perms.orgId && interview.organizationId !== perms.orgId) {
      return { success: false, error: "Forbidden: org mismatch." };
    }

    // ── AI Session (for AI_SCREEN rounds) ────────────────────────────────
    let aiSession: AiSessionData | null = null;
    if (interview.resumeId && interview.positionId) {
      const session = await prisma.aiInterviewSession.findFirst({
        where: {
          resumeId: interview.resumeId,
          positionId: interview.positionId,
          status: "COMPLETED",
        },
        select: {
          overallScore: true,
          recommendation: true,
          finalScoreJson: true,
          completedAt: true,
          turns: { select: { id: true } },
        },
        orderBy: { completedAt: "desc" },
      });

      if (session) {
        const scoreJson = session.finalScoreJson as Record<string, unknown> | null;
        aiSession = {
          overallScore: session.overallScore,
          recommendation: session.recommendation,
          questionCount: session.turns.length,
          completedAt: session.completedAt?.toISOString() ?? null,
          executiveSummary: (scoreJson?.executiveSummary as string) ?? null,
        };
      }
    }

    // ── Recording pre-signed URL ─────────────────────────────────────────
    const recording: RecordingData = {
      hasRecording: !!interview.recordingUrl,
      durationSecs: interview.recordingDurationSecs,
      presignedUrl: null,
    };

    if (interview.recordingUrl) {
      try {
        recording.presignedUrl = await buildPresignedUrl(interview.recordingUrl);
      } catch (err) {
        console.error("[RoundIntelligence] Failed to generate pre-signed URL:", err);
        // Non-fatal — recording section will show "unavailable"
      }
    }

    // ── Build panelist scores ────────────────────────────────────────────
    const panelistScores: PanelistScore[] = panelistFeedbacks.map((fb) => ({
      interviewerName: fb.interviewer?.name ?? "Interviewer",
      interviewerEmail: fb.interviewer?.email ?? "",
      technicalScore: fb.technicalScore,
      communicationScore: fb.communicationScore,
      problemSolvingScore: fb.problemSolvingScore,
      cultureFitScore: fb.cultureFitScore,
      overallScore: fb.overallScore,
      recommendation: fb.recommendation,
      summary: fb.summary,
      strengths: fb.strengths,
      concerns: fb.concerns,
      submittedAt: fb.submittedAt.toISOString(),
    }));

    // ── Compute composite score ──────────────────────────────────────────
    let compositeScore: number | null = null;
    if (panelistScores.length > 0) {
      const sum = panelistScores.reduce((acc, s) => acc + s.overallScore, 0);
      compositeScore = Math.round(sum / panelistScores.length);
    } else if (leadFeedback) {
      compositeScore = leadFeedback.rating; // 0-100 rating from lead
    } else if (aiSession?.overallScore != null) {
      compositeScore = aiSession.overallScore;
    }

    // ── Compute consensus ────────────────────────────────────────────────
    const consensusSummary: ConsensusSummary = {
      total: panelistScores.length,
      strongHire: panelistScores.filter((s) => s.recommendation === "STRONG_HIRE").length,
      hire: panelistScores.filter((s) => s.recommendation === "HIRE").length,
      noHire: panelistScores.filter((s) => s.recommendation === "NO_HIRE").length,
      strongNoHire: panelistScores.filter((s) => s.recommendation === "STRONG_NO_HIRE").length,
    };

    // ── Behavior report data ─────────────────────────────────────────────
    let behaviorData: BehaviorReportData | null = null;
    if (behaviorReport) {
      behaviorData = {
        integrityScore: behaviorReport.integrityScore,
        confidenceScore: behaviorReport.confidenceScore,
        composureScore: behaviorReport.composureScore,
        engagementScore: behaviorReport.engagementScore,
        answerQualityAvg: behaviorReport.answerQualityAvg,
        behaviorFlags: Array.isArray(behaviorReport.behaviorFlags)
          ? (behaviorReport.behaviorFlags as BehaviorReportData["behaviorFlags"])
          : [],
        topStrengths: Array.isArray(behaviorReport.topStrengths)
          ? (behaviorReport.topStrengths as string[])
          : [],
        perAnswerScores: Array.isArray(behaviorReport.perAnswerScores)
          ? (behaviorReport.perAnswerScores as BehaviorReportData["perAnswerScores"])
          : [],
      };
    }

    // ── AI Decision Brief (non-blocking) ─────────────────────────────────
    let aiBrief: string | null = null;
    const hasFeedbackData = panelistScores.length > 0 || leadFeedback || aiSession;

    if (hasFeedbackData) {
      try {
        aiBrief = await generateDecisionBrief({
          roundLabel: interview.roundLabel ?? "Interview Round",
          candidateName: interview.candidate?.name ?? "Candidate",
          panelistSummaries: panelistScores.map((s) => ({
            name: s.interviewerName,
            score: s.overallScore,
            recommendation: s.recommendation,
            summary: s.summary,
          })),
          leadFeedback: leadFeedback
            ? { rating: leadFeedback.rating, recommendation: leadFeedback.recommendation, summary: leadFeedback.summary }
            : undefined,
          aiSession: aiSession
            ? { score: aiSession.overallScore, recommendation: aiSession.recommendation, summary: aiSession.executiveSummary }
            : undefined,
          behaviorHighlights: behaviorData
            ? { integrityScore: behaviorData.integrityScore, flagCount: behaviorData.behaviorFlags.length }
            : undefined,
        });
      } catch (err) {
        console.error("[RoundIntelligence] AI Brief generation failed:", err);
        // Non-fatal
      }
    }

    // ── Assemble response ────────────────────────────────────────────────
    const data: RoundIntelligence = {
      interview: {
        id: interview.id,
        status: interview.status,
        roundLabel: interview.roundLabel,
        stageIndex: interview.stageIndex,
        scheduledAt: interview.scheduledAt?.toISOString() ?? null,
        completedAt: interview.status === "COMPLETED" ? interview.updatedAt.toISOString() : null,
        candidateName: interview.candidate?.name ?? "Unknown Candidate",
        candidateEmail: interview.candidate?.email ?? "",
      },
      leadFeedback,
      panelistScores,
      behaviorReport: behaviorData,
      aiSession,
      recording,
      compositeScore,
      consensusSummary,
      aiBrief,
    };

    return { success: true, data };
  } catch (err: unknown) {
    console.error("[RoundIntelligence] Error:", err);
    return { success: false, error: (err as Error).message ?? "Internal error" };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildPresignedUrl(recordingUrl: string): Promise<string> {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 is not configured.");
  }

  // Extract object key from URL or use as-is
  let objectKey = recordingUrl;
  if (objectKey.startsWith("http")) {
    try {
      const url = new URL(objectKey);
      objectKey = url.pathname.replace(/^\/[^/]+\//, "").replace(/^\//, "");
    } catch {
      // use as-is
    }
  }

  const r2 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const cmd = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(r2, cmd, { expiresIn: 3600 }); // 1 hour
}

// ── AI Decision Brief Generation ─────────────────────────────────────────────

interface DecisionBriefInput {
  roundLabel: string;
  candidateName: string;
  panelistSummaries: Array<{ name: string; score: number; recommendation: string; summary: string }>;
  leadFeedback?: { rating: number; recommendation: string; summary: string };
  aiSession?: { score: number | null; recommendation: string | null; summary: string | null };
  behaviorHighlights?: { integrityScore: number | null; flagCount: number };
}

async function generateDecisionBrief(input: DecisionBriefInput): Promise<string | null> {
  const { system, user } = decisionBriefPrompt(input);

  try {
    const result = await geminiClient.models.generateContent({
      model: geminiModel,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: 200,
        temperature: 0.3,
      },
    });

    const text = result.text?.trim();
    return text || null;
  } catch (err) {
    console.error("[DecisionBrief] Gemini call failed:", err);
    return null;
  }
}
