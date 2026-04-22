"use client";

import { useState } from "react";
import type { InterviewRoundType, InterviewMode } from "@prisma/client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PipelineStage {
  stageIndex: number;
  roundLabel: string;
  roundType: InterviewRoundType;
  durationMinutes: number;
  interviewMode: InterviewMode;
}

export type StageStatus = "COMPLETED" | "SCHEDULED" | "AVAILABLE" | "SKIPPED";

export interface StageState {
  stage: PipelineStage;
  status: StageStatus;
  interviewId?: string;
  scheduledAt?: string;
  interviewerName?: string;
  score?: number | null;
}

interface CandidatePipelineBarProps {
  stages: StageState[];
  resumeId: string;
  positionId: string;
  onStageClick: (stage: StageState) => void;
}

// ── Status Visuals ──────────────────────────────────────────────────────────

const statusConfig: Record<StageStatus, {
  dot: string;
  line: string;
  label: string;
  pulse?: boolean;
  cursor: string;
}> = {
  COMPLETED: {
    dot: "bg-emerald-500 border-emerald-400 shadow-emerald-500/30 shadow-sm",
    line: "bg-emerald-500",
    label: "text-emerald-600 dark:text-emerald-400",
    cursor: "cursor-pointer",
  },
  SCHEDULED: {
    dot: "bg-amber-400 border-amber-300 shadow-amber-400/30 shadow-sm",
    line: "bg-amber-400/50",
    label: "text-amber-600 dark:text-amber-400",
    pulse: true,
    cursor: "cursor-pointer",
  },
  AVAILABLE: {
    dot: "bg-transparent border-gray-400 dark:border-zinc-500 border-2",
    line: "bg-gray-200 dark:bg-zinc-700",
    label: "text-gray-500 dark:text-zinc-400",
    cursor: "cursor-pointer hover:border-teal-400 hover:shadow-teal-400/20 hover:shadow-sm",
  },

  SKIPPED: {
    dot: "bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600",
    line: "bg-gray-200 dark:bg-zinc-700",
    label: "text-gray-400 dark:text-zinc-500 line-through",
    cursor: "cursor-default",
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export function CandidatePipelineBar({
  stages,
  resumeId,
  positionId,
  onStageClick,
}: CandidatePipelineBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (stages.length === 0) {
    return (
      <span className="text-[10px] text-gray-400 dark:text-zinc-500 italic">
        No interview plan
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0 select-none">
      {stages.map((s, i) => {
        const config = statusConfig[s.status];
        const isLast = i === stages.length - 1;
        const isHovered = hoveredIndex === i;

        return (
          <div key={s.stage.stageIndex} className="flex items-center">
            {/* Dot + Label */}
            <div className="flex flex-col items-center gap-0.5 relative">
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 px-2 py-1 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold rounded-lg shadow-lg pointer-events-none">
                  {s.status === "COMPLETED" && s.stage.roundType === "BGV_CHECK" && `✓ BGV Complete${s.score != null ? ` (${s.score}/10)` : ""}`}
                  {s.status === "COMPLETED" && s.stage.roundType !== "BGV_CHECK" && `✓ ${s.stage.roundLabel}${s.score != null ? ` (${s.score}/10)` : ""}`}
                  {s.status === "SCHEDULED" && s.stage.roundType === "BGV_CHECK" && `◌ BGV — In Progress`}
                  {s.status === "SCHEDULED" && s.stage.roundType !== "BGV_CHECK" && `◌ ${s.stage.roundLabel} — Scheduled`}
                  {s.status === "AVAILABLE" && s.stage.roundType === "BGV_CHECK" && `Click to initiate BGV`}
                  {s.status === "AVAILABLE" && s.stage.roundType !== "BGV_CHECK" && `Click to schedule ${s.stage.roundLabel}`}

                  {s.status === "SKIPPED" && `${s.stage.roundLabel} — Skipped`}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-zinc-100" />
                </div>
              )}

              {/* The dot */}
              <button
                type="button"
                onClick={() => onStageClick(s)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`w-4 h-4 rounded-full border transition-all duration-200 ${config.dot} ${config.cursor} ${
                  config.pulse ? "animate-pulse" : ""
                }`}
                title={s.stage.roundLabel}
              >
                {s.status === "COMPLETED" && (
                  <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Label */}
              <span className={`text-[8px] font-bold tracking-wide uppercase leading-none mt-0.5 ${config.label}`}>
                {s.stage.roundType === "AI_SCREEN" ? "AI" : s.stage.roundType === "BGV_CHECK" ? "BGV" : `R${s.stage.stageIndex}`}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className={`w-4 h-0.5 ${config.line} mx-0.5 rounded-full transition-colors duration-300`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
