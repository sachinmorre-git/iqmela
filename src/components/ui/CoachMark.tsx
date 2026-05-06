"use client";

import { useEffect, useState, useCallback } from "react";
import "./coach-mark.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type CoachMarkPreset = "grid-select" | "button-tap" | "form-fill";

interface CoachMarkProps {
  /** Unique ID for localStorage persistence */
  id: string;
  /** Whether the coach mark should be visible (external condition) */
  show: boolean;
  /** Animation preset to use */
  preset: CoachMarkPreset;
  /** Instructional message */
  message: string;
  /** Brand accent color for fills */
  accentColor?: "rose" | "blue" | "emerald" | "amber" | "violet";
  /** Optional button label for button-tap preset */
  buttonLabel?: string;
  /** Optional placeholder text for form-fill preset */
  placeholderText?: string;
  /** Called when coach mark is dismissed */
  onDismiss?: () => void;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function hasSeenCoachMark(id: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`iqmela:coach:${id}`) === "true";
}

function markCoachMarkSeen(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`iqmela:coach:${id}`, "true");
}

// ── Accent Colors ─────────────────────────────────────────────────────────────

const ACCENT_GRADIENTS = {
  rose:    "from-rose-400 to-rose-500",
  blue:    "from-blue-400 to-blue-500",
  emerald: "from-emerald-400 to-emerald-500",
  amber:   "from-amber-400 to-amber-500",
  violet:  "from-violet-400 to-violet-500",
} as const;

const ACCENT_BG = {
  rose:    "bg-rose-500",
  blue:    "bg-blue-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  violet:  "bg-violet-500",
} as const;

const ACCENT_GLOW = {
  rose:    "shadow-rose-300/40",
  blue:    "shadow-blue-300/40",
  emerald: "shadow-emerald-300/40",
  amber:   "shadow-amber-300/40",
  violet:  "shadow-violet-300/40",
} as const;

// ── Cursor SVG ────────────────────────────────────────────────────────────────

function CursorSVG({ className }: { className: string }) {
  return (
    <div className={className} style={{ width: 0, height: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="cm-cursor-svg">
        <path
          d="M5 3l14 8-6.5 1.5L11 19z"
          fill="#111827"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ── Checkmark SVG ─────────────────────────────────────────────────────────────

function CheckSVG() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── Preset: Grid Select ───────────────────────────────────────────────────────

function GridSelectPreset({ accentColor }: { accentColor: string }) {
  const gradient = ACCENT_GRADIENTS[accentColor as keyof typeof ACCENT_GRADIENTS] || ACCENT_GRADIENTS.rose;
  const cellIds = ["cm-gs-c1", "cm-gs-c2", "cm-gs-c3", "cm-gs-c4", "cm-gs-c5", "cm-gs-c6"];

  return (
    <div className="relative">
      {/* 2×3 mock grid */}
      <div className="grid grid-cols-3 gap-2">
        {cellIds.map((cls) => (
          <div
            key={cls}
            className="w-20 h-10 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 bg-white/90 dark:bg-zinc-800/90 relative overflow-hidden shadow-sm"
          >
            {cls !== "cm-gs-c3" && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center ${cls}`}>
                <CheckSVG />
              </div>
            )}
            {/* Empty cell dot */}
            {cls === "cm-gs-c3" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-zinc-700" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Travelling cursor */}
      <CursorSVG className="absolute top-0 left-0 cm-gs-cursor" />
    </div>
  );
}

// ── Preset: Button Tap ────────────────────────────────────────────────────────

function ButtonTapPreset({ accentColor, buttonLabel }: { accentColor: string; buttonLabel: string }) {
  const bg = ACCENT_BG[accentColor as keyof typeof ACCENT_BG] || ACCENT_BG.rose;
  const glow = ACCENT_GLOW[accentColor as keyof typeof ACCENT_GLOW] || ACCENT_GLOW.rose;

  return (
    <div className="relative">
      {/* Mock button */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          tabIndex={-1}
          className={`${bg} text-white text-sm font-bold px-8 py-3 rounded-xl shadow-lg ${glow} cm-bt-btn cursor-default`}
        >
          {buttonLabel}
        </button>

        {/* Success checkmark after tap */}
        <div className="cm-bt-check flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Done!
        </div>
      </div>

      {/* Travelling cursor */}
      <CursorSVG className="absolute top-0 left-0 cm-bt-cursor" />
    </div>
  );
}

// ── Preset: Form Fill ─────────────────────────────────────────────────────────

function FormFillPreset({ accentColor, placeholderText }: { accentColor: string; placeholderText: string }) {
  const bg = ACCENT_BG[accentColor as keyof typeof ACCENT_BG] || ACCENT_BG.rose;

  return (
    <div className="relative">
      {/* Mock input */}
      <div className="w-56 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 shadow-sm">
        <div className="text-[10px] text-gray-400 dark:text-zinc-500 mb-1 font-semibold uppercase tracking-wider">
          Email
        </div>
        <div className="relative h-5 overflow-hidden flex items-center">
          <div className="cm-ff-text text-sm text-gray-800 dark:text-zinc-200 font-medium whitespace-nowrap overflow-hidden">
            {placeholderText}
          </div>
          <div className={`cm-ff-caret w-0.5 h-4 ${bg} ml-0.5 shrink-0`} />
        </div>
      </div>

      {/* Travelling cursor */}
      <CursorSVG className="absolute top-0 left-0 cm-ff-cursor" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CoachMark({
  id,
  show,
  preset,
  message,
  accentColor = "rose",
  buttonLabel = "Get Started",
  placeholderText = "team@company.com",
  onDismiss,
}: CoachMarkProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Check persistence + external show prop
  useEffect(() => {
    if (show && !hasSeenCoachMark(id)) {
      setVisible(true);
    }
  }, [show, id]);

  // Auto-dismiss when show becomes false
  useEffect(() => {
    if (!show && visible && !exiting) {
      setExiting(true);
      markCoachMarkSeen(id);
      const timer = setTimeout(() => {
        setVisible(false);
        setExiting(false);
        onDismiss?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [show, visible, exiting, id, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-10 pointer-events-none flex items-center justify-center ${
        exiting ? "cm-exit" : "cm-enter"
      }`}
    >
      {/* Glassmorphism scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/65 via-white/45 to-white/65 dark:from-zinc-900/65 dark:via-zinc-900/45 dark:to-zinc-900/65 backdrop-blur-[2px] rounded-2xl" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Preset animation */}
        {preset === "grid-select" && <GridSelectPreset accentColor={accentColor} />}
        {preset === "button-tap" && <ButtonTapPreset accentColor={accentColor} buttonLabel={buttonLabel} />}
        {preset === "form-fill" && <FormFillPreset accentColor={accentColor} placeholderText={placeholderText} />}

        {/* Message tooltip */}
        <div className="bg-white/85 dark:bg-zinc-800/85 backdrop-blur-lg text-gray-800 dark:text-zinc-200 text-[13px] font-semibold px-5 py-2.5 rounded-2xl shadow-xl border border-white/60 dark:border-zinc-700/60 text-center max-w-[260px]">
          {message}
        </div>
      </div>
    </div>
  );
}
