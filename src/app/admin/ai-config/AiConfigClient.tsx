"use client";

import { useState, useTransition } from "react";
import { Brain, Sparkles, Monitor, Terminal, Loader2, Check } from "lucide-react";
import { updateAiProvider, updateInterviewMode, updateExecutionBackend } from "./actions";

const AI_PROVIDERS = [
  { value: "GEMINI", label: "Google Gemini", emoji: "🔵", desc: "Gemini 2.0 Flash — fast, cost-effective" },
  { value: "DEEPSEEK", label: "DeepSeek", emoji: "🟣", desc: "DeepSeek V3 — deep reasoning, low cost" },
  { value: "OPENAI", label: "OpenAI", emoji: "🟢", desc: "GPT-4o — premium quality, higher cost" },
  { value: "ANTHROPIC", label: "Anthropic", emoji: "🟠", desc: "Claude 4 — nuanced analysis" },
];

const TASK_TYPES = [
  { key: "extractionProvider", label: "Resume Extraction", desc: "Parse PDF/DOCX → structured candidate data", icon: "📄" },
  { key: "rankingProvider", label: "Candidate Ranking", desc: "Score candidates against JD requirements", icon: "📊" },
  { key: "judgmentProvider", label: "Advanced Judgment", desc: "Deep analysis, skill assessment, culture fit", icon: "🧠" },
  { key: "jdAnalysisProvider", label: "JD Analysis", desc: "Parse job descriptions, extract requirements", icon: "📋" },
  { key: "interviewScoreProvider", label: "Interview Scoring", desc: "Score AI interview answers", icon: "🎯" },
  { key: "codingGenProvider", label: "Coding Questions", desc: "Generate coding challenges and test cases", icon: "💻" },
];

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
}

export function AiConfigClient({ config }: { config: AiConfigData }) {
  const [localConfig, setLocalConfig] = useState(config);
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState(config.pistonEndpoint || "");

  const handleProviderChange = (key: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      await updateAiProvider({ [key]: value } as any);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  const handleModeChange = (mode: string) => {
    setLocalConfig((prev) => ({ ...prev, defaultInterviewMode: mode }));
    startTransition(async () => {
      await updateInterviewMode(mode);
      setSavedKey("mode");
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  const handleBackendChange = (backend: string) => {
    setLocalConfig((prev) => ({ ...prev, codeExecutionBackend: backend }));
    startTransition(async () => {
      await updateExecutionBackend(backend, backend === "PISTON_SELF_HOSTED" ? endpoint : undefined);
      setSavedKey("backend");
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Section A: AI Provider Selection ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Provider per Task Type</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Choose which AI model handles each pipeline stage</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {TASK_TYPES.map((task) => {
            const currentProvider = (localConfig as any)[task.key] as string;
            return (
              <div
                key={task.key}
                className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 transition-all hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{task.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{task.label}</p>
                    <p className="text-[10px] text-zinc-500">{task.desc}</p>
                  </div>
                  {savedKey === task.key && (
                    <Check className="w-4 h-4 text-green-500 ml-auto animate-in fade-in" />
                  )}
                </div>

                <div className="space-y-1.5">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => handleProviderChange(task.key, p.value)}
                      disabled={isPending}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        currentProvider === p.value
                          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                          : "border-transparent bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                      }`}
                    >
                      <span className="text-sm">{p.emoji}</span>
                      <span className="flex-1 text-left">{p.label}</span>
                      {currentProvider === p.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
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
                localConfig.defaultInterviewMode === mode.value
                  ? "border-rose-500/40 bg-rose-500/[0.08] shadow-lg shadow-rose-500/10"
                  : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
              }`}
            >
              <span className="text-4xl">{mode.emoji}</span>
              <div>
                <p className={`text-base font-bold ${
                  localConfig.defaultInterviewMode === mode.value ? "text-rose-300" : "text-white"
                }`}>
                  {mode.label}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{mode.desc}</p>
              </div>
              {localConfig.defaultInterviewMode === mode.value && (
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
                  localConfig.codeExecutionBackend === b.value
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
                }`}
              >
                <span className="text-3xl">{b.emoji}</span>
                <div>
                  <p className={`text-base font-bold ${
                    localConfig.codeExecutionBackend === b.value ? "text-emerald-300" : "text-white"
                  }`}>
                    {b.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{b.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {localConfig.codeExecutionBackend === "PISTON_SELF_HOSTED" && (
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
    </div>
  );
}
