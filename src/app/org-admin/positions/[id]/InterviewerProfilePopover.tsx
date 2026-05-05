"use client";

import { useState, useRef, useEffect } from "react";
import { Star, Briefcase, ExternalLink, ShieldCheck, X } from "lucide-react";
import type { MatchResult } from "@/lib/interviewer-match";

interface InterviewerProfilePopoverProps {
  match: MatchResult;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  isSelected: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function InterviewerProfilePopover({
  match,
  isOpen,
  onClose,
  onSelect,
  isSelected,
  anchorRef,
}: InterviewerProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { interviewer, matchScore, breakdown, matchedSkills } = match;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const displayLabel = interviewer.source === "MARKETPLACE" && (!interviewer.name || interviewer.name === interviewer.email)
    ? "Interview Expert"
    : interviewer.name || interviewer.email;
  const initials = displayLabel
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-0 z-50 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      style={{ transform: "translateX(calc(100% + 8px))" }}
    >
      {/* Header */}
      <div className="relative p-4 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400"
        >
          <X className="w-3 h-3" />
        </button>

        <div className="flex items-center gap-3">
          {/* Avatar */}
          {interviewer.avatarUrl ? (
            <img
              src={interviewer.avatarUrl}
              alt={interviewer.name || ""}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 dark:border-zinc-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {displayLabel}
              </p>
              {interviewer.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
            </div>
            {interviewer.title && (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{interviewer.title}</p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full ${
                interviewer.source === "INTERNAL"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  : "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
              }`}>
                {interviewer.source === "INTERNAL" ? "Internal" : "Marketplace"}
              </span>
              {interviewer.hourlyRate != null && (
                <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400">
                  ${interviewer.hourlyRate}/hr
                </span>
              )}
              {interviewer.source === "MARKETPLACE" && (
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 italic">
                  Contact via IQMela
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Match Score Badge */}
        <div className="mt-3 flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
            matchScore >= 85
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : matchScore >= 70
                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            {matchScore}% Match
          </div>
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                matchScore >= 85 ? "bg-emerald-500" : matchScore >= 70 ? "bg-amber-400" : "bg-gray-400"
              }`}
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Skills */}
      {matchedSkills.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">Matching Skills</p>
          <div className="flex flex-wrap gap-1">
            {matchedSkills.slice(0, 8).map((s) => (
              <span key={s} className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded border border-rose-100 dark:border-rose-800/40">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
            <Briefcase className="w-3 h-3" />
            Interviews
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{interviewer.totalInterviews}</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
            <Star className="w-3 h-3" />
            Avg Rating
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {interviewer.avgRating != null ? `${interviewer.avgRating.toFixed(1)}/5` : "N/A"}
          </p>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">Score Breakdown</p>
        <div className="space-y-1">
          {[
            { label: "Skills", value: breakdown.skillOverlap, max: 40 },
            { label: "Round Fit", value: breakdown.roundTypeFit, max: 25 },
            { label: "Experience", value: breakdown.experienceLevel, max: 15 },
            { label: "Track Record", value: breakdown.trackRecord, max: 10 },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-16 shrink-0">{b.label}</span>
              <div className="flex-1 h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(b.value / b.max) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{b.value}/{b.max}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            onSelect(interviewer.userId);
            onClose();
          }}
          className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
            isSelected
              ? "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
              : "bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
          }`}
        >
          {isSelected ? "✓ Selected" : "Select Interviewer"}
        </button>
      </div>
    </div>
  );
}
