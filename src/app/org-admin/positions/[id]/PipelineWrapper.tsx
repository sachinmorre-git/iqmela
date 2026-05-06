"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CandidatePipelineBar, type StageState } from "./CandidatePipelineBar";
import { ScheduleDrawer } from "./ScheduleDrawer";
import { OfferWorkspaceDrawer } from "./OfferWorkspaceDrawer";
import { BgvWorkspaceDrawer } from "./BgvWorkspaceDrawer";
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
  const [isBgvDrawerOpen, setIsBgvDrawerOpen] = useState(false);
  const router = useRouter();

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

  const showActions = pipelineStatus !== "HIRED" && pipelineStatus !== "REJECTED" && pipelineStatus !== "WITHDRAWN";

  return (
    <div className="flex items-center gap-4">
      <CandidatePipelineBar
        stages={stages}
        resumeId={resumeId}
        positionId={positionId}
        onStageClick={(s) => {
          if (s.status === "COMPLETED") {
            router.push(`/org-admin/candidates/${resumeId}/intelligence?focus=${s.stage.stageIndex}`);
          } else if (s.status !== "SKIPPED") {
            setDrawerStage(s);
          }
        }}
      />

      {showActions && (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsBgvDrawerOpen(true)}
            className="w-11 h-11 flex flex-col items-center justify-center leading-tight bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[10px] font-bold rounded-xl transition-all shadow-sm"
          >
            <span>BGV</span>
            <span>Check</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOfferDrawerOpen(true)}
            className={`w-11 h-11 flex flex-col items-center justify-center leading-tight text-[10px] font-bold rounded-xl transition-all shadow-sm ${
              pipelineStatus === "OFFER_PENDING"
                ? "bg-pink-600 hover:bg-pink-700 text-white shadow-pink-500/20"
                : "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border border-pink-200 dark:border-pink-800/50 hover:bg-pink-100 dark:hover:bg-pink-900/50"
            }`}
          >
            {pipelineStatus === "OFFER_PENDING" ? (
              <><span>View</span><span>Offer</span></>
            ) : (
              <><span>Extend</span><span>Offer</span></>
            )}
          </button>
        </div>
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
        pipelineStatus={pipelineStatus}
      />

      <BgvWorkspaceDrawer
        isOpen={isBgvDrawerOpen}
        onClose={() => setIsBgvDrawerOpen(false)}
        resumeId={resumeId}
        positionId={positionId}
        candidateName={candidateName}
        totalStages={stages.length}
      />
    </div>
  );
}
