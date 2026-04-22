"use client";

import { useState, useEffect } from "react";
import { Play, Clock, HardDrive, Calendar, ShieldCheck, Loader2, VideoOff } from "lucide-react";

interface RecordingData {
  url: string;
  expiresAt: string;
  durationSecs: number | null;
  sizeBytes: number | null;
  recordingExpiresAt: string | null;
  consentGiven: boolean;
}

function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function RecordingPlayer({ interviewId, roundLabel }: { interviewId: string; roundLabel?: string }) {
  const [recording, setRecording] = useState<RecordingData | null>(null);
  const [status, setStatus]       = useState<"idle" | "loading" | "loaded" | "unavailable" | "error">("idle");
  const [error, setError]         = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadRecording = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${interviewId}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) { setStatus("unavailable"); return; }
        if (res.status === 410) { setStatus("unavailable"); setError("Recording has expired and been deleted"); return; }
        throw new Error(data.error ?? "Failed to load recording");
      }
      setRecording(data);
      setStatus("loaded");
    } catch (err: any) {
      setError(err.message);
      setStatus("error");
    }
  };

  const expiresDate = recording?.recordingExpiresAt
    ? new Date(recording.recordingExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const daysLeft = recording?.recordingExpiresAt
    ? Math.max(0, Math.ceil((new Date(recording.recordingExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center border border-violet-100 dark:border-violet-800/30">
            <Play className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Interview Recording</p>
            {roundLabel && <p className="text-[10px] text-gray-400 dark:text-zinc-500">{roundLabel}</p>}
          </div>
        </div>
        {status === "idle" && (
          <button
            onClick={loadRecording}
            className="px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-bold border border-violet-200 dark:border-violet-800/40 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
          >
            Load Recording
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* IDLE */}
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30 flex items-center justify-center">
              <Play className="w-7 h-7 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">Click "Load Recording" to securely stream this session</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Access is role-gated. URL expires after 1 hour.</p>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 animate-pulse">Generating secure stream URL…</p>
          </div>
        )}

        {/* UNAVAILABLE */}
        {status === "unavailable" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-zinc-800 flex items-center justify-center border border-gray-100 dark:border-zinc-700">
              <VideoOff className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">
              {error ?? "No recording available for this interview"}
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Recording may not have been started, or was never activated for this session.</p>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <p className="text-sm font-semibold text-red-500">{error}</p>
            <button onClick={loadRecording} className="text-xs text-violet-600 hover:underline">Try Again</button>
          </div>
        )}

        {/* LOADED */}
        {status === "loaded" && recording && (
          <div className="space-y-4">
            {/* Video player */}
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-xl aspect-video">
              <video
                src={recording.url}
                controls
                preload="metadata"
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>

            {/* Metadata strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recording.durationSecs != null && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Duration</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-white">{formatDuration(recording.durationSecs)}</p>
                  </div>
                </div>
              )}
              {recording.sizeBytes != null && (
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">File Size</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-white">{formatBytes(recording.sizeBytes)}</p>
                  </div>
                </div>
              )}
              {expiresDate && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${daysLeft !== null && daysLeft <= 14 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-gray-50 dark:bg-zinc-800/60"}`}>
                  <Calendar className={`w-3.5 h-3.5 shrink-0 ${daysLeft !== null && daysLeft <= 14 ? "text-amber-400" : "text-gray-400 dark:text-zinc-500"}`} />
                  <div>
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Expires</p>
                    <p className={`text-xs font-bold ${daysLeft !== null && daysLeft <= 14 ? "text-amber-600 dark:text-amber-400" : "text-gray-800 dark:text-white"}`}>
                      {expiresDate}{daysLeft !== null && daysLeft <= 14 ? ` (${daysLeft}d)` : ""}
                    </p>
                  </div>
                </div>
              )}
              {recording.consentGiven && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[9px] text-emerald-500 uppercase tracking-wide">Consent</p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Given ✓</p>
                  </div>
                </div>
              )}
            </div>

            {/* URL expiry notice */}
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-center">
              This stream URL is valid for 1 hour. Refresh if playback fails.{" "}
              <button onClick={loadRecording} className="text-violet-500 hover:underline font-medium">Refresh URL</button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
