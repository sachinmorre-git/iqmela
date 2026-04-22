"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Save,
} from "lucide-react";
import {
  ensureInterviewPlanAction,
  updateInterviewPlanAction,
  type StageInput,
} from "./pipeline-actions";
import type { InterviewRoundType, InterviewMode } from "@prisma/client";

// ── Round type options ──────────────────────────────────────────────────────

const ROUND_TYPE_OPTIONS: { value: InterviewRoundType; label: string; icon: string }[] = [
  { value: "AI_SCREEN", label: "AI Screen", icon: "🤖" },
  { value: "TECHNICAL", label: "Technical", icon: "💻" },
  { value: "SYSTEM_DESIGN", label: "System Design", icon: "🏗️" },
  { value: "BEHAVIORAL", label: "Behavioral", icon: "🤝" },
  { value: "CULTURE_FIT", label: "Culture Fit", icon: "🎯" },
  { value: "HIRING_MANAGER", label: "Hiring Manager", icon: "👔" },
  { value: "PANEL", label: "Panel", icon: "👥" },
  { value: "CUSTOM", label: "Custom", icon: "✏️" },
];

interface ExistingStage {
  id: string;
  stageIndex: number;
  roundLabel: string;
  roundType: InterviewRoundType;
  durationMinutes: number;
  interviewMode: InterviewMode;
  isRequired: boolean;
  description: string | null;
}

interface InterviewPlanConfiguratorProps {
  positionId: string;
  existingStages: ExistingStage[];
  hasPlan: boolean;
}

export function InterviewPlanConfigurator({
  positionId,
  existingStages,
  hasPlan,
}: InterviewPlanConfiguratorProps) {
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [stages, setStages] = useState<StageInput[]>(
    existingStages.map((s) => ({
      id: s.id,
      stageIndex: s.stageIndex,
      roundLabel: s.roundLabel,
      roundType: s.roundType,
      durationMinutes: s.durationMinutes,
      interviewMode: s.interviewMode,
      isRequired: s.isRequired,
      description: s.description || undefined,
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Create default plan if none exists
  const handleCreateDefault = () => {
    startTransition(async () => {
      const res = await ensureInterviewPlanAction(positionId);
      if (!res.success) setError(res.error ?? "Failed");
      // Page revalidates and re-renders with the new plan
    });
  };

  const updateStage = (idx: number, updates: Partial<StageInput>) => {
    setStages((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...updates } : s))
    );
    setDirty(true);
    setSaved(false);
  };

  const addStage = () => {
    const nextIndex = stages.length;
    setStages((prev) => [
      ...prev,
      {
        stageIndex: nextIndex,
        roundLabel: `Round ${nextIndex}`,
        roundType: "CUSTOM" as InterviewRoundType,
        durationMinutes: 45,
        interviewMode: "HUMAN" as InterviewMode,
        isRequired: true,
      },
    ]);
    setDirty(true);
    setSaved(false);
  };

  const removeStage = (idx: number) => {
    setStages((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
    setSaved(false);
  };

  const moveStage = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;
    setStages((prev) => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateInterviewPlanAction(positionId, stages);
      if (res.success) {
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error ?? "Failed to save");
      }
    });
  };

  // No plan yet — show CTA
  if (!hasPlan && stages.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Interview Pipeline
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Define the interview rounds for this position
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateDefault}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Create Default Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Interview Pipeline</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-semibold">
            {stages.length} stage{stages.length !== 1 ? "s" : ""}
          </span>
          {dirty && (
            <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full font-bold">
              Unsaved
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Stage List */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-4">
          {error && (
            <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg border border-red-200 dark:border-red-800 mb-2">
              {error}
            </div>
          )}

          {stages.map((stage, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 group"
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveStage(idx, "up")}
                  disabled={idx === 0}
                  className="text-gray-300 hover:text-gray-500 disabled:opacity-20"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(idx, "down")}
                  disabled={idx === stages.length - 1}
                  className="text-gray-300 hover:text-gray-500 disabled:opacity-20"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Index badge */}
              <span className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                {idx}
              </span>

              {/* Label */}
              <input
                type="text"
                value={stage.roundLabel}
                onChange={(e) => updateStage(idx, { roundLabel: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-gray-900 dark:text-white px-2 py-1 rounded border border-transparent focus:border-teal-400 focus:outline-none transition"
                placeholder="Round label"
              />

              {/* Type */}
              <select
                value={stage.roundType}
                onChange={(e) => {
                  const val = e.target.value as InterviewRoundType;
                  const opt = ROUND_TYPE_OPTIONS.find(o => o.value === val);
                  updateStage(idx, {
                    roundType: val,
                    roundLabel: opt?.label ?? stage.roundLabel,
                    interviewMode: val === "AI_SCREEN" ? "AI_AVATAR" as InterviewMode : "HUMAN" as InterviewMode,
                  });
                }}
                className="text-[10px] bg-transparent border border-gray-200 dark:border-zinc-700 rounded-lg px-1.5 py-1 text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-teal-400"
              >
                {ROUND_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </select>

              {/* Duration */}
              <select
                value={stage.durationMinutes}
                onChange={(e) => updateStage(idx, { durationMinutes: parseInt(e.target.value) })}
                className="text-[10px] bg-transparent border border-gray-200 dark:border-zinc-700 rounded-lg px-1.5 py-1 text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-teal-400"
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>60m</option>
                <option value={90}>90m</option>
              </select>

              {/* Delete */}
              <button
                type="button"
                onClick={() => removeStage(idx)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Add + Save row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={addStage}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Stage
            </button>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-[10px] text-emerald-600 font-bold animate-in fade-in">✓ Saved</span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !dirty}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
