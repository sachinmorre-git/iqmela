"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Clock, Loader2, ChevronDown, ChevronUp, User, Mic } from "lucide-react";

interface Utterance {
  speaker:    string;
  text:       string;
  startMs:    number;
  endMs:      number;
  confidence?: number;
}

interface TranscriptData {
  interviewId: string;
  generatedAt: string;
  language:    string;
  utterances:  Utterance[];
}

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SpeakerBubble({ utt, isCandidate }: { utt: Utterance; isCandidate: boolean }) {
  return (
    <div className={`flex gap-3 ${isCandidate ? "flex-row" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
        isCandidate
          ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
          : "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300"
      }`}>
        {isCandidate ? <User className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isCandidate ? "" : "items-end flex flex-col"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${
            isCandidate ? "text-indigo-500" : "text-teal-500"
          }`}>
            {utt.speaker}
          </span>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600 font-mono">
            {formatMs(utt.startMs)}
          </span>
          {utt.confidence != null && (
            <span className={`text-[8px] font-semibold px-1 py-0.5 rounded-md ${
              utt.confidence >= 0.9
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : utt.confidence >= 0.7
                ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-500"
            }`}>
              {Math.round(utt.confidence * 100)}%
            </span>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
          isCandidate
            ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 rounded-tl-sm border border-indigo-100 dark:border-indigo-800/30"
            : "bg-teal-50 dark:bg-teal-900/20 text-teal-900 dark:text-teal-100 rounded-tr-sm border border-teal-100 dark:border-teal-800/30"
        }`}>
          {utt.text}
        </div>
      </div>
    </div>
  );
}

export function TranscriptViewer({
  interviewId,
  roundLabel,
  hasRecording,
}: {
  interviewId:  string;
  roundLabel?:  string;
  hasRecording?: boolean;
}) {
  const [data,    setData]    = useState<TranscriptData | null>(null);
  const [status,  setStatus]  = useState<"idle" | "loading" | "pending" | "loaded" | "error">("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [isOpen,  setIsOpen]  = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const res  = await fetch(`/api/transcripts/${interviewId}`);
      const json = await res.json();

      if (res.status === 202) {
        setStatus("pending");
        // Poll every 30 seconds until transcript is ready
        pollingRef.current = setTimeout(() => load(true), 30_000);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to load transcript");

      setData(json);
      setStatus("loaded");
      setIsOpen(true);
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  useEffect(() => {
    return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, []);

  const filtered = data?.utterances.filter((u) =>
    !search || u.text.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const candidateWordCount   = data?.utterances.filter(u => u.speaker === "Candidate")
    .reduce((s, u) => s + u.text.split(/\s+/).length, 0) ?? 0;
  const interviewerWordCount = data?.utterances.filter(u => u.speaker === "Interviewer")
    .reduce((s, u) => s + u.text.split(/\s+/).length, 0) ?? 0;
  const totalWords = candidateWordCount + interviewerWordCount;
  const candidatePct = totalWords > 0 ? Math.round((candidateWordCount / totalWords) * 100) : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-blue-100 dark:border-blue-800/30">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Interview Transcript</p>
            {roundLabel && <p className="text-[10px] text-gray-400 dark:text-zinc-500">{roundLabel} · AI Diarized</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "loaded" && (
            <button
              onClick={() => setIsOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors font-semibold"
            >
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isOpen ? "Collapse" : "Expand"}
            </button>
          )}
          {status === "idle" && (
            <button
              onClick={() => load()}
              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              Load Transcript
            </button>
          )}
        </div>
      </div>

      <div className="p-5">

        {/* IDLE */}
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center justify-center">
              <FileText className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
              {hasRecording
                ? "Diarized transcript available. Click \"Load Transcript\" to view."
                : "No recording found. Transcript will be generated after the interview recording is processed."}
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Powered by AssemblyAI · Speaker-labeled · Confidence scored
            </p>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 animate-pulse">
              Fetching transcript…
            </p>
          </div>
        )}

        {/* PENDING — still being processed */}
        {status === "pending" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="relative">
              <Clock className="w-10 h-10 text-amber-400" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
            </div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
              Transcript Processing…
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs">
              AssemblyAI is generating a diarized transcript from the recording. This typically takes 2–5 minutes. The page will auto-refresh.
            </p>
            <div className="w-full max-w-xs bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mt-2">
              <div className="h-full bg-amber-400 rounded-full animate-[pulse_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <p className="text-sm font-semibold text-red-500">{error}</p>
            <button onClick={() => load()} className="text-xs text-blue-600 hover:underline">
              Try Again
            </button>
          </div>
        )}

        {/* LOADED */}
        {status === "loaded" && data && isOpen && (
          <div className="space-y-4">
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Turns</p>
                <p className="text-sm font-black text-gray-800 dark:text-white">{data.utterances.length}</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Language</p>
                <p className="text-sm font-black text-gray-800 dark:text-white uppercase">{data.language ?? "—"}</p>
              </div>
              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-zinc-500">Generated</p>
                <p className="text-sm font-black text-gray-800 dark:text-white">
                  {new Date(data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>

            {/* Talk-time ratio bar */}
            {totalWords > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide">Candidate talk time</span>
                  <span className="text-[9px] font-bold text-teal-500 uppercase tracking-wide">Interviewer talk time</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-indigo-400 dark:bg-indigo-600 rounded-l-full transition-all" style={{ width: `${candidatePct}%` }} />
                  <div className="bg-teal-400 dark:bg-teal-600 rounded-r-full transition-all flex-1" />
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500">{candidatePct}% · {candidateWordCount} words</span>
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500">{100 - candidatePct}% · {interviewerWordCount} words</span>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transcript…"
                className="w-full bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/60 rounded-xl px-4 py-2 text-xs text-gray-700 dark:text-zinc-300 placeholder:text-gray-400 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
              />
              {search && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-semibold">
                  {filtered.length} results
                </span>
              )}
            </div>

            {/* Transcript bubbles */}
            <div
              className="space-y-3 overflow-y-auto pr-1"
              style={{ maxHeight: "420px" }}
            >
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">No matches found.</p>
              ) : (
                filtered.map((utt, i) => (
                  <SpeakerBubble
                    key={i}
                    utt={utt}
                    isCandidate={utt.speaker === "Candidate"}
                  />
                ))
              )}
            </div>

            {/* Collapse toggle */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors font-semibold py-1"
            >
              Collapse transcript
            </button>
          </div>
        )}

        {/* LOADED but collapsed — summary only */}
        {status === "loaded" && data && !isOpen && (
          <div
            className="flex items-center justify-between px-2 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setIsOpen(true)}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300">
                {data.utterances.length} turns · {totalWords} words
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
}
