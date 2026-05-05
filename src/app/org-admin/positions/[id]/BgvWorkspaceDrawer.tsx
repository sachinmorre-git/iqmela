"use client";

import { X, Shield } from "lucide-react";
import { BgvDrawerView } from "./BgvDrawerView";

interface BgvWorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resumeId: string;
  positionId: string;
  candidateName: string;
  totalStages: number;
}

export function BgvWorkspaceDrawer({
  isOpen,
  onClose,
  resumeId,
  positionId,
  candidateName,
  totalStages,
}: BgvWorkspaceDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              Background Verification
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Candidate: {candidateName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 
          We pass stageIndex=99 to uniquely identify this standalone BGV check.
          BgvDrawerView handles its own scrolling internal div.
        */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <BgvDrawerView
            resumeId={resumeId}
            positionId={positionId}
            candidateName={candidateName}
            stageIndex={99}
            totalStages={totalStages}
            onClose={onClose}
          />
        </div>
      </div>
    </>
  );
}
