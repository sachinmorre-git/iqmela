"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Clock } from "lucide-react";

type CState = "none" | "far" | "today" | "soon" | "imminent" | "live" | "done";

interface Props {
  scheduledAt:     string | null;
  interviewId:     string | null;
  durationMinutes: number;
  positionTitle:   string | null;
}

function getCountdownState(scheduledAt: string | null, durationMinutes: number): { state: CState; msLeft: number } {
  if (!scheduledAt) return { state: "none", msLeft: -1 };
  const now   = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end   = start + durationMinutes * 60_000;
  const msLeft = start - now;
  if (now > end)                      return { state: "done",     msLeft: 0      };
  if (now >= start)                   return { state: "live",     msLeft: 0      };
  if (msLeft <  5 * 60_000)           return { state: "imminent", msLeft        };
  if (msLeft < 60 * 60_000)           return { state: "soon",     msLeft        };
  if (msLeft < 24 * 60 * 60_000)     return { state: "today",    msLeft        };
  return                                     { state: "far",      msLeft        };
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    h: String(Math.floor(s / 3600)).padStart(2, "0"),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    s: String(s % 60).padStart(2, "0"),
  };
}

const CFG: Record<CState, {
  label:       string;
  sublabel:    string;
  gradient:    string;
  glow:        string;
  accent:      string;
  pulse:       boolean;
}> = {
  none:     { label: "No interview scheduled",           sublabel: "Check back when an interview is confirmed.",      gradient: "from-zinc-900 to-zinc-950",                 glow: "hidden",              accent: "text-zinc-600",   pulse: false },
  far:      { label: "Your interview starts in",         sublabel: "You have plenty of time to prepare well.",        gradient: "from-indigo-950/80 to-zinc-950",            glow: "bg-indigo-700/20",    accent: "text-indigo-300", pulse: false },
  today:    { label: "Your interview is today",          sublabel: "Get focused — your briefing room is ready.",      gradient: "from-violet-950/80 to-zinc-950",            glow: "bg-violet-700/20",    accent: "text-violet-300", pulse: false },
  soon:     { label: "Interview starting soon",          sublabel: "Time to lock in. You've got this.",               gradient: "from-amber-950/60 to-zinc-950",             glow: "bg-amber-700/20",     accent: "text-amber-300",  pulse: true  },
  imminent: { label: "Your interview is about to start", sublabel: "Join now — the panel is waiting for you.",        gradient: "from-red-950/70 to-zinc-950",               glow: "bg-red-700/25",       accent: "text-red-300",    pulse: true  },
  live:     { label: "Your interview is LIVE",           sublabel: "Join immediately — you're expected right now!",   gradient: "from-emerald-950/70 to-zinc-950",           glow: "bg-emerald-700/25",   accent: "text-emerald-300",pulse: true  },
  done:     { label: "Interview complete",               sublabel: "Outstanding! You'll hear back soon.",             gradient: "from-teal-950/40 to-zinc-950",              glow: "bg-teal-700/15",      accent: "text-teal-300",   pulse: false },
};

export function CountdownHero({ scheduledAt, interviewId, durationMinutes, positionTitle }: Props) {
  const [cd, setCd] = useState(() => getCountdownState(scheduledAt, durationMinutes));

  useEffect(() => {
    if (!scheduledAt) return;
    const id = setInterval(() => setCd(getCountdownState(scheduledAt, durationMinutes)), 1000);
    return () => clearInterval(id);
  }, [scheduledAt, durationMinutes]);

  const cfg      = CFG[cd.state];
  const { h, m, s } = fmt(cd.msLeft);
  const showClock = cd.state === "far" || cd.state === "today" || cd.state === "soon" || cd.state === "imminent";
  const showJoin  = cd.state === "imminent" || cd.state === "live";
  const joinHref  = interviewId ? `/interview/${interviewId}/live` : "#";

  return (
    <div className={`relative rounded-3xl overflow-hidden border border-white/5 bg-gradient-to-br ${cfg.gradient} transition-all duration-1000`}>
      {/* Animated glow blob */}
      <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] ${cfg.glow} blur-3xl rounded-full pointer-events-none transition-all duration-1000`} />

      <div className="relative z-10 px-6 py-10 text-center space-y-2">
        {/* Label */}
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{cfg.label}</p>

        {/* Position name */}
        {positionTitle && (
          <p className="text-lg font-black text-white mt-1">{positionTitle}</p>
        )}

        {/* Countdown digits */}
        {showClock && (
          <div className="flex items-end justify-center gap-2 py-6">
            {[{ v: h, u: "hrs" }, { v: m, u: "min" }, { v: s, u: "sec" }].map(({ v, u }, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`text-[72px] leading-none font-black tabular-nums tracking-tight transition-colors duration-500 ${cfg.accent} ${cfg.pulse ? "animate-pulse" : ""}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {v}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{u}</p>
              </div>
            ))}
          </div>
        )}

        {/* LIVE state */}
        {cd.state === "live" && (
          <div className="py-6 flex items-center justify-center gap-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
            </span>
            <span className="text-5xl font-black text-emerald-400">LIVE NOW</span>
          </div>
        )}

        {/* Done state */}
        {cd.state === "done" && (
          <div className="py-6">
            <p className="text-5xl font-black text-teal-400">✓ Complete</p>
          </div>
        )}

        {/* Sublabel */}
        <p className="text-sm text-zinc-500">{cfg.sublabel}</p>

        {/* Join button (imminent / live) */}
        {showJoin && interviewId && (
          <div className="pt-4">
            <Link href={joinHref}>
              <button className={`inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl font-black text-lg transition-all duration-200 ${
                cd.state === "live"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-2xl shadow-emerald-500/40 scale-105"
                  : "bg-red-500 hover:bg-red-400 text-white shadow-2xl shadow-red-500/40"
              }`}>
                <Zap className="w-5 h-5" />
                Join Interview Now
              </button>
            </Link>
          </div>
        )}

        {/* Preview link (far / today) */}
        {(cd.state === "far" || cd.state === "today") && interviewId && (
          <div className="pt-3">
            <Link href={joinHref}>
              <button className="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-xs bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/10 transition-all">
                <Clock className="w-3.5 h-3.5" /> Preview Join Room
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
