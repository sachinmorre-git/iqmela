"use client";

import { useState, useEffect, useCallback } from "react";
import { InterviewPlanConfigurator } from "./InterviewPlanConfigurator";
import type { InterviewRoundType, InterviewMode } from "@prisma/client";
import { Sparkles } from "lucide-react";

interface ExistingStage {
  id: string;
  stageIndex: number;
  roundLabel: string;
  roundType: InterviewRoundType;
  durationMinutes: number;

  isRequired: boolean;
  description?: string | null;
}

interface EditPipelineButtonProps {
  positionId: string;
  existingStages: ExistingStage[];
  hasPlan: boolean;
  variant?: "small" | "header";
}

export function EditPipelineButton({
  positionId,
  existingStages,
  hasPlan,
  variant = "small",
}: EditPipelineButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* Trigger Button */}
      {variant === "header" ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl hover:-translate-y-0.5 transition-transform text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/60"
          title="Interview Pipeline"
        >
          <Sparkles className="w-4 h-4 mr-0.5" />
          Interview Pipeline
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
          title="Edit Interview Pipeline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          Edit
        </button>
      )}

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-[768px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Interview Pipeline
                  </h2>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                    Configure interview rounds for this position
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Body — Configurator */}
            <div className="max-h-[70vh] overflow-y-auto p-1">
              <InterviewPlanConfigurator
                positionId={positionId}
                existingStages={existingStages}
                hasPlan={hasPlan}
              />
            </div>
          </div>

          {/* Keyframe animations (injected inline) */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0 }
              to   { opacity: 1 }
            }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.95) translateY(8px) }
              to   { opacity: 1; transform: scale(1)    translateY(0)   }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
