"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, Mic, MicOff, AlertCircle, ArrowRight, RotateCcw } from "lucide-react";
import { resolveAvatarProvider } from "@/lib/ai-interview/providers/avatar";
import { resolveVoiceProvider } from "@/lib/ai-interview/providers/voice";
import { resolveTtsProvider } from "@/lib/ai-interview/providers/tts";
import { resolveVisualProvider } from "@/lib/ai-interview/providers/visual";
import type { AvatarProvider } from "@/lib/ai-interview/providers/avatar/types";
import type { VoiceProvider } from "@/lib/ai-interview/providers/voice/types";
import type { TtsProvider } from "@/lib/ai-interview/providers/tts/types";
import type { VisualProvider } from "@/lib/ai-interview/providers/visual/types";

import { OrbDisplay } from "@/components/ai-interview/OrbDisplay";
import { VideoAvatarDisplay } from "@/components/ai-interview/VideoAvatarDisplay";

// ── Types ────────────────────────────────────────────────────────────────────

type AiQuestionCategory = "INTRO" | "TECHNICAL" | "BEHAVIORAL" | "CLOSING";

interface Question {
  category: AiQuestionCategory;
  question: string;
}

interface AnswerScore {
  turnIndex: number;
  scoreRaw: number;
  scoreFeedback: string;
  strengths: string[];
  gaps: string[];
}

interface InterviewSummary {
  overallScore: number;
  recommendation: string;
  executiveSummary: string;
  perAnswer: AnswerScore[];
}

type InterviewPhase =
  | "loading"
  | "ready"
  | "asking"
  | "listening"
  | "processing"
  | "scoring"
  | "results"
  | "error";

// ── Score colour helpers ─────────────────────────────────────────────────────


function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}

function recommendationBadge(rec: string) {
  const map: Record<string, { label: string; cls: string }> = {
    STRONG_HIRE: { label: "Strong Hire ✦", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    HIRE: { label: "Hire ✓", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    MAYBE: { label: "Maybe ◑", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    WEAK_FIT: { label: "Weak Fit △", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    NEEDS_HUMAN_REVIEW: { label: "Needs Review ◉", cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    NO_HIRE: { label: "No Hire ✗", cls: "bg-red-500/20 text-red-300 border-red-500/30" },
  };
  return map[rec] ?? map["MAYBE"];
}

function categoryLabel(cat: AiQuestionCategory) {
  const map = { INTRO: "Introduction", TECHNICAL: "Technical", BEHAVIORAL: "Behavioral", CLOSING: "Closing" };
  return map[cat] ?? cat;
}

// ── Candidate Self-Video Card ───────────────────────────────────────────────

function CandidateVideoCard({ phase }: { phase: InterviewPhase }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"idle" | "active" | "denied" | "unavailable">("idle");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Auto-request camera when interview starts (not on ready screen)
    if (phase === "ready" || phase === "results" || phase === "error") return;
    if (camState !== "idle") return;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setCamState("active");
        // srcObject is wired after the video element mounts (see effect below)
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") setCamState("denied");
        else setCamState("unavailable");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "ready"]);

  // ── Ref timing fix ───────────────────────────────────────────────────────
  // The <video> element only exists in the DOM after camState becomes "active"
  // (it's conditionally rendered below). This effect runs post-render so
  // videoRef.current is guaranteed to be a real node at this point.
  useEffect(() => {
    if (camState === "active" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {/* autoplay policy — silently ignore */});
    }
  }, [camState]);

  const isListening = phase === "listening";

  if (camState === "idle") return null;

  if (camState === "denied" || camState === "unavailable") {
    return (
      <div className="w-[300px] sm:w-[400px] md:w-[500px] aspect-video rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 text-center p-3">
        <span className="text-2xl">📷</span>
        <p className="text-[10px] text-zinc-500 font-medium leading-tight">
          {camState === "denied" ? "Camera blocked" : "No camera found"}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative w-[300px] sm:w-[400px] md:w-[500px] aspect-video rounded-2xl overflow-hidden border-2 transition-all duration-500 shadow-lg ${
      isListening
        ? "border-emerald-500 shadow-emerald-500/20"
        : "border-zinc-700 shadow-black/40"
    }`}>
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]" // mirror for selfie feel
      />

      {/* Dim overlay when AI is speaking */}
      {phase === "asking" && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-all duration-500" />
      )}

      {/* Live badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
        <span className={`w-1.5 h-1.5 rounded-full ${
          isListening ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
        }`} />
        <span className="text-[9px] font-bold text-white uppercase tracking-wider">
          {isListening ? "Live" : "You"}
        </span>
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted(m => !m)}
        className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all"
        title={muted ? "Unmute" : "Mute camera indicator"}
      >
        <span className="text-[10px]">{muted ? "🔇" : "🎙️"}</span>
      </button>

      {/* Listening ring pulse */}
      {isListening && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/60 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}



// ── Live waveform indicator ───────────────────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-1 h-8">
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.6].map((h, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${
            active ? "bg-emerald-400" : "bg-zinc-700"
          }`}
          style={{
            height: active ? `${h * 32}px` : "8px",
            animationDelay: `${i * 60}ms`,
            animation: active ? `wave ${0.8 + i * 0.07}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

// ── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-20">
      {/* Header */}
      <div className="text-center space-y-3 pt-4">
        <div className="w-24 h-24 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 mb-8">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-white mt-6 mb-4">Interview Complete</h1>
        <p className="text-zinc-400 font-medium text-lg max-w-lg mx-auto leading-relaxed">
          Thank you for completing the AI interview. Your responses have been securely submitted to the recruiting team for review.
        </p>
      </div>

      <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl p-8 text-center max-w-xl mx-auto mt-8">
         <p className="text-zinc-300">
           The talent acquisition team will carefully review your interview along with your uploaded resume. We will contact you soon regarding the next steps.
         </p>
      </div>

      <div className="text-center pt-8">
        <a
          href="/candidate/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20"
        >
          Return to Dashboard <ArrowRight className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}

// ── Main Shell ───────────────────────────────────────────────────────────────

export function AiInterviewShell({
  sessionId,
  initialQuestions,
  retriesAllowed = false,
  avatarProvider,
  ttsProvider,
  visualMode,
}: {
  sessionId: string;
  initialQuestions: Question[];
  retriesAllowed?: boolean;
  avatarProvider?: string;
  /** "browser" (default, free) or "elevenlabs" (high quality, requires API key) */
  ttsProvider?: string;
  visualMode?: string;
}) {
  const [phase, setPhase] = useState<InterviewPhase>("ready");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [savedAnswers, setSavedAnswers] = useState<string[]>([]);
  const [summary, setSummary] = useState<InterviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVisualMode, setActiveVisualMode] = useState(visualMode ?? "orb");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [visualStreamUrl, setVisualStreamUrl] = useState<string | undefined>(undefined);
  const [retriedQuestions, setRetriedQuestions] = useState<Record<number, boolean>>({});

  // ── Step 225: Anti-cheat indicators ─────────────────────────────────────────
  const [tabSwitchCount, setTabSwitchCount]       = useState(0);
  const [pasteCount, setPasteCount]               = useState(0);
  const [camPermission, setCamPermission]         = useState<"granted" | "denied" | "unknown">("unknown");
  const [micPermission, setMicPermission]         = useState<"granted" | "denied" | "unknown">("unknown");
  const [showModeIndicator, setShowModeIndicator] = useState(true);

  // ── Step 252: Mode indicator timer ──────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setShowModeIndicator(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Track tab switches (visibilitychange)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Track paste events during listening phase
  useEffect(() => {
    if (phase !== "listening") return;
    const onPaste = () => setPasteCount((n) => n + 1);
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [phase]);

  // Check camera + microphone permissions once on mount
  useEffect(() => {
    if (!navigator?.permissions) return;
    (navigator.permissions as any).query({ name: "camera" })
      .then((r: PermissionStatus) => setCamPermission(r.state as "granted" | "denied"))
      .catch(() => setCamPermission("unknown"));
    (navigator.permissions as any).query({ name: "microphone" })
      .then((r: PermissionStatus) => setMicPermission(r.state as "granted" | "denied"))
      .catch(() => setMicPermission("unknown"));
  }, []);

  // Flush anti-cheat data with each answer save
  const antiCheatRef = useRef({ tabSwitchCount, pasteCount, camPermission, micPermission });
  useEffect(() => {
    antiCheatRef.current = { tabSwitchCount, pasteCount, camPermission, micPermission };
  }, [tabSwitchCount, pasteCount, camPermission, micPermission]);

  // ── Provider refs (lazy-instantiated client-side only) ─────────────────────
  const avatarRef = useRef<AvatarProvider | null>(null);
  const voiceRef  = useRef<VoiceProvider  | null>(null);
  const ttsRef    = useRef<TtsProvider    | null>(null);
  const visualRef = useRef<VisualProvider | null>(null);

  function getAvatar(): AvatarProvider {
    if (!avatarRef.current) avatarRef.current = resolveAvatarProvider(avatarProvider);
    return avatarRef.current;
  }

  function getVoice(): VoiceProvider {
    if (!voiceRef.current) voiceRef.current = resolveVoiceProvider();
    return voiceRef.current;
  }

  function getTts(): TtsProvider {
    if (!ttsRef.current) ttsRef.current = resolveTtsProvider(ttsProvider);
    return ttsRef.current;
  }

  function getVisual(): VisualProvider {
    if (!visualRef.current) visualRef.current = resolveVisualProvider(activeVisualMode);
    return visualRef.current;
  }

  // Tell visual provider about phase changes
  useEffect(() => {
    if (phase) {
      getVisual().onPhaseChange(phase as any);
    }
  }, [phase]);

  const [liveQuestions, setLiveQuestions] = useState<Question[]>(initialQuestions);
  const currentQuestion = liveQuestions[currentIndex];
  const totalQuestions = liveQuestions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // ── Save answer to DB ──────────────────────────────────────────────────────
  const saveAnswer = useCallback(
    async (answer: string, index: number, metadata?: { durationMs?: number; confidence?: number; providerName?: string }) => {
      try {
        await fetch("/api/ai-interview/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId, 
            turnIndex: index, 
            answer,
            ...metadata,
            // Step 225: attach anti-cheat snapshot
            antiCheat: {
              tabSwitches: antiCheatRef.current.tabSwitchCount,
              pastes: antiCheatRef.current.pasteCount,
              camPermission: antiCheatRef.current.camPermission,
              micPermission: antiCheatRef.current.micPermission,
            },
          }),
        });
      } catch (e) {
        console.warn("[AiInterviewShell] Failed to save transcript turn:", e);
        // Non-fatal — scoring will still work from DB turns that were saved
      }
    },
    [sessionId]
  );

  // ── Speak the current question ─────────────────────────────────────────────
  const askQuestion = useCallback(
    async (index: number) => {
      if (index >= liveQuestions.length) return;
      setPhase("asking");
      setTranscript("");

      // Strip internal [FOLLOW-UP] prefix for display and speech
      const displayQuestion = liveQuestions[index].question.replace(/^\[FOLLOW-UP\]\s*/i, "");

      const avatar = getAvatar();

      // Helper to cleanly advance
      const advanceToListening = () => {
        setPhase("listening");
        startListening();
      };

      try {
        if (!avatar.isReady()) {
          const sessionInfo = await avatar.createSession();
          
          // Persist the avatar session ID (Step 213)
          if (sessionInfo.sessionId) {
            fetch("/api/ai-interview/avatar-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, avatarSessionId: sessionInfo.sessionId }),
            }).catch(console.error);
          }
        }

        // ── Visual Provider Init ────────────────────────────────────────
        const visual = getVisual();
        if (!visual.isReady()) {
          try {
            await visual.init(sessionId);
            setVisualStreamUrl(visual.getStreamUrl?.());
          } catch (e) {
            console.error("[AiInterviewShell] Visual provider init failed:", e);
            // Step 251 — Fallback if video session creation fails
            if (activeVisualMode !== "orb") {
              setActiveVisualMode("orb");
              setAvatarFailed(true);
              // Nuke the visualRef so it rebuilds as 'orb' on next tick
              visualRef.current = null;
            }
          }
        }

        // ── TTS: speak the question ─────────────────────────────────────
        if (activeVisualMode && activeVisualMode !== "orb") {
          // Video avatar natively handles speech/video generation
          if (visual.speak) {
            try {
              await visual.speak(displayQuestion);
              // For avatars, we need a way to know when speech ends.
              // For now, we simulate normal duration or assume it signals us.
              // As a stub, we wait a fixed time then advance
              setTimeout(advanceToListening, displayQuestion.length * 60 + 1000);
            } catch (e) {
              console.error("[AiInterviewShell] Tavus speak failed:", e);
              advanceToListening();
            }
          } else {
            advanceToListening();
          }
        } else {
          // Try the configured TTS provider first (ElevenLabs or Browser).
          // If it throws (e.g. missing API key, network error), automatically
          // fall back to the free browser TTS so the interview never hard-fails.
          const tts = getTts();
          try {
            await tts.speak({ text: displayQuestion, onEnd: advanceToListening });
          } catch (ttsErr) {
            console.warn("[AiInterviewShell] TTS provider failed, falling back to browser TTS:", ttsErr);
            // Import BrowserTtsProvider inline to avoid circular deps
            const { BrowserTtsProvider } = await import("@/lib/ai-interview/providers/tts/browser-tts");
            const fallback = new BrowserTtsProvider();
            await fallback.speak({ text: displayQuestion, onEnd: advanceToListening });
          }
        }

      } catch (err) {
        console.error("[AiInterviewShell] Avatar provider failed:", err);
        // Step 215 — Text-only fallback
        setAvatarFailed(true);
        // Instantly fallback to listening mode so the interview doesn’t soft-lock
        advanceToListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveQuestions]
  );

  // ── Start voice provider listening ─────────────────────────────────────────
  const startListening = useCallback(() => {
    const voice = getVoice();
    voice.startListening({
      language: "en-US",
      onTranscript: ({ text }) => setTranscript(text),
      onPermissionDenied: () => {
        setPermissionDenied(true);
        setPhase("error");
        setError("Microphone access was denied. Please allow microphone access and reload.");
      },
      onError: (err) => console.warn("[Voice] error:", err),
    });
  }, []);

  // ── Retry Answer ──────────────────────────────────────────────────────────
  const retryAnswer = useCallback(async () => {
    if (!retriesAllowed || retriedQuestions[currentIndex]) return;
    
    // They are currently listening, stop it cleanly but don't save
    const voice = getVoice();
    if (voice.isListening()) {
      await voice.stopListening();
    }
    
    setRetriedQuestions(prev => ({ ...prev, [currentIndex]: true }));
    setTranscript("");
    
    // Restart listening phase instantly
    startListening();
  }, [currentIndex, retriesAllowed, retriedQuestions, startListening]);

  // ── Stop listening and process answer ─────────────────────────────────────
  const submitAnswer = useCallback(
    async (manualAnswer?: string) => {
      const voice = getVoice();
      const finalResult = await voice.stopListening();
      getAvatar().stop();
      setPhase("processing");

      const answer = manualAnswer || finalResult.text || transcript || "(no answer provided)";
      const index = currentIndex;

      setSavedAnswers((prev) => {
        const next = [...prev];
        next[index] = answer;
        return next;
      });

      await saveAnswer(answer, index, {
        durationMs: finalResult.durationMs,
        confidence: finalResult.confidence,
        providerName: finalResult.providerName,
      });

      if (isLastQuestion) {
        setPhase("scoring");
        try {
          const res = await fetch("/api/ai-interview/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!res.ok) throw new Error("Scoring failed.");
          const data = await res.json();
          setSummary(data.summary);
          setPhase("results");
        } catch (err: any) {
          setError(err.message ?? "Scoring failed. Please try again.");
          setPhase("error");
        }
      } else {
        // ── Follow-up evaluation (Step 204) ─────────────────────────────────
        try {
          const fuRes = await fetch("/api/ai-interview/follow-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, turnIndex: index, candidateAnswer: answer }),
          });
          const fuData = await fuRes.json();

          if (fuData.shouldFollowUp && fuData.followUpQuestion) {
            // Dynamically inject follow-up question into the live queue
            const followUpQ: Question = {
              category: liveQuestions[index].category,
              question: `[FOLLOW-UP] ${fuData.followUpQuestion}`,
            };
            setLiveQuestions((prev) => {
              const next = [...prev];
              next.splice(index + 1, 0, followUpQ);
              return next;
            });
            const nextIndex = index + 1;
            setCurrentIndex(nextIndex);
            setTimeout(() => askQuestion(nextIndex), 800);
            return;
          }
        } catch (fuErr) {
          // Non-fatal — if follow-up evaluation fails, just move on
          console.warn("[AiInterviewShell] Follow-up evaluation failed:", fuErr);
        }

        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setTimeout(() => askQuestion(nextIndex), 800);
      }
    },
    [transcript, currentIndex, isLastQuestion, saveAnswer, askQuestion, sessionId, liveQuestions]
  );

  // ── Keyboard shortcut — Space to submit ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && phase === "listening" && e.target === document.body) {
        e.preventDefault();
        submitAnswer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, submitAnswer]);

  // ── Clean up providers on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      avatarRef.current?.destroySession();
      voiceRef.current?.close();
      visualRef.current?.destroy();
    };
  }, []);

  // ── Results view ──────────────────────────────────────────────────────────
  if (phase === "results" && summary) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 overflow-y-auto">
        <ResultsPanel />
      </div>
    );
  }

  // ── Error view ────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
          <p className="text-zinc-400">{error}</p>
          <button
            onClick={() => {
              setPhase("ready");
              setError(null);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Main interview UI ─────────────────────────────────────────────────────
  const progress = totalQuestions > 0 ? ((currentIndex + (phase === "scoring" ? 1 : 0)) / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-between p-6 overflow-hidden">
      {/* Top progress bar */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            AI Interview
          </span>
          <span className="text-xs font-semibold text-zinc-400">
            {phase === "ready" ? "Not started" : phase === "scoring" ? "Scoring…" : `Question ${currentIndex + 1} of ${totalQuestions}`}
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step 225 — Anti-cheat status bar */}
      {phase !== "ready" && phase !== "results" && (
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tab switch counter */}
            <span
              title="Number of times you switched to another tab during this interview"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                tabSwitchCount === 0
                  ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                  : tabSwitchCount <= 2
                  ? "bg-amber-900/40 text-amber-400 border-amber-700/40"
                  : "bg-red-900/40 text-red-400 border-red-700/40"
              }`}
            >
              <span>⇄</span> {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? "es" : ""}
            </span>

            {/* Paste counter */}
            <span
              title="Number of paste events detected during answering"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                pasteCount === 0
                  ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                  : "bg-red-900/40 text-red-400 border-red-700/40"
              }`}
            >
              <span>⎘</span> {pasteCount} paste{pasteCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Microphone */}
            <span
              title={`Microphone permission: ${micPermission}`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                micPermission === "granted"
                  ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/30"
                  : micPermission === "denied"
                  ? "bg-red-900/40 text-red-400 border-red-700/40"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}
            >
              🎤 mic {micPermission}
            </span>

            {/* Camera */}
            <span
              title={`Camera permission: ${camPermission}`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                camPermission === "granted"
                  ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/30"
                  : camPermission === "denied"
                  ? "bg-red-900/40 text-red-400 border-red-700/40"
                  : "bg-zinc-800 text-zinc-500 border-zinc-700"
              }`}
            >
              📷 camera {camPermission}
            </span>
          </div>
        </div>
      )}
    </div>

      {/* Centre content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-6xl mx-auto space-y-10 relative">

        {/* ── Avatar + Candidate Video side-by-side layout ── */}
        <div className="w-full flex items-center justify-center gap-6 md:gap-10 flex-wrap">

          {/* AI Visual block */}
          <div className="flex flex-col items-center gap-4 relative">
            {!avatarFailed && (
              activeVisualMode === "orb" || !activeVisualMode ? (
                <OrbDisplay phase={phase as any} />
              ) : (
                <VideoAvatarDisplay phase={phase as any} subProvider={activeVisualMode} streamUrl={visualStreamUrl} />
              )
            )}

            {/* Step 252 — Visual Mode transient indicator */}
            <div className={`absolute -bottom-10 transition-all duration-1000 ${showModeIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
              <span className="px-3 py-1.5 bg-black/60 border border-zinc-800 rounded-full text-xs font-mono text-zinc-300 shadow-xl backdrop-blur-sm whitespace-nowrap">
                {activeVisualMode === "orb" ? "🔮 AI Orb" : `🎥 Live Avatar · ${activeVisualMode}`}
              </span>
            </div>
          </div>

          {/* Candidate self-video card (Hidden in Tavus mode because Tavus handles self-video internally) */}
          {activeVisualMode !== "tavus" && (
            <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                phase === "listening" ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                You
              </span>
            </div>
            <CandidateVideoCard phase={phase} />
          </div>
          )}

        </div>

        {/* Text Fallback Badge */}
        {avatarFailed && (
          <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Live avatar unavailable — using Text fallback UI
          </div>
        )}

        {/* Question Bubble */}
        <div className={`transition-all duration-700 w-full max-w-3xl flex-shrink-0 bg-zinc-900 border ${phase === "asking" ? "border-violet-500 shadow-lg shadow-violet-500/20" : "border-zinc-800 opacity-60"} rounded-3xl p-8 relative overflow-hidden`}>
          {phase === "ready" && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <h2 className="text-2xl font-extrabold text-white">Ready to start?</h2>
              <p className="text-zinc-400 max-w-sm mx-auto">
                Make sure your microphone is connected. The AI interviewer will speak each question — answer out loud, then press{" "}
                <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs font-mono">Space</kbd>{" "}
                or click <strong className="text-white">Submit Answer</strong> when done.
              </p>
              <button
                onClick={() => askQuestion(0)}
                className="mt-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-xl shadow-indigo-600/30 text-lg"
              >
                Begin Interview
              </button>
            </div>
          )}

          {(phase === "asking" || phase === "listening" || phase === "processing") && currentQuestion && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <span
                className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                  currentQuestion.category === "TECHNICAL"
                    ? "bg-blue-950/50 text-blue-400 border-blue-800/50"
                    : currentQuestion.category === "BEHAVIORAL"
                    ? "bg-purple-950/50 text-purple-400 border-purple-800/50"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {currentQuestion.question.startsWith("[FOLLOW-UP]") ? "Follow-Up" : categoryLabel(currentQuestion.category)}
              </span>
              {currentQuestion.question.startsWith("[FOLLOW-UP]") && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  ↳ Based on your previous answer
                </span>
              )}
              <p className="text-xl font-semibold text-white leading-snug max-w-lg">
                {currentQuestion.question.replace(/^\[FOLLOW-UP\]\s*/i, "")}
              </p>
              {phase === "asking" && (
                <p className="text-sm text-indigo-400 animate-pulse font-medium">
                  AI is speaking
                </p>
              )}
              {phase === "listening" && (
                <p className="text-sm text-emerald-400 font-medium animate-pulse">
                  Your turn to answer
                </p>
              )}
              {phase === "processing" && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-amber-400 font-medium">
                    Processing answer
                  </p>
                  <p className="text-xs text-zinc-500">
                    Next question loading...
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === "scoring" && (
            <div className="space-y-3 animate-in fade-in duration-500">
              <h2 className="text-xl font-bold text-white">Evaluating your responses…</h2>
              <p className="text-zinc-400 text-sm">Our AI is reviewing your answers. This takes about 15 seconds.</p>
            </div>
          )}
        </div>

        {/* Live transcript */}
        {(phase === "listening" || phase === "processing") && (
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-5 min-h-[80px] transition-all">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Your answer (live transcript)</p>
            <p className="text-zinc-300 leading-relaxed text-sm">
              {transcript || (
                <span className="text-zinc-600 italic">Start speaking…</span>
              )}
            </p>
          </div>
        )}

        {/* Permission denied — fallback text input */}
        {permissionDenied && phase === "listening" && (
          <div className="w-full max-w-lg space-y-2">
            <p className="text-xs text-amber-400 font-medium flex items-center gap-2">
              <MicOff className="w-4 h-4" />
              Speech recognition unavailable — type your answer below
            </p>
            <textarea
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-zinc-200 resize-none h-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="Type your answer here…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>
        )}

        {/* Waveform */}
        {phase === "listening" && (
          <div className="flex flex-col items-center gap-3">
            <WaveformBars active={true} />
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-2xl flex items-center justify-center gap-4 pb-4">
        {phase === "listening" && (
          <>
            <button
              onClick={() => submitAnswer()}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              Submit Answer{" "}
              {isLastQuestion ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
            {retriesAllowed && !retriedQuestions[currentIndex] && (
              <button
                onClick={retryAnswer}
                className="px-6 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-2xl transition-all hover:-translate-y-0.5 border border-zinc-700 flex items-center gap-2"
                title="You can retry once per question"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Answer
              </button>
            )}
            <span className="text-xs text-zinc-600 font-medium">
              or press{" "}
              <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">
                Space
              </kbd>
            </span>
          </>
        )}
        {phase === "asking" && (
          <button
            onClick={() => {
              getAvatar().stop();
              setPhase("listening");
              startListening();
            }}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl transition-all text-sm flex items-center gap-2"
          >
            <Mic className="w-4 h-4" />
            Skip to answering
          </button>
        )}
      </div>
    </div>
  );
}
