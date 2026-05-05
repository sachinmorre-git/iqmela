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
  X,
} from "lucide-react";
import {
  ensureInterviewPlanAction,
  updateInterviewPlanAction,
  type StageInput,
} from "./pipeline-actions";
import type { InterviewRoundType, InterviewMode } from "@prisma/client";
import { PanelSelectionDialog, type Panelist } from "./PanelSelectionDialog";

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
  assignedPanelJson?: any;
}

interface InterviewPlanConfiguratorProps {
  positionId?: string; // Optional: If missing, implies controlled mode where we don't save to DB directly
  existingStages: StageInput[];
  hasPlan?: boolean; // Only relevant for DB-saving mode
  onChange?: (stages: StageInput[]) => void; // Called in controlled mode
}

export function InterviewPlanConfigurator({
  positionId,
  existingStages,
  hasPlan,
  onChange,
}: InterviewPlanConfiguratorProps) {
  const isControlled = typeof onChange === "function";
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);

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
      assignedPanelJson: s.assignedPanelJson,
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  const [activePanelStageIndex, setActivePanelStageIndex] = useState<number | null>(null);

  const notifyChange = (newStages: StageInput[]) => {
    if (isControlled && onChange) {
      onChange(newStages);
    }
  };

  // Create default plan if none exists
  const handleCreateDefault = () => {
    if (isControlled) {
      const defaultStages: StageInput[] = [
        { roundLabel: "AI Screen", roundType: "AI_SCREEN", durationMinutes: 30, interviewMode: "AI_AVATAR", isRequired: true, description: undefined, assignedPanelJson: null },
        { roundLabel: "Panel Round 1", roundType: "PANEL", durationMinutes: 45, interviewMode: "HUMAN", isRequired: true, description: undefined, assignedPanelJson: null },
        { roundLabel: "Panel Round 2", roundType: "PANEL", durationMinutes: 45, interviewMode: "HUMAN", isRequired: true, description: undefined, assignedPanelJson: null },
      ];
      setStages(defaultStages);
      setDirty(true);
      notifyChange(defaultStages);
      return;
    }
    
    if (!positionId) return;
    startTransition(async () => {
      const res = await ensureInterviewPlanAction(positionId);
      if (!res.success) setError(res.error ?? "Failed");
      // Page revalidates and re-renders with the new plan
    });
  };

  const updateStage = (idx: number, updates: Partial<StageInput>) => {
    const newStages = stages.map((s, i) => (i === idx ? { ...s, ...updates } : s));
    setStages(newStages);
    setDirty(true);
    setSaved(false);
    notifyChange(newStages);
  };

  const addStage = () => {
    const nextIndex = stages.length;
    const newStages: StageInput[] = [
      ...stages,
      {
        stageIndex: nextIndex,
        roundLabel: `Round ${nextIndex}`,
        roundType: "CUSTOM" as InterviewRoundType,
        durationMinutes: 45,
        interviewMode: "HUMAN" as InterviewMode,
        isRequired: true,
        assignedPanelJson: null,
      },
    ];
    setStages(newStages);
    setDirty(true);
    setSaved(false);
    notifyChange(newStages);
  };

  const removeStage = (idx: number) => {
    const newStages = stages.filter((_, i) => i !== idx);
    setStages(newStages);
    setDirty(true);
    setSaved(false);
    notifyChange(newStages);
  };

  const moveStage = (idx: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const copy = [...stages];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setStages(copy);
    setDirty(true);
    setSaved(false);
    notifyChange(copy);
  };

  const handleSave = () => {
    if (isControlled || !positionId) return;
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

  // No stages — show CTA to create default plan
  if (stages.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              Interview Pipeline
            </h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
              Define the interview rounds for this position
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleCreateDefault}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Create Default Plan
            </button>
            <button
              type="button"
              onClick={addStage}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors ${
          isControlled ? "px-5 py-3" : "px-5 py-4"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className={`text-pink-500 ${isControlled ? "w-4 h-4" : "w-5 h-5"}`} />
          <span className={`font-bold text-gray-900 dark:text-white ${isControlled ? "text-sm" : "text-base"}`}>
            Interview Pipeline
          </span>
          <span className={`text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded-full font-semibold ${
            isControlled ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          }`}>
            {stages.length} stage{stages.length !== 1 ? "s" : ""}
          </span>
          {dirty && (
            <span className={`text-amber-600 bg-amber-50 dark:bg-amber-900/30 rounded-full font-bold ${
              isControlled ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
            }`}>
              Unsaved
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className={`${isControlled ? "w-4 h-4" : "w-5 h-5"} text-gray-400`} />
        ) : (
          <ChevronDown className={`${isControlled ? "w-4 h-4" : "w-5 h-5"} text-gray-400`} />
        )}
      </button>

      {/* Stage List — clipped to neighbor height by default */}
      {isExpanded && (
        <div className="relative">
          <div
            className={`pb-4 space-y-2 border-t border-gray-100 dark:border-zinc-800 ${
              isControlled ? "pt-3 px-5" : "pt-4 px-5"
            }`}
          >
            {error && (
              <div className="p-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg border border-red-200 dark:border-red-800 mb-3">
                {error}
              </div>
            )}

            {stages.map((stage, idx) => (
              <div
                key={idx}
                className={`flex items-center bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 rounded-xl group ${
                  isControlled ? "gap-2 p-2.5" : "gap-3 p-3.5"
                }`}
              >
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveStage(idx, "up")}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20"
                  >
                    <ChevronUp className={`${isControlled ? "w-3 h-3" : "w-4 h-4"}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStage(idx, "down")}
                    disabled={idx === stages.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20"
                  >
                    <ChevronDown className={`${isControlled ? "w-3 h-3" : "w-4 h-4"}`} />
                  </button>
                </div>

                {/* Index badge */}
                <span className={`rounded-lg bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 flex items-center justify-center font-bold shrink-0 ${
                  isControlled ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
                }`}>
                  {idx}
                </span>

                {/* Label */}
                <input
                  type="text"
                  value={stage.roundLabel}
                  onChange={(e) => updateStage(idx, { roundLabel: e.target.value })}
                  className={`bg-transparent font-semibold text-gray-900 dark:text-white rounded border border-transparent focus:border-rose-400 focus:outline-none transition ${
                    isControlled ? "flex-1 min-w-[60px] text-xs px-2 py-1" : "flex-1 min-w-[150px] max-w-[200px] text-sm px-2.5 py-1.5"
                  }`}
                  placeholder="Round label"
                />

                {/* Panel Selection Space */}
                <div className={`flex justify-center items-center shrink-0 ${isControlled ? "px-1" : "flex-1 px-4"}`}>
                  {stage.roundType !== "AI_SCREEN" && (
                    <div className="flex items-center gap-2">
                      {stage.assignedPanelJson && Array.isArray(stage.assignedPanelJson) && stage.assignedPanelJson.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActivePanelStageIndex(idx)}
                            className="flex -space-x-2 hover:scale-105 transition-transform"
                            title="Edit Panel"
                          >
                            {stage.assignedPanelJson.slice(0, 3).map((p: any, i: number) => (
                              <div key={p.id} className={`${isControlled ? "w-6 h-6" : "w-8 h-8"} rounded-full border-2 border-white dark:border-zinc-800 bg-gray-100 flex items-center justify-center overflow-hidden z-10`} style={{ zIndex: 10 - i }}>
                                {p.avatarUrl ? (
                                  <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-500">{p.name.charAt(0)}</span>
                                )}
                              </div>
                            ))}
                            {stage.assignedPanelJson.length > 3 && (
                              <div className={`${isControlled ? "w-6 h-6 text-[9px]" : "w-8 h-8 text-[10px]"} rounded-full border-2 border-white dark:border-zinc-800 bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center z-0 font-bold text-indigo-600 dark:text-indigo-400`}>
                                +{stage.assignedPanelJson.length - 3}
                              </div>
                            )}
                          </button>
                          <button 
                            type="button"
                            onClick={() => updateStage(idx, { assignedPanelJson: null })}
                            className={`${isControlled ? "w-5 h-5" : "w-6 h-6"} rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
                            title="Clear Panel"
                          >
                            <X className={`${isControlled ? "w-2.5 h-2.5" : "w-3 h-3"}`} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActivePanelStageIndex(idx)}
                          className={`inline-flex items-center rounded border border-dashed border-gray-300 dark:border-zinc-700 font-semibold text-gray-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all ${
                            isControlled ? "gap-1 px-1.5 py-1 text-[10px]" : "gap-1.5 px-3 py-1.5 text-xs rounded-xl"
                          }`}
                        >
                          <Plus className={`${isControlled ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                          Assign
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                  className={`bg-transparent border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-rose-400 shrink-0 ${
                    isControlled ? "text-[10px] px-1.5 py-1 max-w-[90px]" : "text-sm px-2.5 py-1.5"
                  }`}
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
                  className={`bg-transparent border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-rose-400 shrink-0 ${
                    isControlled ? "text-[10px] px-1.5 py-1" : "text-sm px-2.5 py-1.5"
                  }`}
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
                  <Trash2 className={`${isControlled ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
                </button>
              </div>
            ))}

            {/* Add + Save row */}
            <div className={`flex items-center justify-between ${isControlled ? "pt-1" : "pt-3"}`}>
              <button
                type="button"
                onClick={addStage}
                className={`inline-flex items-center gap-1.5 font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 transition-colors ${
                  isControlled ? "text-xs" : "text-sm"
                }`}
              >
                <Plus className={`${isControlled ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
                Add Stage
              </button>

              {!isControlled && (
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="text-sm text-emerald-600 font-bold animate-in fade-in">✓ Saved</span>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending || !dirty}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Plan
                  </button>
                </div>
              )}
            </div>
          </div>


        </div>
      )}

      {/* Panel Selection Dialog */}
      {activePanelStageIndex !== null && (
        <PanelSelectionDialog
          isOpen={true}
          onClose={() => setActivePanelStageIndex(null)}
          roundLabel={stages[activePanelStageIndex].roundLabel}
          selectedPanelists={stages[activePanelStageIndex].assignedPanelJson || []}
          onSave={(panelists) => {
            updateStage(activePanelStageIndex, { assignedPanelJson: panelists });
          }}
        />
      )}
    </div>
  );
}
