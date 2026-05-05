"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

const HEADLINES = [
  "Hire with certainty.",
  "See beyond the resume.",
  "Intelligence, not instinct.",
  "Every interview, decided well.",
];

function Typewriter() {
  const [idx, setIdx]     = useState(0);
  const [shown, setShown] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = HEADLINES[idx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && shown.length < target.length) {
      timeout = setTimeout(() => setShown(target.slice(0, shown.length + 1)), 55);
    } else if (!deleting && shown.length === target.length) {
      timeout = setTimeout(() => setDeleting(true), 2400);
    } else if (deleting && shown.length > 0) {
      timeout = setTimeout(() => setShown(shown.slice(0, -1)), 28);
    } else if (deleting && shown.length === 0) {
      setDeleting(false);
      setIdx((i) => (i + 1) % HEADLINES.length);
    }
    return () => clearTimeout(timeout);
  }, [shown, deleting, idx]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-fuchsia-400">
      {shown}<span className="animate-pulse">|</span>
    </span>
  );
}

// Animated HUD mockup
function HudMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto select-none pointer-events-none">
      {/* Outer frame */}
      <div className="rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-2xl shadow-rose-900/20">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[9px] font-bold text-emerald-400 tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Video area */}
        <div className="bg-zinc-800/60 rounded-xl h-32 flex items-center justify-center mb-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-900/30 to-pink-900/20" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-sm font-black">AC</div>
            <div>
              <p className="text-xs font-bold text-white">Alex Chen</p>
              <p className="text-[9px] text-zinc-400">Candidate · Round 2</p>
            </div>
          </div>
          {/* Audio waveform bars */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5">
            {[4,7,5,9,6,8,3,7,5,8,4,6].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-rose-400/70 rounded-full"
                style={{
                  height: `${h * 2}px`,
                  animation: `pulse ${0.4 + i * 0.08}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Signal rows */}
        {[
          { label: "Communication",   score: 82, color: "bg-rose-500" },
          { label: "Confidence",      score: 71, color: "bg-pink-500" },
          { label: "Technical Depth", score: 91, color: "bg-emerald-500" },
        ].map(({ label, score, color }) => (
          <div key={label} className="flex items-center gap-3 mb-2">
            <span className="text-[9px] text-zinc-500 w-24 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[9px] font-black text-white w-6 text-right">{score}</span>
          </div>
        ))}
      </div>

      {/* Float badge */}
      <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-black text-[9px] font-black px-2.5 py-1.5 rounded-xl shadow-lg">
        AI Report Ready ✓
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-24 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-200/40 dark:bg-rose-700/20 blur-3xl rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-200/30 dark:bg-pink-700/15 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold mb-2">
            <Sparkles className="w-3 h-3" />
            AI-Powered Hiring Intelligence
          </div>
          <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight">
            <Typewriter />
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
            Structured interviews, behavioral signals, and AI scorecards — so every hiring decision is grounded in evidence, not gut feel.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link href="/sign-up">
              <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-all shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 hover:-translate-y-0.5">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="mailto:demo@iqmela.com">
              <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold text-sm border border-gray-200 dark:border-zinc-700 transition-all hover:-translate-y-0.5">
                Book a Demo
              </button>
            </a>
          </div>
        </div>

        {/* HUD mockup */}
        <div className="hidden lg:flex items-center justify-center">
          <HudMockup />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
        <div className="w-5 h-8 rounded-full border border-zinc-600 flex items-center justify-center">
          <div className="w-1 h-2 bg-zinc-500 rounded-full" />
        </div>
      </div>
    </section>
  );
}
