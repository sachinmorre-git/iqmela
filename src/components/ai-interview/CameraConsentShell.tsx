"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, CameraOff, CheckCircle, X } from "lucide-react";

/**
 * Step 226 — Camera Snapshot Consent Shell
 *
 * Shown inside the AI Interview pre-check page (or in-session) when the
 * position config sets cameraRequired = true.
 *
 * Behaviour:
 * - Prompts the candidate for explicit consent before touching the camera.
 * - If consented, starts a preview stream and can take optional snapshots.
 * - Does NOT persist/upload images unless `onSnapshot` callback is wired up.
 * - Gracefully degrades: if camera is unavailable, shows a warning and continues.
 */

interface Props {
  /** Called when user grants or revokes consent. */
  onConsentChange?: (granted: boolean) => void;
  /** Called with base64 JPEG when a snapshot is taken. Does nothing if omitted. */
  onSnapshot?: (dataUrl: string) => void;
  /** Whether to show the snapshot button (for proctoring). Defaults to false. */
  allowSnapshot?: boolean;
}

export function CameraConsentShell({
  onConsentChange,
  onSnapshot,
  allowSnapshot = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<
    "prompt" | "starting" | "active" | "denied" | "unavailable" | "declined"
  >("prompt");
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCamera = useCallback(async () => {
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setState("active");
      onConsentChange?.(true);
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setState("denied");
      } else {
        setState("unavailable");
      }
      onConsentChange?.(false);
    }
  }, [onConsentChange]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("prompt");
    onConsentChange?.(false);
  }, [onConsentChange]);

  const takeSnapshot = useCallback(() => {
    if (!videoRef.current || !onSnapshot) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onSnapshot(dataUrl);
    setSnapshotTaken(true);
    setTimeout(() => setSnapshotTaken(false), 2000);
  }, [onSnapshot]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state === "prompt" || state === "declined") {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 backdrop-blur p-6 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
          <Camera className="w-7 h-7 text-zinc-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-base mb-1">Camera Access</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            This interview session optionally monitors for a fair environment.
            Your camera feed is <strong className="text-white">not recorded or stored</strong>{" "}
            unless explicitly configured by the hiring team.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={startCamera}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all"
          >
            <Camera className="w-4 h-4" />
            Allow Camera
          </button>
          <button
            onClick={() => setState("declined")}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl transition-all border border-zinc-700"
          >
            Skip
          </button>
        </div>
        {state === "declined" && (
          <p className="text-xs text-zinc-500 italic">
            Camera skipped. You can continue without it.
          </p>
        )}
      </div>
    );
  }

  if (state === "starting") {
    return (
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-6 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-sm">Starting camera…</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-2xl border border-red-800/40 bg-red-950/20 p-5 flex items-start gap-3 max-w-sm mx-auto">
        <CameraOff className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-red-300 font-semibold text-sm">Camera permission denied</p>
          <p className="text-red-400/70 text-xs mt-0.5">
            Please allow camera access in your browser settings and reload to use proctoring.
          </p>
        </div>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 flex items-start gap-3 max-w-sm mx-auto">
        <CameraOff className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-amber-300 font-semibold text-sm">Camera not available</p>
          <p className="text-amber-400/70 text-xs mt-0.5">
            No camera detected. The interview will continue without visual monitoring.
          </p>
        </div>
      </div>
    );
  }

  // state === "active"
  return (
    <div className="rounded-2xl border border-emerald-800/30 bg-zinc-900/70 overflow-hidden max-w-sm mx-auto">
      {/* Video preview */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-emerald-600/80 backdrop-blur-sm px-2 py-1 rounded-full">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
        {/* Stop camera */}
        <button
          onClick={stopCamera}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600/80 rounded-full flex items-center justify-center text-white transition-all"
          title="Stop camera"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          Camera active — not recording
        </span>
        {allowSnapshot && onSnapshot && (
          <button
            onClick={takeSnapshot}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              snapshotTaken
                ? "bg-emerald-600 text-white"
                : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
            }`}
          >
            {snapshotTaken ? "✓ Taken" : "Snapshot"}
          </button>
        )}
      </div>
    </div>
  );
}
