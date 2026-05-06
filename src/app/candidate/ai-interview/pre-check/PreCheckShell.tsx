"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Mic, Camera, Globe, ChevronRight, Loader2, CheckCircle, Clock, Hash, AlertCircle } from "lucide-react";
import { CameraConsentShell } from "@/components/ai-interview/CameraConsentShell";
import { CoachMark } from "@/components/ui/CoachMark";

interface Props {
  inviteId: string;
  positionId: string;
  positionTitle: string;
  resumeId?: string;
  candidateName: string;
  existingSessionId?: string;
  cameraRequired: boolean;
  durationMinutes: number;
  totalQuestions: number;
}

type CheckState = "idle" | "checking" | "pass" | "fail";

export function PreCheckShell({
  inviteId,
  positionId,
  positionTitle,
  resumeId,
  candidateName,
  existingSessionId,
  cameraRequired,
  durationMinutes,
  totalQuestions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [micState, setMicState] = useState<CheckState>("idle");
  const [cameraConsented, setCameraConsented] = useState(!cameraRequired);
  const [step, setStep] = useState<"info" | "devices" | "camera" | "ready">("info");

  const checkMic = async () => {
    setMicState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicState("pass");
    } catch {
      setMicState("fail");
    }
  };

  const startInterview = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (existingSessionId) {
          router.push(`/ai-interview/${existingSessionId}`);
          return;
        }

        // Create a new session via the existing server action
        const res = await fetch("/api/ai-interview/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionId, resumeId }),
        });
        const data = await res.json();
        if (!res.ok || !data.sessionId) {
          throw new Error(data.error ?? "Failed to start session");
        }
        router.push(`/ai-interview/${data.sessionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-rose-950 flex items-center justify-center p-6">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-rose-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <Bot className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            AI Interview
          </h1>
          <p className="text-zinc-400 mt-2 font-medium">
            {positionTitle}
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            Hi {candidateName} — let's get you ready.
          </p>
        </div>

        {/* Stepper */}
        {step === "info" && (
          <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl p-8 space-y-6">
            <h2 className="text-lg font-bold text-white">What to expect</h2>
            <div className="space-y-4">
              {[
                { icon: Hash, label: `${totalQuestions} questions`, sub: "Introduction, technical, and behavioral" },
                { icon: Clock, label: `~${durationMinutes} minutes`, sub: "Take your time — no rush between questions" },
                { icon: Mic, label: "Voice answers", sub: "Speak naturally — your voice is transcribed in real-time" },
                { icon: Globe, label: "On-demand", sub: "No scheduling needed — complete anytime" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{label}</p>
                    <p className="text-zinc-400 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("devices")}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "devices" && (
          <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl p-8 space-y-6">
            <h2 className="text-lg font-bold text-white">Device Check</h2>

            {/* Mic */}
            <div className="flex items-center justify-between p-4 bg-zinc-800/60 rounded-2xl border border-zinc-700">
              <div className="flex items-center gap-3">
                <Mic className={`w-5 h-5 ${micState === "pass" ? "text-emerald-400" : micState === "fail" ? "text-red-400" : "text-zinc-400"}`} />
                <div>
                  <p className="text-white font-semibold text-sm">Microphone</p>
                  <p className="text-zinc-400 text-xs">
                    {micState === "idle" ? "Click to test" : micState === "checking" ? "Testing…" : micState === "pass" ? "Working ✓" : "Not detected — check browser settings"}
                  </p>
                </div>
              </div>
              {micState !== "pass" && (
                <button
                  onClick={checkMic}
                  disabled={micState === "checking"}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-all disabled:opacity-50"
                >
                  {micState === "checking" ? "…" : "Test"}
                </button>
              )}
              {micState === "pass" && <CheckCircle className="w-5 h-5 text-emerald-400" />}
            </div>

            {/* Browser */}
            <div className="flex items-center gap-3 p-4 bg-zinc-800/60 rounded-2xl border border-zinc-700">
              <Globe className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-white font-semibold text-sm">Browser Speech API</p>
                <p className="text-zinc-400 text-xs">Supported in Chrome / Edge / Safari</p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-400 ml-auto" />
            </div>

            {micState === "fail" && (
              <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-300 text-xs">
                  Microphone access was denied. You can still proceed — text fallback will be available during the interview.
                </p>
              </div>
            )}

            <button
              onClick={() => cameraRequired ? setStep("camera") : setStep("ready")}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              {cameraRequired ? "Next: Camera" : "I'm Ready"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "camera" && (
          <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl p-8 space-y-6">
            <h2 className="text-lg font-bold text-white">Camera Setup</h2>
            <p className="text-zinc-400 text-sm">
              This interview requires camera access for integrity monitoring.
              Your feed is never recorded or shared.
            </p>
            <div className="relative">
              <CameraConsentShell
                onConsentChange={(granted) => setCameraConsented(granted || true)}
              />
              <CoachMark
                id="camera-consent"
                show={step === "camera"}
                preset="button-tap"
                message="Toggle to grant camera permissions for integrity monitoring"
                buttonLabel="Toggle Camera"
                accentColor="rose"
              />
            </div>
            <button
              onClick={() => setStep("ready")}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">You're all set!</h2>
              <p className="text-zinc-400 text-sm mt-2 max-w-xs mx-auto">
                Find a quiet space, speak clearly, and answer each question naturally. Good luck!
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-left">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}

            <button
              onClick={startInterview}
              disabled={isPending}
              className="w-full py-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold rounded-2xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-lg disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Start Interview
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-zinc-500 text-xs mt-4 p-4 bg-red-950/20 border border-red-900/30 rounded-xl text-left space-y-2">
               <p><strong className="text-red-400">Security & Proctoring Active:</strong> This is a strict proctored session.</p>
               <ul className="list-disc pl-4 text-zinc-400 space-y-1">
                 <li>Do not switch tabs or minimize the browser.</li>
                 <li>Do not use secondary monitors or applications.</li>
                 <li>Do not exit fullscreen mode or open developer tools.</li>
               </ul>
               <p>Violations will trigger visible warnings and be explicitly logged in your final interview report.</p>
            </div>

            <p className="text-zinc-600 text-xs mt-4">
              By starting, you agree that your voice responses will be transcribed and scored by AI.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
