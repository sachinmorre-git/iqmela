"use client";

import { useState, useMemo, useCallback } from "react";
import { CandidatePipelineBar, type StageState } from "./CandidatePipelineBar";
import { ScheduleDrawer } from "./ScheduleDrawer";
import { OfferWorkspaceDrawer } from "./OfferWorkspaceDrawer";
import { rankInterviewers, type InterviewerForMatch, type MatchResult } from "@/lib/interviewer-match";
import type { InterviewRoundType } from "@prisma/client";

interface Interviewer {
  id: string;
  name: string | null;
  email: string;
}

// Extended interviewer with profile data for AI matching
interface InterviewerWithProfile extends Interviewer {
  title?: string | null;
  skills?: string[];
  expertise?: string | null;
  source?: "INTERNAL" | "MARKETPLACE";
  hourlyRate?: number | null;
  totalInterviews?: number;
  avgRating?: number | null;
  isVerified?: boolean;
  avatarUrl?: string | null;
  department?: string | null;
  linkedinUrl?: string | null;
}

interface PipelineWrapperProps {
  stages: StageState[];
  resumeId: string;
  positionId: string;
  candidateName: string;
  pipelineStatus?: string;
  matchScore?: number | null;
  topSkills?: string[];
  interviewers: InterviewerWithProfile[];
  aiFocusAreas?: string[];
  jdRequiredSkills?: string[];
  candidateSkills?: string[];
}

export function PipelineWrapper({
  stages,
  resumeId,
  positionId,
  candidateName,
  matchScore,
  topSkills = [],
  interviewers,
  aiFocusAreas = [],
  jdRequiredSkills = [],
  candidateSkills = [],
  pipelineStatus = "ACTIVE",
}: PipelineWrapperProps) {
  const [drawerStage, setDrawerStage] = useState<StageState | null>(null);
  const [isOfferDrawerOpen, setIsOfferDrawerOpen] = useState(false);

  // Build previous rounds for the drawer context
  const previousRounds = stages
    .filter((s) => s.stage.stageIndex < (drawerStage?.stage.stageIndex ?? 0))
    .map((s) => ({
      label: s.stage.roundLabel,
      status: s.status,
      score: s.score,
    }));

  // Convert interviewers to match-ready format and compute AI match scores
  const matchResults = useMemo<MatchResult[]>(() => {
    if (!drawerStage) return [];

    const matchInterviewers: InterviewerForMatch[] = interviewers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      title: u.title || null,
      skills: u.skills || [],
      expertise: u.expertise || null,
      source: u.source || "INTERNAL",
      hourlyRate: u.hourlyRate ?? null,
      totalInterviews: u.totalInterviews ?? 0,
      avgRating: u.avgRating ?? null,
      isVerified: u.isVerified ?? false,
      avatarUrl: u.avatarUrl ?? null,
      department: u.department ?? null,
      linkedinUrl: u.linkedinUrl ?? null,
    }));

    return rankInterviewers(
      matchInterviewers,
      candidateSkills,
      drawerStage.stage.roundType as InterviewRoundType,
      jdRequiredSkills,
      20 // top 20
    );
  }, [drawerStage, interviewers, candidateSkills, jdRequiredSkills]);

  // After ADVANCE decision → auto-open the next AVAILABLE stage's schedule form
  const handleAdvanceToStage = useCallback((nextStageIndex: number) => {
    const nextStage = stages.find(
      (s) => s.stage.stageIndex >= nextStageIndex && s.status === "AVAILABLE"
    );
    if (nextStage) {
      // Small delay so the success animation completes
      setTimeout(() => setDrawerStage(nextStage), 300);
    } else {
      // No more stages — close drawer (candidate is ready for offer)
      setTimeout(() => setDrawerStage(null), 1200);
    }
  }, [stages]);

  const allStagesCompleted = stages.length > 0 && stages.every(s => s.status === "COMPLETED" || s.status === "SKIPPED");
  const showOfferButton = pipelineStatus !== "HIRED" && pipelineStatus !== "REJECTED" && pipelineStatus !== "WITHDRAWN" && allStagesCompleted;

  return (
    <div className="flex items-center gap-4">
      <CandidatePipelineBar
        stages={stages}
        resumeId={resumeId}
        positionId={positionId}
        onStageClick={(s) => {
          if (s.status !== "SKIPPED") {
            setDrawerStage(s);
          }
        }}
      />

      {showOfferButton && (
        <button
          onClick={() => setIsOfferDrawerOpen(true)}
          className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-lg shadow-sm shadow-violet-500/20 transition-all ml-2"
        >
          {pipelineStatus === "OFFER_PENDING" ? "View Offer" : "Extend Offer"}
        </button>
      )}

      <ScheduleDrawer
        isOpen={drawerStage !== null}
        onClose={() => setDrawerStage(null)}
        stage={drawerStage}
        resumeId={resumeId}
        positionId={positionId}
        candidateName={candidateName}
        matchScore={matchScore}
        topSkills={topSkills}
        previousRounds={previousRounds}
        interviewers={interviewers}
        aiFocusAreas={aiFocusAreas}
        matchResults={matchResults}
        totalStages={stages.length}
        onAdvanceToStage={handleAdvanceToStage}
      />

      <OfferWorkspaceDrawer
        isOpen={isOfferDrawerOpen}
        onClose={() => setIsOfferDrawerOpen(false)}
        resumeId={resumeId}
        positionId={positionId}
        candidateName={candidateName}
      />
    </div>
  );
}
