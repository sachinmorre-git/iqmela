"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, Mic, MicOff, AlertCircle, ArrowRight, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useNetworkQuality, type NetworkQuality } from "@/hooks/useNetworkQuality";
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
import { formatTime } from "@/lib/locale-utils"

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

function CandidateVideoCard({ phase, onStateChange }: { phase: InterviewPhase, onStateChange?: (state: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"idle" | "active" | "denied" | "unavailable" | "disabled">("idle");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    onStateChange?.(camState);
  }, [camState, onStateChange]);

  const requestCamera = useCallback(() => {
    setCamState("idle");
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setCamState("active");
      })
      .catch((err) => {
        if (err?.name === "NotAllowedError") setCamState("denied");
        else setCamState("unavailable");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Auto-request camera when interview starts (not on ready screen)
    if (phase === "ready" || phase === "results" || phase === "error") return;
    if (camState !== "idle") return;

    if (camState !== "idle") return;

    requestCamera();

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

  if (camState === "denied" || camState === "unavailable" || camState === "disabled") {
    return (
      <div className="w-[300px] sm:w-[400px] md:w-[500px] aspect-video rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-3 text-center p-6 relative group shadow-lg shadow-black/40">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
          <span className="text-xl">{camState === "disabled" ? "📷" : "🚫"}</span>
        </div>
        
        <p className="text-sm text-zinc-300 font-bold leading-tight">
          {camState === "disabled" ? "Camera disabled" : camState === "denied" ? "Camera blocked by browser" : "No camera found"}
        </p>

        {camState === "denied" && (
          <div className="text-[11px] text-zinc-500 max-w-xs space-y-2 mt-1 mb-2">
            <p className="text-amber-500/90 font-semibold">Using Incognito / Private Mode?</p>
            <p>Browsers block cameras automatically in these modes. Please open this link in a standard, normal browser window.</p>
            <p>If you're not in Incognito, click the lock icon <span className="inline-block translate-y-0.5">🔒</span> next to the URL bar above and change permissions to "Allow".</p>
          </div>
        )}

        <button
          onClick={requestCamera}
          className="text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 rounded-xl transition shadow-sm border border-zinc-700/50 mt-2"
        >
          {camState === "disabled" ? "Enable Camera" : "Retry Camera"}
        </button>
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

      {/* Controls overlay */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            setCamState("disabled");
          }}
          className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-rose-500/80 transition-all text-white border border-white/10"
          title="Disable Camera"
        >
          <span className="text-[12px]">📷</span>
        </button>
      </div>

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

function ResultsPanel({ showReferral, candidateReward }: { showReferral: boolean, candidateReward?: any }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  
  const formatReward = (reward: any) => {
    if (!reward) return "$500 Amazon Gift Card";
    const curr = reward.currency === "USD" ? "$" : reward.currency + " ";
    const type = reward.rewardType === "AMAZON_GC" ? "Amazon Gift Card" : "Bonus";
    return `${curr}${reward.amount.toLocaleString()} ${type}`;
  };

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

      {showReferral && (
        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/20 border border-indigo-500/30 rounded-3xl p-8 text-center max-w-xl mx-auto mt-6 shadow-xl shadow-indigo-500/10">
          <h3 className="text-xl font-bold text-white mb-2">You just experienced the future of hiring.</h3>
          <p className="text-indigo-200 text-sm mb-6">
            Does your current company hire? Introduce IQMela to your HR team and earn a <strong className="text-white">{formatReward(candidateReward)}</strong> when they upgrade.
          </p>
          {sent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Invite sent! We'll track it to your account.
            </div>
          ) : (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="HR Manager's Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-zinc-950/50 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
              />
              <button
                onClick={() => {
                  if (email) setSent(true);
                  // In a real implementation, we'd trigger a server action here to create ReferralAction
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                Invite
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-center pt-8">
        <a
          href="/candidate/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-rose-600/20"
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
  resumeFromIndex = 0,
  savedAnswers: initialSavedAnswers,
  showReferral,
  candidateReward,
}: {
  sessionId: string;
  initialQuestions: Question[];
  retriesAllowed?: boolean;
  avatarProvider?: string;
  /** "browser" (default, free) or "elevenlabs" (high quality, requires API key) */
  ttsProvider?: string;
  visualMode?: string;
  /** Index to resume from (number of already-answered turns) */
  resumeFromIndex?: number;
  /** Previously saved answers (null for unanswered) */
  savedAnswers?: (string | null)[];
  showReferral?: boolean;
  candidateReward?: any;
}) {
  const isResuming = resumeFromIndex > 0;
  const [phase, setPhase] = useState<InterviewPhase>("ready");
  const [currentIndex, setCurrentIndex] = useState(resumeFromIndex);
  const [transcript, setTranscript] = useState<string>("");
  const [savedAnswers, setSavedAnswers] = useState<string[]>(
    initialSavedAnswers?.map(a => a ?? "") ?? []
  );
  const [summary, setSummary] = useState<InterviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVisualMode, setActiveVisualMode] = useState(visualMode ?? "orb");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [visualStreamUrl, setVisualStreamUrl] = useState<string | undefined>(undefined);
  const [retriedQuestions, setRetriedQuestions] = useState<Record<number, boolean>>({});
  const [networkSwitchedToOrb, setNetworkSwitchedToOrb] = useState(false);
  const [networkRecovered, setNetworkRecovered] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [childCamState, setChildCamState] = useState<string>("idle");

  // ── AI Circuit Breaker ────────────────────────────────────────────────────
  const handleFailure = useCallback((context: string) => {
    setConsecutiveFailures(prev => {
      const next = prev + 1;
      if (next >= 3) {
        console.error(`[CircuitBreaker] Tripped after 3 consecutive failures. Last context: ${context}`);
        setError("We are experiencing technical difficulties connecting to the AI. Your progress is saved. Please refresh the page or try again later.");
        setPhase("error");
      }
      return next;
    });
  }, []);

  const recordSuccess = useCallback(() => {
    setConsecutiveFailures(0);
  }, []);


  // ── Network Quality Monitor ─────────────────────────────────────────────────
  const isVideoMode = activeVisualMode !== "orb" && !avatarFailed;
  const networkStats = useNetworkQuality({
    intervalMs: 5000,
    degradedThreshold: 3, // 3 consecutive poor readings (~15s)
    enabled: phase !== "results" && phase !== "error",
    onDegraded: (stats) => {
      // Auto-switch from video avatar to Orb on sustained poor connection
      if (isVideoMode) {
        console.warn(
          `[AiInterviewShell:NetworkQuality] Degraded network detected ` +
          `(RTT: ${stats.rttMs}ms, quality: ${stats.quality}). Switching to Orb.`
        );
        setActiveVisualMode("orb");
        setNetworkSwitchedToOrb(true);
        visualRef.current = null; // Nuke video provider so it rebuilds as orb
      }
    },
    onRecovered: (stats) => {
      if (networkSwitchedToOrb) {
        setNetworkRecovered(true);
        // Auto-hide the recovered banner after 5s
        setTimeout(() => setNetworkRecovered(false), 5000);
      }
    },
  });

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

  // ── Save answer to DB (with retry) ─────────────────────────────────────────
  const saveAnswer = useCallback(
    async (answer: string, index: number, metadata?: { durationMs?: number; confidence?: number; providerName?: string }) => {
      const payload = JSON.stringify({ 
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
      });

      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await fetch("/api/ai-interview/transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          if (res.ok) {
            recordSuccess();
            return; // success
          }
          throw new Error(`HTTP ${res.status}`);
        } catch (e) {
          if (attempt < MAX_RETRIES - 1) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            console.warn(`[AiInterviewShell] Retrying save (attempt ${attempt + 2}/${MAX_RETRIES})...`);
          } else {
            console.error("[AiInterviewShell] All save retries exhausted for turn", index, e);
            handleFailure("saveAnswer");
            // Last resort: store in sessionStorage so scoring endpoint can recover
            try {
              const key = `iqm_unsaved_answer_${sessionId}_${index}`;
              sessionStorage.setItem(key, answer);
            } catch { /* sessionStorage unavailable — give up silently */ }
          }
        }
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
            recordSuccess();
          } catch (ttsErr) {
            console.warn("[AiInterviewShell] TTS provider failed, falling back to browser TTS:", ttsErr);
            handleFailure("TTS");
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
          if (!fuRes.ok) throw new Error(`HTTP ${fuRes.status}`);
          const fuData = await fuRes.json();
          recordSuccess();

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
          handleFailure("Follow-up evaluation");
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

  // ── Clean up providers on unmount & browser close ─────────────────────────
  useEffect(() => {
    // 1. Unified teardown function to kill active media & sessions
    const performTeardown = () => {
      console.log("[AiInterviewShell] Tearing down session...");
      try {
        avatarRef.current?.destroySession();
      } catch (e) { /* ignore */ }
      try {
        voiceRef.current?.close();
      } catch (e) { /* ignore */ }
      try {
        visualRef.current?.destroy();
      } catch (e) { /* ignore */ }
    };

    // 2. The unload handler (fires when tab closes or reloads)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      performTeardown();
      
      // If we are actively interviewing (not results, not error), mark as ABANDONED in DB
      setPhase((currentPhase) => {
        if (currentPhase !== "results" && currentPhase !== "error" && currentPhase !== "ready") {
          try {
            // sendBeacon guarantees delivery even as the page unloads
            const payload = JSON.stringify({ sessionId, status: "ABANDONED" });
            navigator.sendBeacon("/api/ai-interview/beacon-teardown", payload);
          } catch (err) {
            console.error("Beacon failed", err);
          }
        }
        return currentPhase;
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // 3. The React unmount handler
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      performTeardown();
    };
  }, [sessionId]);

  // ── Results view ──────────────────────────────────────────────────────────
  if (phase === "results" && summary) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 overflow-y-auto">
        <ResultsPanel showReferral={showReferral ?? false} candidateReward={candidateReward} />
      </div>
    );
  }

  // ── Error view ────────────────────────────────────────────────────────────
  if (phase === "error") {
    // Determine if the error happened during scoring (all answers saved, just scoring failed)
    const isScoringError = currentIndex === totalQuestions - 1 && savedAnswers.filter(a => a).length === totalQuestions;

    const handleRetry = async () => {
      setError(null);
      if (isScoringError) {
        // Only retry the scoring call — don't restart the interview
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
        // General error — reset to ready
        setPhase("ready");
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isScoringError ? "Scoring failed" : "Something went wrong"}
          </h2>
          <p className="text-zinc-400">{error}</p>
          {isScoringError && (
            <p className="text-zinc-500 text-sm">
              Your answers are safely saved. Only the final scoring needs to be retried.
            </p>
          )}
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            {isScoringError ? "Retry Scoring" : "Try Again"}
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
          className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>


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
            <CandidateVideoCard phase={phase} onStateChange={setChildCamState} />
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

        {/* Network Quality Warning Badge */}
        {networkSwitchedToOrb && !networkRecovered && (
          <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <WifiOff className="w-4 h-4" />
            Poor connection detected — switched to lightweight AI Orb
            {networkStats.rttMs !== null && (
              <span className="text-rose-500/60 font-mono">({networkStats.rttMs}ms)</span>
            )}
          </div>
        )}

        {/* Network Recovered Badge */}
        {networkRecovered && (
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Wifi className="w-4 h-4" />
            Connection recovered
          </div>
        )}

        {/* Question Bubble */}
        <div className={`transition-all duration-700 w-full max-w-3xl flex-shrink-0 bg-zinc-900 border ${phase === "asking" ? "border-pink-500 shadow-lg shadow-pink-500/20" : "border-zinc-800 opacity-60"} rounded-3xl p-8 relative overflow-hidden`}>
          {phase === "ready" && (
            <div className="space-y-4 animate-in fade-in duration-500">
              <h2 className="text-2xl font-extrabold text-white">
                {isResuming ? "Welcome back!" : "Ready to start?"}
              </h2>
              {isResuming && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  You answered {resumeFromIndex} of {initialQuestions.length} questions — resuming from where you left off
                </div>
              )}
              <p className="text-zinc-400 max-w-sm mx-auto">
                Make sure your microphone is connected. The AI interviewer will speak each question — answer out loud, then press{" "}
                <kbd className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 text-xs font-mono">Space</kbd>{" "}
                or click <strong className="text-white">Submit Answer</strong> when done.
              </p>
              <div className="flex flex-col gap-2 w-full mt-4">
                <button
                  onClick={() => askQuestion(resumeFromIndex)}
                  disabled={childCamState === "denied"}
                  className="w-full px-10 py-4 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-xl shadow-rose-600/30 text-lg flex items-center justify-center gap-2"
                >
                  {isResuming ? "Resume Interview" : "Begin Interview"}
                  {childCamState === "denied" && <span className="text-xs ml-2 border border-zinc-600 px-2 py-0.5 rounded-full">Camera Blocked</span>}
                </button>
                {childCamState === "denied" && (
                  <p className="text-xs font-bold text-amber-500 text-center animate-in fade-in">
                    You must resolve the camera issue to begin.
                  </p>
                )}
              </div>
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
                <p className="text-sm text-rose-400 animate-pulse font-medium">
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
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-zinc-200 resize-none h-28 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
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
              className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-rose-600/20 flex items-center gap-2"
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
