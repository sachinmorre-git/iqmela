"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { reportProctorViolationAction } from "./proctorActions";
import { ShieldAlert } from "lucide-react";
import {
  SignalBuffer,
  type GazeZone,
  type SessionSignal,
} from "./signalBuffer";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute gaze zone from face blendshapes
// ─────────────────────────────────────────────────────────────────────────────
function computeGazeZone(shapes: { categoryName: string; score: number }[]): GazeZone {
  const get = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
  const lookLeft  = get("eyeLookOutLeft");
  const lookRight = get("eyeLookOutRight");
  const lookUp    = get("eyeLookUpLeft");
  const lookDown  = get("eyeLookDownLeft");
  const max = Math.max(lookLeft, lookRight, lookUp, lookDown);
  // Threshold 0.25 — mild eye movement = still centered (avoids over-triggering)
  if (max < 0.25)          return "CENTER";
  if (lookLeft  === max)   return "LEFT";
  if (lookRight === max)   return "RIGHT";
  if (lookUp    === max)   return "UP";
  return "DOWN";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute engagement score (0–100) from blendshapes
// ─────────────────────────────────────────────────────────────────────────────
function computeEngagementScore(shapes: { categoryName: string; score: number }[]): number {
  const get = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
  const smile   = get("mouthSmileLeft");
  const eyeWide = get("eyeWideLeft");
  const cheek   = get("cheekSquintLeft");
  const jaw     = get("jawOpen");
  const browUp  = 1 - get("browDownLeft"); // inverted: relaxed brow = engaged, not stressed
  return Math.round((smile * 0.25 + eyeWide * 0.25 + cheek * 0.20 + jaw * 0.15 + browUp * 0.15) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute composure score (0–100) — inverse of stress markers
// ─────────────────────────────────────────────────────────────────────────────
function computeComposureScore(shapes: { categoryName: string; score: number }[]): number {
  const get = (name: string) => shapes.find(s => s.categoryName === name)?.score ?? 0;
  const browDownL  = get("browDownLeft");
  const browDownR  = get("browDownRight");
  const mouthPress = get("mouthPressLeft");
  const stressLevel = (browDownL + browDownR) / 2 + mouthPress * 0.5;
  return Math.round(Math.max(0, 100 - stressLevel * 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// VisionProctor
// ─────────────────────────────────────────────────────────────────────────────
export function VisionProctor({
  interviewId,
  isCandidate,
  signalBuffer,
}: {
  interviewId:  string;
  isCandidate:  boolean;
  signalBuffer: SignalBuffer;
}) {
  const { localParticipant } = useLocalParticipant();
  const cameraTracks         = useTracks([Track.Source.Camera]);

  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const reportQueue     = useRef(false);

  // Head-down frame counter
  const headDownFrames  = useRef(0);
  // Gaze distracted 60s-window throttle
  const gazeAlertQueue  = useRef(false);
  // Pulse counter for WPM estimation
  const pulseCount      = useRef(0);
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Silence tracking
  const silenceStart    = useRef<number | null>(null);

  // Engagement/Composure rolling buffers (sample every ~1s ≈ 30 frames)
  const engagementBuf   = useRef<number[]>([]);
  const composureBuf    = useRef<number[]>([]);
  const frameCount      = useRef(0);

  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isCandidate || typeof window === "undefined") return;

    let active       = true;
    let landmarker: FaceLandmarker | null = null;
    let animationFrame: number;

    const localCamera    = cameraTracks.find(t => t.participant.identity === localParticipant.identity);
    const audioPayload   = localParticipant.getTrackPublication(Track.Source.Microphone);

    if (!localCamera?.publication?.track?.mediaStreamTrack) return;

    // ── Media stream setup ────────────────────────────────────────────────
    const stream = new MediaStream();
    stream.addTrack(localCamera.publication.track.mediaStreamTrack);

    if (audioPayload?.track?.mediaStreamTrack) {
      stream.addTrack(audioPayload.track.mediaStreamTrack);
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
    }

    // ── WPM estimation: count volume pulses per second ────────────────────
    pulseIntervalRef.current = setInterval(() => {
      if (!active) return;
      const wpm = Math.round((pulseCount.current / 1) * 60 / 1.5);
      pulseCount.current = 0;
      signalBuffer.push("PACE", { wpm });
    }, 30_000); // push PACE signal every 30s

    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.muted = true;

    videoElement.onloadedmetadata = async () => {
      await videoElement.play();
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        if (!active) return;

        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });

        const detectFrame = () => {
          if (!active) return;
          frameCount.current++;

          try {
            const results = landmarker!.detectForVideo(videoElement, performance.now());

            // ── Audio analysis ────────────────────────────────────────────
            if (analyserRef.current) {
              const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(buf);
              const volume = buf.reduce((s, v) => s + v, 0) / buf.length;
              const nowMs = Date.now();

              if (volume < 8) {
                // Silence
                if (!silenceStart.current) silenceStart.current = nowMs;
                const silenceDuration = nowMs - silenceStart.current;
                if (silenceDuration > 5000) {
                  signalBuffer.push("SILENCE_GAP", {
                    startMs: silenceStart.current - Date.now() + silenceDuration,
                    durationMs: silenceDuration,
                  });
                  silenceStart.current = null; // reset to avoid re-logging
                }
              } else {
                silenceStart.current = null;
                // Count pulses for WPM
                if (volume > 15) pulseCount.current++;
              }
            }

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              const shapes = results.faceBlendshapes[0].categories;

              // ── 6B.2 Eye Gaze Zone ──────────────────────────────────────
              const zone = computeGazeZone(shapes);
              signalBuffer.push("GAZE_ZONE", zone);

              // Silent DB log when gaze is very distracted (60s rolling check)
              // We use the buffer's own window — check pct centered every 60s
              // Done in the snapshot loop separately via Data Channel emit

              // ── 6B.3 Head Pitch Detection ───────────────────────────────
              const landmarks = results.faceLandmarks?.[0];
              if (landmarks && landmarks.length > 10) {
                const noseTip  = landmarks[1];
                const forehead = landmarks[10];
                const pitch    = (noseTip.y - forehead.y) * 100;

                if (pitch > 8) {
                  headDownFrames.current++;
                  signalBuffer.setHeadDownCount(headDownFrames.current);
                  if (headDownFrames.current > 60) { // ~2s at 30fps
                    signalBuffer.push("HEAD_DOWN", { durationMs: 2000 });
                    headDownFrames.current = 0;
                  }
                } else {
                  headDownFrames.current = 0;
                  signalBuffer.setHeadDownCount(0);
                }
              }

              // ── 6B.4 Engagement + Composure (sample every ~30 frames) ───
              if (frameCount.current % 30 === 0) {
                const eng  = computeEngagementScore(shapes);
                const comp = computeComposureScore(shapes);

                // 300-sample rolling buffer (~5 min at 1 sample/s)
                engagementBuf.current = [...engagementBuf.current.slice(-299), eng];
                composureBuf.current  = [...composureBuf.current.slice(-299), comp];
              }

              // Push engagement/composure signals every 30s
              if (frameCount.current % 900 === 0 && engagementBuf.current.length > 0) {
                const avgEngagement = Math.round(
                  engagementBuf.current.reduce((s, v) => s + v, 0) / engagementBuf.current.length
                );
                const avgComposure = Math.round(
                  composureBuf.current.reduce((s, v) => s + v, 0) / composureBuf.current.length
                );
                signalBuffer.push("ENGAGEMENT", { score: avgEngagement });
                signalBuffer.push("COMPOSURE",  { score: avgComposure });
              }

              // ── Lip-sync / deepfake audio check (existing, preserved) ───
              if (analyserRef.current) {
                const buf    = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(buf);
                const volume = buf.reduce((s, v) => s + v, 0) / buf.length;
                const jawOpen = shapes.find(s => s.categoryName === "jawOpen")?.score ?? 0;

                if (volume > 45 && jawOpen < 0.05) {
                  triggerProctorAlert(
                    "AUDIO_LIP_MISMATCH",
                    "Severe Voice/Lip Mismatch. Possible synthesized audio detected."
                  );
                }
              }
            }
          } catch (_) {}

          animationFrame = requestAnimationFrame(detectFrame);
        };

        detectFrame();
      } catch (err) {
        console.warn("[Vision Proctor] Initialization failed.", err);
      }
    };

    videoRef.current = videoElement;

    return () => {
      active = false;
      if (animationFrame)               cancelAnimationFrame(animationFrame);
      if (pulseIntervalRef.current)     clearInterval(pulseIntervalRef.current);
      if (audioContextRef.current)      audioContextRef.current.close().catch(() => {});
      if (landmarker)                   landmarker.close();
      if (videoElement.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };

  }, [isCandidate, localParticipant, cameraTracks, signalBuffer]);

  // ── Proctor alert (visual + DB) ─────────────────────────────────────────────
  const triggerProctorAlert = (type: string, message: string) => {
    setWarning(`Vision AI: ${message}`);
    setTimeout(() => setWarning(null), 10000);

    if (reportQueue.current) return;
    reportQueue.current = true;
    signalBuffer.push("VIOLATION", { type, message });
    reportProctorViolationAction(interviewId, type, { systemTrigger: message }).catch(() => {});
    setTimeout(() => { reportQueue.current = false; }, 20000);
  };

  if (!warning) return null;

  return (
    <div className="absolute top-20 right-6 z-[9999] bg-gradient-to-r from-red-900 to-black text-white px-5 py-4 rounded-2xl shadow-rose-500/20 shadow-2xl border border-red-500/50 flex flex-col max-w-sm animate-in fade-in zoom-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-3 mb-2 border-b border-red-500/30 pb-2">
        <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse shrink-0" />
        <h4 className="font-black tracking-widest text-[11px] text-red-500 uppercase">AI Vision Analysis</h4>
      </div>
      <p className="text-sm font-semibold">{warning}</p>
    </div>
  );
}
