"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Settings2, Loader2, CheckCircle } from "lucide-react";
import { upsertPositionAiConfigAction, type AiInterviewConfigInput } from "./ai-interview-actions";

/**
 * Step 179 — AI Interview Config Panel
 * Collapsible panel on the Position detail page allowing Org Admin to set
 * AI interview configuration defaults for this position.
 */
export function AiInterviewConfigPanel({
  positionId,
  initial,
}: {
  positionId: string;
  initial?: {
    difficulty?: string;
    durationMinutes?: number;
    generationStrategy?: string;
    introQuestions?: number;
    technicalQuestions?: number;
    behavioralQuestions?: number;
    avatarProvider: string | null;
    visualMode: string | null;
    voiceProvider: string | null;
    scoringProvider: string | null;
    followUpEnabled?: boolean;
    cameraRequired?: boolean;
    retriesAllowed?: boolean;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AiInterviewConfigInput>({
    difficulty: (initial?.difficulty as any) ?? "MEDIUM",
    durationMinutes: initial?.durationMinutes ?? 30,
    generationStrategy: (initial?.generationStrategy as any) ?? "STANDARDIZED",
    introQuestions: initial?.introQuestions ?? 2,
    technicalQuestions: initial?.technicalQuestions ?? 4,
    behavioralQuestions: initial?.behavioralQuestions ?? 3,
    avatarProvider: initial?.avatarProvider ?? undefined,
    visualMode: initial?.visualMode ?? "orb",
    voiceProvider: initial?.voiceProvider ?? "browser",
    scoringProvider: initial?.scoringProvider ?? "gemini",
    followUpEnabled: initial?.followUpEnabled ?? false,
    cameraRequired: initial?.cameraRequired ?? false,
    retriesAllowed: initial?.retriesAllowed ?? false,
  });

  const set = (field: keyof AiInterviewConfigInput, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await upsertPositionAiConfigAction(positionId, form);
      if (res.success) setSaved(true);
      else setError(res.error ?? "Failed to save");
    });
  };

  return (
    <div className="border border-pink-100 dark:border-pink-900/40 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-pink-50/70 to-rose-50/50 dark:from-pink-900/10 dark:to-rose-900/10 hover:from-pink-50 dark:hover:from-pink-900/20 transition-all"
      >
        <div className="flex items-center gap-2.5">
          <Settings2 className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            AI Interview Configuration
          </span>
          {initial && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 rounded-full">
              Configured
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 py-5 bg-white dark:bg-zinc-900 border-t border-pink-100 dark:border-pink-900/30 space-y-5">
          {/* Grid of fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Difficulty */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Difficulty
              </label>
              <select
                value={form.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Generation Strategy */}
            <div className="flex flex-col gap-1 col-span-1 sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Generation Strategy
              </label>
              <select
                value={form.generationStrategy}
                onChange={(e) => set("generationStrategy", e.target.value)}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="STANDARDIZED">Standardized (0 cost, instant, requires Question Bank)</option>
                <option value="TAILORED">Tailored (dynamic per candidate, queued, uses AI tokens)</option>
              </select>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                {form.generationStrategy === "STANDARDIZED" 
                  ? "Every candidate gets the exact same questions from the Approved Question Bank." 
                  : "AI dynamically generates custom questions based on the intersection of the JD and the candidate's resume."}
              </p>
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Duration (min)
              </label>
              <input
                type="number"
                min={10}
                max={120}
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", parseInt(e.target.value))}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            {/* Intro questions */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Intro Q's
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={form.introQuestions}
                onChange={(e) => set("introQuestions", parseInt(e.target.value))}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            {/* Technical questions */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Technical Q's
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={form.technicalQuestions}
                onChange={(e) => set("technicalQuestions", parseInt(e.target.value))}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            {/* Behavioral questions */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Behavioral Q's
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={form.behavioralQuestions}
                onChange={(e) => set("behavioralQuestions", parseInt(e.target.value))}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            {/* AI Presence (Visual Mode) */}
            <div className="flex flex-col gap-2 col-span-1 sm:col-span-2 mt-2">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                AI Presence (Visuals)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Orb Option */}
                <div
                  onClick={() => set("visualMode", "orb")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    (form.visualMode === "orb" || !form.visualMode)
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-500/10"
                      : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-pink-300 dark:hover:border-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs">🔮</span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">Animated Orb</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight p-0.5">
                    Abstract, highly responsive, and zero cost. Works instantly everywhere without an API key.
                  </p>
                </div>

                {/* Video Avatar Option */}
                <div
                  onClick={() => set("visualMode", "tavus")} // defaults to tavus when switching
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    (form.visualMode && form.visualMode !== "orb")
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-500/10"
                      : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-pink-300 dark:hover:border-zinc-500"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <span className="text-white text-xs">🎥</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">Live Video Avatar</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight p-0.5 mb-2">
                      Real-time talking person. Requires provider API key configuration.
                    </p>
                  </div>
                  
                  {/* Select provider only if video mode is active */}
                  {(form.visualMode && form.visualMode !== "orb") && (
                    <div className="mt-2 pl-11" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400 block mb-1">
                        Select Provider
                      </label>
                      <select
                        value={form.visualMode}
                        onChange={(e) => set("visualMode", e.target.value)}
                        className="text-xs rounded-lg border border-pink-200 dark:border-pink-500/30 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none w-full"
                      >
                        <option value="tavus">Tavus (API Key Required)</option>
                        <option value="did">D-ID (API Key Required)</option>
                        <option value="simli">Simli (API Key Required)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Voice provider */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Voice (STT)
              </label>
              <select
                value={form.voiceProvider ?? "browser"}
                onChange={(e) => set("voiceProvider", e.target.value)}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="browser">Browser (Free)</option>
                <option value="mock">Mock (Testing)</option>
              </select>
            </div>

            {/* TTS provider — what voice the AI uses to speak questions */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                AI Voice (TTS)
              </label>
              <select
                defaultValue="browser"
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
                title="Set TTS_PROVIDER in .env to activate"
              >
                <option value="browser">Browser TTS (Free)</option>
                <option value="elevenlabs">ElevenLabs (Premium)</option>
              </select>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                Set <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">TTS_PROVIDER</code> in .env to override
              </p>
            </div>

            {/* Scoring provider */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Scoring
              </label>
              <select
                value={form.scoringProvider ?? "gemini"}
                onChange={(e) => set("scoringProvider", e.target.value)}
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="mock">Mock</option>
              </select>
            </div>

            {/* Step 229 — Max questions (cost gate) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Max Questions
              </label>
              <input
                type="number"
                min={3}
                max={20}
                value={(form.introQuestions ?? 2) + (form.technicalQuestions ?? 4) + (form.behavioralQuestions ?? 3)}
                readOnly
                className="text-sm rounded-xl border border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 px-3 py-2 cursor-not-allowed tabular-nums"
                title="Derived from intro + technical + behavioral counts above"
              />
            </div>

            {/* Step 229 — Score timing */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Score At
              </label>
              <select
                className="text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
                defaultValue="end"
              >
                <option value="end">End of interview</option>
                <option value="realtime">After each question</option>
              </select>
            </div>
          </div>

          {/* Toggle flags */}
          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.followUpEnabled}
                onChange={(e) => set("followUpEnabled", e.target.checked)}
                className="w-4 h-4 rounded accent-pink-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Enable dynamic follow-up questions
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.cameraRequired}
                onChange={(e) => set("cameraRequired", e.target.checked)}
                className="w-4 h-4 rounded accent-pink-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Require camera (proctoring)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.retriesAllowed}
                onChange={(e) => set("retriesAllowed", e.target.checked)}
                className="w-4 h-4 rounded accent-pink-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Allow candidates to retry answering once
              </span>
            </label>

            {/* Step 229 — Avatar disabled switch */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.avatarProvider === "none"}
                onChange={(e) => set("avatarProvider", e.target.checked ? "none" : "mock")}
                className="w-4 h-4 rounded accent-pink-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Disable avatar (text-only mode, saves cost)
              </span>
            </label>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-zinc-800">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Settings2 className="w-4 h-4" />
              )}
              {isPending ? "Saving…" : saved ? "Saved!" : "Save Configuration"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
