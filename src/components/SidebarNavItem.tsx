"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./layout/ResizableSidebarLayout";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Optional hover color class override */
  hoverClass?: string;
  /** Badge content (e.g. count) — displayed on the right */
  badge?: React.ReactNode;
  /**
   * Visual variant:
   *  - "light" (default): Org admin / Candidate / Interviewer (light sidebar)
   *  - "dark": System admin (dark zinc/black sidebar)
   */
  variant?: "light" | "dark";
  /**
   * Active accent color for the dark variant.
   * Used to set the glow/background on the system admin sidebar.
   * Format: tailwind color name like "emerald", "rose", "amber", etc.
   */
  darkAccent?: string;
}

// Pre-defined accent maps for the dark system admin sidebar
const DARK_ACCENT_MAP: Record<string, { bg: string; text: string; bar: string; glow: string }> = {
  rose:    { bg: "bg-rose-900/30",    text: "text-rose-400",    bar: "bg-rose-500",    glow: "shadow-rose-500/50" },
  emerald: { bg: "bg-emerald-900/30", text: "text-emerald-400", bar: "bg-emerald-500", glow: "shadow-emerald-500/50" },
  amber:   { bg: "bg-amber-900/30",   text: "text-amber-400",   bar: "bg-amber-400",   glow: "shadow-amber-400/50" },
  indigo:  { bg: "bg-indigo-900/30",  text: "text-indigo-400",  bar: "bg-indigo-500",  glow: "shadow-indigo-500/50" },
  teal:    { bg: "bg-teal-900/30",    text: "text-teal-400",    bar: "bg-teal-500",    glow: "shadow-teal-500/50" },
  sky:     { bg: "bg-sky-900/30",     text: "text-sky-400",     bar: "bg-sky-500",     glow: "shadow-sky-500/50" },
  blue:    { bg: "bg-blue-900/30",    text: "text-blue-400",    bar: "bg-blue-500",    glow: "shadow-blue-500/50" },
  purple:  { bg: "bg-purple-900/30",  text: "text-purple-400",  bar: "bg-purple-500",  glow: "shadow-purple-500/50" },
  violet:  { bg: "bg-violet-900/30",  text: "text-violet-400",  bar: "bg-violet-500",  glow: "shadow-violet-500/50" },
  red:     { bg: "bg-red-900/30",     text: "text-red-400",     bar: "bg-red-500",     glow: "shadow-red-500/50" },
  default: { bg: "bg-zinc-800",       text: "text-white",       bar: "bg-white",       glow: "shadow-white/30" },
};

export function SidebarNavItem({
  href,
  label,
  icon,
  hoverClass,
  badge,
  variant = "light",
  darkAccent = "default",
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const { isCollapsed } = useSidebar();

  // ── Dark variant (System Admin) ────────────────────────────────────────
  if (variant === "dark") {
    const accent = DARK_ACCENT_MAP[darkAccent] || DARK_ACCENT_MAP.default;

    return (
      <Link
        href={href}
        title={isCollapsed ? label : undefined}
        className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center ${isCollapsed ? "justify-center" : "gap-3"} relative group ${
          isActive
            ? `${accent.bg} ${accent.text} font-semibold border border-white/5`
            : `text-zinc-400 ${hoverClass || `hover:${accent.bg} hover:${accent.text}`} hover:translate-x-0.5`
        }`}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${accent.bar} shadow-sm ${accent.glow}`} />
        )}
        <span className="shrink-0 flex items-center justify-center">{icon}</span>
        {!isCollapsed && <span className="truncate">{label}</span>}
        {!isCollapsed && badge && <span className="ml-auto">{badge}</span>}
      </Link>
    );
  }

  // ── Light variant (Org Admin, Candidate, Interviewer) ──────────────────
  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center ${isCollapsed ? "justify-center" : "gap-3"} relative group ${
        isActive
          ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 font-semibold shadow-sm border border-rose-100 dark:border-rose-800/40"
          : `text-gray-600 dark:text-gray-400 ${hoverClass || "hover:bg-gray-100 dark:hover:bg-zinc-800/80"} hover:translate-x-0.5`
      }`}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-rose-500 dark:bg-rose-400 shadow-sm shadow-rose-500/50" />
      )}
      <span className="shrink-0 flex items-center justify-center">{icon}</span>
      {!isCollapsed && <span className="truncate">{label}</span>}
      {!isCollapsed && badge && <span className="ml-auto">{badge}</span>}
    </Link>
  );
}

export function SidebarSection({ title, className }: { title: string; className?: string }) {
  const { isCollapsed } = useSidebar();
  if (isCollapsed) {
    return <div className={`my-2 border-t border-gray-200 dark:border-zinc-800 mx-4 ${className || ""}`} />;
  }
  return (
    <div className={`mt-4 mb-1 px-4 ${className || ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
        {title}
      </span>
    </div>
  );
}
