"use client";

import { useState, useTransition } from "react";
import { Brain, Check, ChevronDown, RotateCcw, Zap, Gauge, DollarSign, ToggleLeft, ToggleRight } from "lucide-react";
import { updateOrgTaskModelChain, resetOrgAiConfig } from "./ai-config-actions";
import { AI_MODELS, AI_TASK_TYPES, AI_MODEL_IDS, DEFAULT_MODEL_CHAINS, type AiModelId, type ModelChain } from "@/lib/ai/models";

// ── Model Selector ───────────────────────────────────────────────────────────

function ModelSelect({
  value,
  onChange,
  slot,
  allowNone = false,
  disabled = false,
}: {
  value: AiModelId | null;
  onChange: (v: AiModelId | null) => void;
  slot: number;
  allowNone?: boolean;
  disabled?: boolean;
}) {
  const slotLabels = ["① Primary", "② Fallback 1", "③ Fallback 2"];
  const slotColors = [
    "text-emerald-400 border-emerald-500/30",
    "text-amber-400 border-amber-500/30",
    "text-zinc-400 border-zinc-600/30",
  ];

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-black uppercase tracking-wider w-20 shrink-0 ${slotColors[slot]?.split(" ")[0]}`}>
        {slotLabels[slot]}
      </span>
      <div className="relative flex-1">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? (e.target.value as AiModelId) : null)}
          disabled={disabled}
          className={`w-full appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-medium transition-all border bg-zinc-900/60 outline-none focus:ring-1 focus:ring-rose-500/40 cursor-pointer disabled:opacity-40 ${
            value ? `${slotColors[slot]} text-white` : "border-zinc-700/40 text-zinc-500"
          }`}
        >
          {allowNone && <option value="">None</option>}
          {!allowNone && !value && <option value="">Select model…</option>}
          {AI_MODEL_IDS.map((id) => {
            const m = AI_MODELS[id];
            return <option key={id} value={id}>{m.emoji} {m.label} — {m.cost} · {m.speed}</option>;
          })}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

function ModelBadges({ modelId }: { modelId: AiModelId | null }) {
  if (!modelId) return null;
  const m = AI_MODELS[modelId];
  if (!m) return null;
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <DollarSign className="w-2.5 h-2.5" />${m.inputCostPer1M}/1M in · ${m.outputCostPer1M}/1M out
      </span>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Zap className="w-2.5 h-2.5" />{m.speed}
      </span>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <Gauge className="w-2.5 h-2.5" />{m.intelligence}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface OrgAiConfigProps {
  /** Existing org overrides (null = using platform defaults) */
  orgConfig: Record<string, any> | null;
  /** Global platform defaults for display comparison */
  globalChains: Record<string, ModelChain>;
}

export function OrgAiConfigPanel({ orgConfig, globalChains }: OrgAiConfigProps) {
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [customEnabled, setCustomEnabled] = useState(!!orgConfig);

  // Build chains: org override → global → hardcoded default
  const buildChains = (): Record<string, ModelChain> => {
    const result: Record<string, ModelChain> = {};
    for (const task of AI_TASK_TYPES) {
      if (orgConfig && orgConfig[task.schemaField]) {
        result[task.key] = orgConfig[task.schemaField] as ModelChain;
      } else {
        result[task.key] = globalChains[task.key] ?? DEFAULT_MODEL_CHAINS[task.key];
      }
    }
    return result;
  };
  const [chains, setChains] = useState<Record<string, ModelChain>>(buildChains);

  const handleToggle = () => {
    if (customEnabled) {
      // Reset to platform defaults
      startTransition(async () => {
        await resetOrgAiConfig();
        setCustomEnabled(false);
        // Restore chains to global defaults
        const restored: Record<string, ModelChain> = {};
        for (const task of AI_TASK_TYPES) {
          restored[task.key] = globalChains[task.key] ?? DEFAULT_MODEL_CHAINS[task.key];
        }
        setChains(restored);
        setSavedKey("reset");
        setTimeout(() => setSavedKey(null), 1500);
      });
    } else {
      setCustomEnabled(true);
    }
  };

  const handleChainChange = (taskKey: string, slot: "primary" | "fallback1" | "fallback2", value: AiModelId | null) => {
    const updated = { ...chains[taskKey], [slot]: value } as ModelChain;
    if (!updated.primary) return;
    setChains((prev) => ({ ...prev, [taskKey]: updated }));

    startTransition(async () => {
      await updateOrgTaskModelChain(taskKey, updated);
      setSavedKey(taskKey);
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  return (
    <div className="bg-white/[0.02] dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Model Configuration</h3>
            <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
              {customEnabled ? "Custom models active — overriding platform defaults" : "Using platform defaults"}
            </p>
          </div>
          {savedKey === "reset" && <Check className="w-4 h-4 text-green-500 ml-2 animate-in fade-in" />}
        </div>

        <button
          onClick={handleToggle}
          disabled={isPending}
          className="flex items-center gap-2 text-xs font-bold transition-colors disabled:opacity-40"
        >
          {customEnabled ? (
            <>
              <ToggleRight className="w-6 h-6 text-indigo-500" />
              <span className="text-indigo-400">Custom</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-6 h-6 text-zinc-500" />
              <span className="text-zinc-500">Platform Defaults</span>
            </>
          )}
        </button>
      </div>

      {/* Task Cards */}
      {customEnabled && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-5">
          {AI_TASK_TYPES.map((task) => {
            const chain = chains[task.key];
            const isOverridden = orgConfig?.[task.schemaField] != null;
            return (
              <div
                key={task.key}
                className={`bg-zinc-800/30 dark:bg-zinc-800/40 border rounded-xl p-3.5 transition-all hover:border-indigo-500/30 relative ${
                  isOverridden ? "border-indigo-500/20" : "border-zinc-700/50"
                }`}
              >
                {savedKey === task.key && (
                  <div className="absolute top-2.5 right-2.5 animate-in fade-in zoom-in">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{task.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{task.label}</p>
                    <p className="text-[9px] text-zinc-500 leading-tight">{task.desc}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <ModelSelect value={chain?.primary ?? null} onChange={(v) => v && handleChainChange(task.key, "primary", v)} slot={0} disabled={isPending} />
                  <ModelSelect value={chain?.fallback1 ?? null} onChange={(v) => handleChainChange(task.key, "fallback1", v)} slot={1} allowNone disabled={isPending} />
                  <ModelSelect value={chain?.fallback2 ?? null} onChange={(v) => handleChainChange(task.key, "fallback2", v)} slot={2} allowNone disabled={isPending} />
                </div>

                <ModelBadges modelId={chain?.primary ?? null} />
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsed state info */}
      {!customEnabled && (
        <div className="p-5">
          <div className="flex items-center gap-3 text-zinc-500 text-xs">
            <RotateCcw className="w-4 h-4" />
            <span>All AI tasks use the global platform configuration. Toggle <strong className="text-white">Custom</strong> to override models for this organization only.</span>
          </div>
        </div>
      )}
    </div>
  );
}
