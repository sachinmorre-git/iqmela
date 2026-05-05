"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { decisionBriefPrompt, roundInsightsPrompt, hiringConfidencePrompt } from "@/lib/ai/prompts/interview.prompts";

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

  // AI Hiring Confidence (0-100)
  aiConfidence: { confidence: number; justification: string } | null;

  // Key AI Insights
  keyInsights: {
    topStrength: string;
    biggestRisk: string;
    nextRoundSuggestion: string;
  } | null;

  // Skill Radar data (normalized 0-100 for chart)
  skillRadar: {
    technical: number;
    communication: number;
    problemSolving: number;
    cultureFit: number;
  } | null;
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

    // ── Compute dimension averages ────────────────────────────────────────
    let skillRadar: RoundIntelligence["skillRadar"] = null;
    if (panelistScores.length > 0) {
      skillRadar = {
        technical: Math.round(panelistScores.reduce((s, p) => s + p.technicalScore, 0) / panelistScores.length * 10),
        communication: Math.round(panelistScores.reduce((s, p) => s + p.communicationScore, 0) / panelistScores.length * 10),
        problemSolving: Math.round(panelistScores.reduce((s, p) => s + p.problemSolvingScore, 0) / panelistScores.length * 10),
        cultureFit: Math.round(panelistScores.reduce((s, p) => s + p.cultureFitScore, 0) / panelistScores.length * 10),
      };
    }

    // ── Consensus label for prompts ──────────────────────────────────────
    const positiveCount = consensusSummary.strongHire + consensusSummary.hire;
    const negativeCount = consensusSummary.noHire + consensusSummary.strongNoHire;
    const consensusLabel =
      consensusSummary.total === 0 ? "No votes" :
      negativeCount === 0 ? "Unanimous Positive" :
      positiveCount === 0 ? "Unanimous Negative" :
      "Split Opinion";

    // ── AI Generation (all 3 in parallel, non-blocking) ──────────────────
    const hasFeedbackData = panelistScores.length > 0 || leadFeedback || aiSession;
    const candidateName = interview.candidate?.name ?? "Candidate";
    const roundLabel = interview.roundLabel ?? "Interview Round";

    let aiBrief: string | null = null;
    let aiConfidence: RoundIntelligence["aiConfidence"] = null;
    let keyInsights: RoundIntelligence["keyInsights"] = null;

    if (hasFeedbackData) {
      const [briefResult, confidenceResult, insightsResult] = await Promise.allSettled([
        // 1. Decision Brief
        generateDecisionBrief({
          roundLabel,
          candidateName,
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
        }),
        // 2. Hiring Confidence
        generateHiringConfidence({
          candidateName,
          compositeScore,
          consensusLabel,
          panelistCount: panelistScores.length,
          aiSessionScore: aiSession?.overallScore ?? null,
          aiSessionRecommendation: aiSession?.recommendation ?? null,
          behaviorIntegrity: behaviorData?.integrityScore ?? null,
          behaviorFlagCount: behaviorData?.behaviorFlags.length ?? 0,
          dimensionAverages: skillRadar ? {
            technical: skillRadar.technical / 10,
            communication: skillRadar.communication / 10,
            problemSolving: skillRadar.problemSolving / 10,
            cultureFit: skillRadar.cultureFit / 10,
          } : null,
        }),
        // 3. Key Insights
        generateRoundInsights({
          roundLabel,
          candidateName,
          compositeScore,
          panelistSummaries: panelistScores.map((s) => ({
            name: s.interviewerName,
            score: s.overallScore,
            recommendation: s.recommendation,
            summary: s.summary,
            strengths: s.strengths,
            concerns: s.concerns,
            technicalScore: s.technicalScore,
            communicationScore: s.communicationScore,
            problemSolvingScore: s.problemSolvingScore,
            cultureFitScore: s.cultureFitScore,
          })),
          aiSession: aiSession
            ? { score: aiSession.overallScore, recommendation: aiSession.recommendation, summary: aiSession.executiveSummary }
            : undefined,
          behaviorData: behaviorData
            ? {
                integrityScore: behaviorData.integrityScore,
                confidenceScore: behaviorData.confidenceScore,
                composureScore: behaviorData.composureScore,
                engagementScore: behaviorData.engagementScore,
                flagCount: behaviorData.behaviorFlags.length,
              }
            : undefined,
        }),
      ]);

      if (briefResult.status === "fulfilled") aiBrief = briefResult.value;
      if (confidenceResult.status === "fulfilled") aiConfidence = confidenceResult.value;
      if (insightsResult.status === "fulfilled") keyInsights = insightsResult.value;
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
      aiConfidence,
      keyInsights,
      skillRadar,
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

// ── AI Hiring Confidence Generation ──────────────────────────────────────────

import type { HiringConfidenceContext, RoundInsightsContext } from "@/lib/ai/prompts/interview.prompts";

async function generateHiringConfidence(
  input: HiringConfidenceContext
): Promise<{ confidence: number; justification: string } | null> {
  const { system, user } = hiringConfidencePrompt(input);

  try {
    const result = await geminiClient.models.generateContent({
      model: geminiModel,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: 200,
        temperature: 0.2,
      },
    });

    const text = result.text?.trim();
    if (!text) return null;

    // Extract JSON from potential markdown wrapping
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.confidence === "number" && typeof parsed.justification === "string") {
      return { confidence: parsed.confidence, justification: parsed.justification };
    }
    return null;
  } catch (err) {
    console.error("[HiringConfidence] Gemini call failed:", err);
    return null;
  }
}

// ── AI Round Insights Generation ─────────────────────────────────────────────

async function generateRoundInsights(
  input: RoundInsightsContext
): Promise<{ topStrength: string; biggestRisk: string; nextRoundSuggestion: string } | null> {
  const { system, user } = roundInsightsPrompt(input);

  try {
    const result = await geminiClient.models.generateContent({
      model: geminiModel,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: 400,
        temperature: 0.3,
      },
    });

    const text = result.text?.trim();
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.topStrength && parsed.biggestRisk && parsed.nextRoundSuggestion) {
      return {
        topStrength: parsed.topStrength,
        biggestRisk: parsed.biggestRisk,
        nextRoundSuggestion: parsed.nextRoundSuggestion,
      };
    }
    return null;
  } catch (err) {
    console.error("[RoundInsights] Gemini call failed:", err);
    return null;
  }
}
