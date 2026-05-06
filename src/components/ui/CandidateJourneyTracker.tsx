"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type JourneyStageState = "COMPLETED" | "ACTIVE" | "PENDING" | "FAILED" | "SKIPPED";

export interface JourneyStage {
  id: string;
  title: string;
  icon: React.ReactNode | string;
  state: JourneyStageState;
  score?: number;
  label?: string;
  reportLink?: string;
}

export function CandidateJourneyTracker({ stages, onNodeClick }: { stages: JourneyStage[], onNodeClick?: (stage: JourneyStage) => void }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const router = useRouter();

  // Find the first non-completed stage to mark the active line
  const activeStageIndex = stages.findIndex((s) => s.state === "ACTIVE");
  const completedCount = stages.filter((s) => s.state === "COMPLETED" || s.state === "FAILED").length;
  // If there's an active stage, the progress goes up to it. Otherwise, up to completed.
  const progressIndex = activeStageIndex !== -1 ? activeStageIndex : completedCount - 1;

  return (
    <div className="w-full bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-gray-100 dark:border-zinc-800/60 rounded-3xl p-6 md:p-8 shadow-sm relative z-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">Candidate Journey</h3>
          <span className="hidden sm:inline-block text-[10px] font-medium text-gray-400 dark:text-zinc-500">(Hover or tap a stage for details)</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-full shrink-0">
          {stages.filter(s => s.state === "COMPLETED").length} / {stages.length} Stages Completed
        </span>
      </div>

      <div className="relative">
        {/* Background Track */}
        <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full -translate-y-1/2 z-0" />
        
        {/* Active Track */}
        <div 
          className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full -translate-y-1/2 z-0 transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(0, (progressIndex / (stages.length - 1)) * 100)}%` }}
        />

        {/* Nodes */}
        <div className="relative z-10 flex justify-between">
          {stages.map((stage, idx) => {
            const isCompleted = stage.state === "COMPLETED";
            const isActive = stage.state === "ACTIVE";
            const isFailed = stage.state === "FAILED";
            const isPending = stage.state === "PENDING" || stage.state === "SKIPPED";
            
            // Node colors
            let nodeBg = "bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-700";
            let textCol = "text-gray-400 dark:text-zinc-500";
            let ring = "";

            if (isCompleted) {
              nodeBg = "bg-emerald-500 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
              textCol = "text-white";
            } else if (isFailed) {
              nodeBg = "bg-red-500 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
              textCol = "text-white";
            } else if (isActive) {
              nodeBg = "bg-white dark:bg-zinc-900 border-4 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]";
              textCol = "text-rose-600 dark:text-rose-400";
              ring = "ring-4 ring-rose-500/20 dark:ring-rose-500/10 animate-pulse";
            }

            return (
              <div 
                key={stage.id} 
                className={cn(
                  "relative flex flex-col items-center group transition-transform",
                  stage.reportLink ? "cursor-pointer active:scale-95 hover:-translate-y-1" : "cursor-default"
                )}
                onMouseEnter={() => setHoveredNode(stage.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => {
                  if (stage.reportLink) {
                    if (onNodeClick) onNodeClick(stage);
                    else router.push(stage.reportLink);
                  }
                }}
              >
                {/* Visual Node */}
                <div className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 relative",
                  nodeBg, ring,
                  hoveredNode === stage.id ? "scale-110" : ""
                )}>
                  {typeof stage.icon === "string" ? (
                    <span className="text-sm md:text-lg">{stage.icon}</span>
                  ) : (
                    <div className={cn("w-5 h-5", textCol)}>{stage.icon}</div>
                  )}
                  {/* Indicator Dot for Interactive Reports */}
                  {(stage.reportLink || isCompleted || isFailed) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                  )}
                </div>

                {/* Stage Title Below */}
                <div className="absolute top-14 w-24 text-center mt-1">
                  <p className={cn(
                    "text-[10px] md:text-xs font-bold transition-colors",
                    isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-zinc-400"
                  )}>
                    {stage.title}
                  </p>
                  {stage.label && (
                    <p className={cn(
                      "text-[9px] font-bold mt-0.5 uppercase",
                      isCompleted ? "text-emerald-600 dark:text-emerald-400" :
                      isFailed ? "text-red-600 dark:text-red-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {stage.label}
                    </p>
                  )}
                </div>

                {/* Hover Popover */}
                <div className={cn(
                  "absolute bottom-full mb-3 w-48 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl p-3 shadow-xl transition-all duration-200 origin-bottom z-50",
                  hoveredNode === stage.id ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{stage.icon}</span>
                    <span className="text-xs font-bold">{stage.title}</span>
                  </div>
                  
                  <div className="text-[10px] text-gray-300 dark:text-gray-600 mb-3 space-y-1">
                    <p>Status: <span className="font-bold text-white dark:text-black">{stage.state}</span></p>
                    {stage.score != null && <p>Score: <span className="font-bold text-white dark:text-black">{stage.score}/100</span></p>}
                    {stage.label && <p>Result: <span className="font-bold text-white dark:text-black">{stage.label}</span></p>}
                  </div>

                  {stage.reportLink ? (
                    onNodeClick ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onNodeClick(stage); }} 
                        className="block w-full py-1.5 text-center text-[10px] font-bold bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 rounded-xl transition-colors"
                      >
                        View Report →
                      </button>
                    ) : (
                      <Link href={stage.reportLink} className="block w-full py-1.5 text-center text-[10px] font-bold bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 rounded-xl transition-colors">
                        View Report →
                      </Link>
                    )
                  ) : (
                    <div className="w-full py-1.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-white/5 dark:bg-black/5 rounded-xl">
                      No report available
                    </div>
                  )}

                  {/* Popover Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-white" />
                  
                  {/* Invisible Bridge to prevent hover gap dropoff */}
                  <div className="absolute top-full left-0 w-full h-4 bg-transparent" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Spacer to account for absolute titles below nodes */}
      <div className="h-10 mt-6 md:h-8 md:mt-4" />
    </div>
  );
}
