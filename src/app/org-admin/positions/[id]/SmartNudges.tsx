"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { bulkProcessAllAction } from "./actions";

// ── Nudge Definition ────────────────────────────────────────────────────────

export interface NudgeItem {
  id: string;
  title: string;
  subtitle: string;
  accentFrom: string; // tailwind gradient-from color
  accentTo: string;   // tailwind gradient-to color
  icon: React.ReactNode;
  action:
    | { type: "link"; href: string }
    | { type: "run-pipeline"; positionId: string }
    | { type: "callback"; label: string; fn: () => void };
  actionLabel: string;
  badge?: number;
}

interface SmartNudgesProps {
  nudges: NudgeItem[];
}

// ── Gradient presets (used in className) ─────────────────────────────────────

const GRADIENT_MAP: Record<string, { banner: string; fab: string; fabGlow: string; text: string; textSub: string; dismissHover: string }> = {
  rose: {
    banner: "from-rose-50 via-pink-50 to-rose-50 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-rose-950/40 border-rose-200 dark:border-rose-800/50",
    fab: "from-rose-600 to-pink-600 shadow-rose-500/30 hover:shadow-rose-500/50",
    fabGlow: "from-rose-500 to-pink-500",
    text: "text-rose-900 dark:text-rose-200",
    textSub: "text-rose-600/70 dark:text-rose-400/70",
    dismissHover: "text-rose-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30",
  },
  amber: {
    banner: "from-amber-50 via-orange-50 to-amber-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-amber-200 dark:border-amber-800/50",
    fab: "from-amber-500 to-orange-500 shadow-amber-500/30 hover:shadow-amber-500/50",
    fabGlow: "from-amber-500 to-orange-500",
    text: "text-amber-900 dark:text-amber-200",
    textSub: "text-amber-600/70 dark:text-amber-400/70",
    dismissHover: "text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  },
  indigo: {
    banner: "from-indigo-50 via-violet-50 to-indigo-50 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-indigo-950/40 border-indigo-200 dark:border-indigo-800/50",
    fab: "from-indigo-600 to-violet-600 shadow-indigo-500/30 hover:shadow-indigo-500/50",
    fabGlow: "from-indigo-500 to-violet-500",
    text: "text-indigo-900 dark:text-indigo-200",
    textSub: "text-indigo-600/70 dark:text-indigo-400/70",
    dismissHover: "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30",
  },
  blue: {
    banner: "from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-950/40 dark:via-cyan-950/30 dark:to-blue-950/40 border-blue-200 dark:border-blue-800/50",
    fab: "from-blue-600 to-cyan-600 shadow-blue-500/30 hover:shadow-blue-500/50",
    fabGlow: "from-blue-500 to-cyan-500",
    text: "text-blue-900 dark:text-blue-200",
    textSub: "text-blue-600/70 dark:text-blue-400/70",
    dismissHover: "text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  },
};

function getTheme(from: string) {
  if (from.includes("amber") || from.includes("orange")) return GRADIENT_MAP.amber;
  if (from.includes("indigo") || from.includes("violet")) return GRADIENT_MAP.indigo;
  if (from.includes("blue") || from.includes("cyan")) return GRADIENT_MAP.blue;
  return GRADIENT_MAP.rose;
}

// ── Component ───────────────────────────────────────────────────────────────

export function SmartNudges({ nudges }: SmartNudgesProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [fabVisible, setFabVisible] = useState(false);

  // Dragging State for FAB
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartMouse = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    dragStartMouse.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartMouse.current.x;
    const dy = e.clientY - dragStartMouse.current.y;
    setPosition({
      x: dragStartPos.current.x + dx,
      y: dragStartPos.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleFabClick = (e: React.MouseEvent, nudge: NudgeItem) => {
    const dx = Math.abs(position.x - dragStartPos.current.x);
    const dy = Math.abs(position.y - dragStartPos.current.y);
    if (dx > 5 || dy > 5) {
      return; // It was a drag, not a click
    }
    handleAction(nudge);
  };

  useEffect(() => {
    const timer = setTimeout(() => setFabVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const visible = nudges.filter((n) => !dismissed.has(n.id));
  const banners = visible.slice(0, 3); // max 3 inline banners
  const fabNudge = visible[0]; // highest priority for FAB

  const handleAction = (nudge: NudgeItem) => {
    const action = nudge.action;
    if (action.type === "link") {
      router.push(action.href);
    } else if (action.type === "run-pipeline") {
      setRunningId(nudge.id);
      startTransition(async () => {
        await bulkProcessAllAction(action.positionId, false);
        setDismissed((prev) => new Set(prev).add(nudge.id));
        setRunningId(null);
      });
    } else if (action.type === "callback") {
      action.fn();
    }
  };

  if (visible.length === 0) return null;

  return (
    <>
      {/* ── Inline Banners ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        {banners.map((nudge) => {
          const theme = getTheme(nudge.accentFrom);
          const isRunning = runningId === nudge.id && isPending;

          return (
            <div
              key={nudge.id}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${theme.banner} px-5 py-3.5 shadow-sm`}
            >
              {/* Shimmer */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 70%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmerSlide 3s ease-in-out infinite",
                }}
              />

              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Pulsing dot */}
                  <div className="relative shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-current opacity-80" style={{ color: nudge.accentFrom.includes("rose") ? "#e11d48" : nudge.accentFrom.includes("amber") ? "#d97706" : nudge.accentFrom.includes("indigo") ? "#4f46e5" : "#2563eb" }} />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-current animate-ping opacity-50" style={{ color: nudge.accentFrom.includes("rose") ? "#e11d48" : nudge.accentFrom.includes("amber") ? "#d97706" : nudge.accentFrom.includes("indigo") ? "#4f46e5" : "#2563eb" }} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold ${theme.text}`}>
                      {nudge.title}
                    </p>
                    <p className={`text-xs mt-0.5 ${theme.textSub}`}>
                      {nudge.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAction(nudge)}
                    disabled={isRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 dark:text-gray-900 shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
                  >
                    {isRunning ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Running…
                      </>
                    ) : (
                      <>
                        {nudge.icon}
                        {nudge.actionLabel}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissed((prev) => new Set(prev).add(nudge.id))}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${theme.dismissHover}`}
                    title="Dismiss"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* Animations */}
      <style>{`
        @keyframes shimmerSlide {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </>
  );
}
