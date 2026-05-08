"use client";

import { useState, useTransition, useEffect } from "react";
import { Brain, Sparkles, Terminal, Loader2, Check, ChevronDown, Zap, Gauge, DollarSign, Building2, RotateCcw } from "lucide-react";
import { updateTaskModelChain, updateInterviewMode, updateExecutionBackend, listOrganizations, getOrgAiConfig, updateOrgTaskModelChain, resetOrgAiConfig } from "./actions";
import { AI_MODELS, AI_TASK_TYPES, AI_MODEL_IDS, DEFAULT_MODEL_CHAINS, type AiModelId, type ModelChain } from "@/lib/ai/models";

const INTERVIEW_MODES = [
  { value: "AI_AVATAR", label: "AI Avatar", desc: "Tavus-powered realistic video avatar", emoji: "👤" },
  { value: "AI_ORB", label: "AI Orb", desc: "Animated sphere with voice — lightweight", emoji: "🔮" },
];

const BACKENDS = [
  { value: "PISTON_PUBLIC", label: "Piston Public", desc: "Free community endpoint — rate limited", emoji: "🌍" },
  { value: "PISTON_SELF_HOSTED", label: "Piston Self-Hosted", desc: "Your own instance — no limits", emoji: "🏠" },
];

interface AiConfigData {
  defaultAiProvider: string;
  extractionProvider: string;
  rankingProvider: string;
  judgmentProvider: string;
  interviewScoreProvider: string;
  jdAnalysisProvider: string;
  codingGenProvider: string;
  defaultInterviewMode: string;
  codeExecutionBackend: string;
  pistonEndpoint: string | null;
  // New model chain fields
  extractionModels: ModelChain | null;
  rankingModels: ModelChain | null;
  judgmentModels: ModelChain | null;
  jdAnalysisModels: ModelChain | null;
  interviewScoreModels: ModelChain | null;
  codingGenModels: ModelChain | null;
  interviewPrepModels: ModelChain | null;
  redFlagModels: ModelChain | null;
  candidateSummaryModels: ModelChain | null;
}

// ── Model Selector Dropdown ──────────────────────────────────────────────────

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
      <span className={`text-[10px] font-black uppercase tracking-wider w-20 shrink-0 ${slotColors[slot]?.split(" ")[0] ?? "text-zinc-500"}`}>
        {slotLabels[slot]}
      </span>
      <div className="relative flex-1">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? (e.target.value as AiModelId) : null)}
          disabled={disabled}
          className={`w-full appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-medium transition-all border bg-zinc-900/60 outline-none focus:ring-1 focus:ring-indigo-500/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            value
              ? `${slotColors[slot]} text-white`
              : "border-zinc-700/40 text-zinc-500"
          }`}
        >
          {allowNone && <option value="">None</option>}
          {!allowNone && !value && <option value="">Select model…</option>}
          {AI_MODEL_IDS.map((id) => {
            const m = AI_MODELS[id];
            return (
              <option key={id} value={id}>
                {m.emoji} {m.label} — {m.cost} · {m.speed}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Cost/Speed Badge for selected model ──────────────────────────────────────

function ModelBadges({ modelId }: { modelId: AiModelId | null }) {
  if (!modelId) return null;
  const m = AI_MODELS[modelId];
  if (!m) return null;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <DollarSign className="w-2.5 h-2.5" />
        ${m.inputCostPer1M}/1M in · ${m.outputCostPer1M}/1M out
      </span>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Zap className="w-2.5 h-2.5" />
        {m.speed}
      </span>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <Gauge className="w-2.5 h-2.5" />
        {m.intelligence}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AiConfigClient({ config }: { config: AiConfigData }) {
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState(config.pistonEndpoint || "");
  const [localMode, setLocalMode] = useState(config.defaultInterviewMode);
  const [localBackend, setLocalBackend] = useState(config.codeExecutionBackend);

  // Build initial chain state from config (with defaults from models.ts)
  const { DEFAULT_MODEL_CHAINS } = require("@/lib/ai/models");
  const buildInitialChains = (): Record<string, ModelChain> => {
    const chains: Record<string, ModelChain> = {};
    for (const task of AI_TASK_TYPES) {
      const configValue = (config as any)[task.schemaField] as ModelChain | null;
      chains[task.key] = configValue ?? DEFAULT_MODEL_CHAINS[task.key] ?? { primary: "gemini-2.5-flash", fallback1: null, fallback2: null };
    }
    return chains;
  };
  const [chains, setChains] = useState<Record<string, ModelChain>>(buildInitialChains);

  const handleChainChange = (taskKey: string, slot: "primary" | "fallback1" | "fallback2", value: AiModelId | null) => {
    const updated = { ...chains[taskKey], [slot]: value } as ModelChain;
    if (!updated.primary) return; // Primary is required
    setChains((prev) => ({ ...prev, [taskKey]: updated }));

    startTransition(async () => {
      await updateTaskModelChain(taskKey, updated);
      setSavedKey(taskKey);
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  const handleModeChange = (mode: string) => {
    setLocalMode(mode);
    startTransition(async () => {
      await updateInterviewMode(mode);
      setSavedKey("mode");
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  const handleBackendChange = (backend: string) => {
    setLocalBackend(backend);
    startTransition(async () => {
      await updateExecutionBackend(backend, backend === "PISTON_SELF_HOSTED" ? endpoint : undefined);
      setSavedKey("backend");
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Section A: AI Model Routing Engine ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Model Routing Engine</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Configure primary + fallback models per task · Auto-failover when a model is unavailable</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {AI_TASK_TYPES.map((task) => {
            const chain = chains[task.key];
            return (
              <div
                key={task.key}
                className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 transition-all hover:border-indigo-500/30 relative"
              >
                {/* Saved indicator */}
                {savedKey === task.key && (
                  <div className="absolute top-3 right-3 animate-in fade-in zoom-in duration-200">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{task.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{task.label}</p>
                    <p className="text-[10px] text-zinc-500 leading-tight">{task.desc}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <ModelSelect
                    value={chain?.primary ?? null}
                    onChange={(v) => v && handleChainChange(task.key, "primary", v)}
                    slot={0}
                    disabled={isPending}
                  />
                  <ModelSelect
                    value={chain?.fallback1 ?? null}
                    onChange={(v) => handleChainChange(task.key, "fallback1", v)}
                    slot={1}
                    allowNone
                    disabled={isPending}
                  />
                  <ModelSelect
                    value={chain?.fallback2 ?? null}
                    onChange={(v) => handleChainChange(task.key, "fallback2", v)}
                    slot={2}
                    allowNone
                    disabled={isPending}
                  />
                </div>

                <ModelBadges modelId={chain?.primary ?? null} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section B: AI Interview Mode ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Interview Mode</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Choose the default interview experience for candidates</p>
            </div>
            {savedKey === "mode" && <Check className="w-4 h-4 text-green-500 ml-auto" />}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {INTERVIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleModeChange(mode.value)}
              disabled={isPending}
              className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${
                localMode === mode.value
                  ? "border-rose-500/40 bg-rose-500/[0.08] shadow-lg shadow-rose-500/10"
                  : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
              }`}
            >
              <span className="text-4xl">{mode.emoji}</span>
              <div>
                <p className={`text-base font-bold ${
                  localMode === mode.value ? "text-rose-300" : "text-white"
                }`}>
                  {mode.label}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{mode.desc}</p>
              </div>
              {localMode === mode.value && (
                <div className="ml-auto w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section C: Code Execution Backend ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Code Execution Backend</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Engine for running coding assessment submissions</p>
            </div>
            {savedKey === "backend" && <Check className="w-4 h-4 text-green-500 ml-auto" />}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BACKENDS.map((b) => (
              <button
                key={b.value}
                onClick={() => handleBackendChange(b.value)}
                disabled={isPending}
                className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${
                  localBackend === b.value
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
                }`}
              >
                <span className="text-3xl">{b.emoji}</span>
                <div>
                  <p className={`text-base font-bold ${
                    localBackend === b.value ? "text-emerald-300" : "text-white"
                  }`}>
                    {b.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{b.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {localBackend === "PISTON_SELF_HOSTED" && (
            <div className="flex items-center gap-3">
              <input
                type="url"
                placeholder="https://your-piston-instance.com"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={() => handleBackendChange("PISTON_SELF_HOSTED")}
                disabled={isPending || !endpoint}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save URL"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section D: Per-Organization Overrides ── */}
      <OrgOverrideSection />
    </div>
  );
}

// ── Org Override Section (Admin-Only) ────────────────────────────────────────

function OrgOverrideSection() {
  const [isPending, startTransition] = useTransition();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgChains, setOrgChains] = useState<Record<string, ModelChain> | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load org list on mount
  useEffect(() => {
    listOrganizations().then((list) => {
      setOrgs(list);
      setLoaded(true);
    });
  }, []);

  // Load org config when selected
  const handleOrgSelect = (orgId: string) => {
    setSelectedOrgId(orgId);
    setOrgChains(null);
    if (!orgId) return;

    startTransition(async () => {
      const config = await getOrgAiConfig(orgId);
      if (config) {
        const chains: Record<string, ModelChain> = {};
        for (const task of AI_TASK_TYPES) {
          const val = (config as any)[task.schemaField];
          chains[task.key] = val ?? DEFAULT_MODEL_CHAINS[task.key];
        }
        setOrgChains(chains);
      } else {
        // No overrides — show defaults as starting point
        const chains: Record<string, ModelChain> = {};
        for (const task of AI_TASK_TYPES) {
          chains[task.key] = DEFAULT_MODEL_CHAINS[task.key];
        }
        setOrgChains(chains);
      }
    });
  };

  const handleOrgChainChange = (taskKey: string, slot: "primary" | "fallback1" | "fallback2", value: AiModelId | null) => {
    if (!selectedOrgId || !orgChains) return;
    const updated = { ...orgChains[taskKey], [slot]: value } as ModelChain;
    if (!updated.primary) return;
    setOrgChains((prev) => prev ? { ...prev, [taskKey]: updated } : null);

    startTransition(async () => {
      await updateOrgTaskModelChain(selectedOrgId, taskKey, updated);
      setSavedKey(taskKey);
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  const handleReset = () => {
    if (!selectedOrgId) return;
    startTransition(async () => {
      await resetOrgAiConfig(selectedOrgId);
      // Reset to defaults
      const chains: Record<string, ModelChain> = {};
      for (const task of AI_TASK_TYPES) {
        chains[task.key] = DEFAULT_MODEL_CHAINS[task.key];
      }
      setOrgChains(chains);
      setSavedKey("reset");
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Organization Overrides</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Override AI models for a specific client organization · Internal admin only</p>
          </div>
          {savedKey === "reset" && (
            <span className="text-xs text-green-400 font-medium animate-in fade-in">Reset to defaults ✓</span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Org Selector */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <select
              value={selectedOrgId}
              onChange={(e) => handleOrgSelect(e.target.value)}
              disabled={!loaded}
              className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl border border-zinc-700 bg-zinc-800/60 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer disabled:opacity-40"
            >
              <option value="">Select an organization…</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>

          {selectedOrgId && (
            <button
              onClick={handleReset}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800/40 text-xs font-bold text-zinc-400 hover:text-white hover:border-amber-500/30 transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
          )}
        </div>

        {/* Org Task Cards */}
        {selectedOrgId && orgChains && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {AI_TASK_TYPES.map((task) => {
              const chain = orgChains[task.key];
              return (
                <div
                  key={task.key}
                  className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 transition-all hover:border-amber-500/30 relative"
                >
                  {savedKey === task.key && (
                    <div className="absolute top-3 right-3 animate-in fade-in zoom-in duration-200">
                      <Check className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{task.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{task.label}</p>
                      <p className="text-[10px] text-zinc-500 leading-tight">{task.desc}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <ModelSelect value={chain?.primary ?? null} onChange={(v) => v && handleOrgChainChange(task.key, "primary", v)} slot={0} disabled={isPending} />
                    <ModelSelect value={chain?.fallback1 ?? null} onChange={(v) => handleOrgChainChange(task.key, "fallback1", v)} slot={1} allowNone disabled={isPending} />
                    <ModelSelect value={chain?.fallback2 ?? null} onChange={(v) => handleOrgChainChange(task.key, "fallback2", v)} slot={2} allowNone disabled={isPending} />
                  </div>
                  <ModelBadges modelId={chain?.primary ?? null} />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!selectedOrgId && (
          <div className="text-center py-8 text-zinc-500 text-sm">
            Select an organization above to configure custom AI model overrides.
          </div>
        )}

        {selectedOrgId && !orgChains && isPending && (
          <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading configuration…</span>
          </div>
        )}
      </div>
    </div>
  );
}
