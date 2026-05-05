"use client";

import { useState, useEffect } from "react";
import {
  Database, Bot, Video, TrendingUp, Users, Shield,
  FileWarning, ChevronDown, ChevronRight, Activity,
  AlertTriangle, Zap, ArrowUpRight, ArrowDownRight,
  Minus, Info, Radio,
} from "lucide-react";
import type { PlatformRiskReport, DimensionScore, RiskLevel, RiskSignal, RawMetrics } from "./risk-engine";

// ── Pulse CSS Keyframes (injected once) ─────────────────────────────────────

const PULSE_STYLES = `
@keyframes riskHeartbeat {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.04); opacity: 0.8; }
}
@keyframes riskBreath {
  0%, 100% { box-shadow: 0 0 0 0 var(--pulse-color); }
  50% { box-shadow: 0 0 20px 4px var(--pulse-color); }
}
@keyframes riskBreathFast {
  0%, 100% { box-shadow: 0 0 0 0 var(--pulse-color); }
  50% { box-shadow: 0 0 28px 6px var(--pulse-color); }
}
@keyframes liveDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
@keyframes arcPulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.35; }
}
@keyframes sweepGlow {
  0% { stroke-dashoffset: var(--circ); opacity: 0; }
  30% { opacity: 0.6; }
  100% { stroke-dashoffset: var(--target-offset); opacity: 0; }
}
`;

function PulseStyleInjector() {
  useEffect(() => {
    if (document.getElementById("risk-pulse-styles")) return;
    const style = document.createElement("style");
    style.id = "risk-pulse-styles";
    style.textContent = PULSE_STYLES;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  return null;
}

// Pulse speed maps: higher risk = faster pulse
const HEARTBEAT_SPEED: Record<RiskLevel, string> = {
  LOW: "4s",
  MODERATE: "2.5s",
  HIGH: "1.6s",
  CRITICAL: "0.9s",
};

const PULSE_COLOR_VAR: Record<RiskLevel, string> = {
  LOW: "rgba(52,211,153,0.15)",
  MODERATE: "rgba(251,191,36,0.2)",
  HIGH: "rgba(251,146,60,0.25)",
  CRITICAL: "rgba(248,113,113,0.35)",
};

// ── Icon Map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Database> = {
  Database, Bot, Video, TrendingUp, Users, Shield, FileWarning,
};

// ── Color System ────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<RiskLevel, {
  text: string; bg: string; border: string; glow: string;
  gradient: string; ring: string; dot: string;
}> = {
  LOW: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
    glow: "shadow-emerald-500/20",
    gradient: "from-emerald-500 to-teal-500",
    ring: "stroke-emerald-400",
    dot: "bg-emerald-400",
  },
  MODERATE: {
    text: "text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    glow: "shadow-amber-500/20",
    gradient: "from-amber-500 to-yellow-500",
    ring: "stroke-amber-400",
    dot: "bg-amber-400",
  },
  HIGH: {
    text: "text-orange-400",
    bg: "bg-orange-500/8",
    border: "border-orange-500/20",
    glow: "shadow-orange-500/20",
    gradient: "from-orange-500 to-red-500",
    ring: "stroke-orange-400",
    dot: "bg-orange-400",
  },
  CRITICAL: {
    text: "text-red-400",
    bg: "bg-red-500/8",
    border: "border-red-500/20",
    glow: "shadow-red-500/15",
    gradient: "from-red-500 to-rose-600",
    ring: "stroke-red-400",
    dot: "bg-red-400",
  },
};

// ── PRI Gauge (Radial) with Live Heartbeat ──────────────────────────────────

function PriGauge({ pri, level }: { pri: number; level: RiskLevel }) {
  const c = LEVEL_COLORS[level];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pri / 100) * circumference;
  const speed = HEARTBEAT_SPEED[level];
  const pulseColor = PULSE_COLOR_VAR[level];

  const statusLabel = {
    LOW: "All Systems Nominal",
    MODERATE: "Monitor Closely",
    HIGH: "Action Required",
    CRITICAL: "Immediate Response Needed",
  }[level];

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-8 rounded-3xl border ${c.border} ${c.bg} backdrop-blur-sm shadow-xl ${c.glow}`}
      style={{
        "--pulse-color": pulseColor,
        animation: level !== "LOW" ? `riskBreath${level === "CRITICAL" ? "Fast" : ""} ${speed} ease-in-out infinite` : "none",
      } as React.CSSProperties}
    >
      {/* Heartbeat pulse ring — scales faster with higher risk */}
      <div
        className={`absolute inset-0 rounded-3xl border-2 ${c.border}`}
        style={{
          animation: `riskHeartbeat ${speed} ease-in-out infinite`,
          transformOrigin: "center",
        }}
      />

      {/* Second outer ring for CRITICAL — double pulse */}
      {level === "CRITICAL" && (
        <div
          className={`absolute -inset-1 rounded-[1.25rem] border ${c.border}`}
          style={{
            animation: `riskHeartbeat ${speed} ease-in-out infinite 0.3s`,
            opacity: 0.25,
          }}
        />
      )}

      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Background track */}
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor"
            className="text-zinc-800/50" strokeWidth="8" />
          {/* Score arc */}
          <circle cx="60" cy="60" r="54" fill="none"
            className={c.ring} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)" }} />
          {/* Breathing glow behind arc */}
          <circle cx="60" cy="60" r="54" fill="none"
            className={c.ring} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{
              filter: "blur(8px)",
              transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)",
              animation: `arcPulse ${speed} ease-in-out infinite`,
            }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-black tabular-nums ${c.text}`}>
            {pri}
          </span>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            PRI
          </span>
        </div>
      </div>

      <div className="mt-4 text-center">
        <span className={`text-xs font-black uppercase tracking-wider ${c.text}`}>
          {level}
        </span>
        <p className="text-[11px] text-zinc-500 mt-1">{statusLabel}</p>
      </div>
    </div>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, level }: { data: number[]; level: RiskLevel }) {
  if (!data || data.length === 0) return null;
  const c = LEVEL_COLORS[level];
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 64;
  const step = w / (data.length - 1 || 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  const fill = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");

  return (
    <svg width={w} height={h} className="shrink-0 opacity-80">
      <defs>
        <linearGradient id={`spark-${level}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${fill} ${w},${h}`}
        className={c.text}
        fill={`url(#spark-${level})`}
      />
      <polyline
        points={points}
        fill="none"
        className={c.ring}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Risk Dimension Card ─────────────────────────────────────────────────────

function RiskDimensionCard({ dim }: { dim: DimensionScore }) {
  const [expanded, setExpanded] = useState(false);
  const c = LEVEL_COLORS[dim.level];
  const Icon = ICON_MAP[dim.icon] || Activity;
  const needsPulse = dim.level === "HIGH" || dim.level === "CRITICAL";
  const pulseColor = PULSE_COLOR_VAR[dim.level];
  const speed = HEARTBEAT_SPEED[dim.level];

  return (
    <div
      className={`group relative rounded-2xl border ${c.border} ${c.bg} backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${c.glow} cursor-pointer`}
      style={needsPulse ? {
        "--pulse-color": pulseColor,
        animation: `riskBreath${dim.level === "CRITICAL" ? "Fast" : ""} ${speed} ease-in-out infinite`,
      } as React.CSSProperties : undefined}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card Header */}
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Icon with pulse ring for HIGH/CRITICAL */}
        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {needsPulse && (
            <div
              className={`absolute -inset-1 rounded-xl border ${c.border}`}
              style={{ animation: `riskHeartbeat ${speed} ease-in-out infinite` }}
            />
          )}
        </div>

        {/* Label + Score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{dim.label}</h3>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border}`}>
              {dim.level}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Score bar */}
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${c.gradient}`}
                style={{ width: `${dim.score}%`, transition: "width 1s ease-out" }}
              />
            </div>
            <span className={`text-sm font-black tabular-nums ${c.text} min-w-[32px] text-right`}>
              {dim.score}
            </span>
          </div>
        </div>

        {/* Sparkline */}
        {dim.trend.length > 0 && (
          <div className="hidden sm:block">
            <Sparkline data={dim.trend} level={dim.level} />
          </div>
        )}

        {/* Expand toggle */}
        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Signals */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-zinc-800/50 pt-3 space-y-2">
          {dim.signals.map((sig, i) => (
            <SignalRow key={i} signal={sig} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signal Row ──────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: RiskSignal }) {
  const c = LEVEL_COLORS[signal.status];

  return (
    <div className="flex items-center gap-3 py-1">
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`}
        style={signal.status === "CRITICAL" || signal.status === "HIGH"
          ? { animation: `liveDot 1.5s ease-in-out infinite` } : undefined}
      />
      <span className="text-xs text-zinc-400 flex-1">{signal.label}</span>
      <span className={`text-xs font-bold tabular-nums ${c.text}`}>
        {signal.value}
      </span>
      {signal.detail && (
        <span className="hidden md:inline text-[10px] text-zinc-600 max-w-[200px] truncate" title={signal.detail}>
          {signal.detail}
        </span>
      )}
    </div>
  );
}

// ── Key Metrics Bar ─────────────────────────────────────────────────────────

function KeyMetricsBar({ metrics }: { metrics: RawMetrics }) {
  const items = [
    { label: "Organizations", value: metrics.totalOrganizations, icon: Users },
    { label: "Users", value: metrics.totalUsers, icon: Users },
    { label: "Positions", value: metrics.totalPositions, icon: TrendingUp },
    { label: "Resumes", value: metrics.totalResumes, icon: Database },
    { label: "Intake (24h)", value: metrics.intakeLast24h, icon: ArrowUpRight },
    { label: "AI Cost (24h)", value: `$${metrics.aiCostLast24h.toFixed(2)}`, icon: Zap },
    { label: "Active Sessions", value: metrics.activeAiSessions, icon: Video },
    { label: "Incidents", value: metrics.activeIncidents, icon: AlertTriangle },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2.5 text-center"
        >
          <item.icon className="w-3.5 h-3.5 text-zinc-600 mx-auto mb-1" />
          <div className="text-sm font-black text-white tabular-nums">
            {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
          </div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold mt-0.5">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Weight Bar (visual contribution) ────────────────────────────────────────

function WeightBar({ dimensions }: { dimensions: DimensionScore[] }) {
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          PRI Contribution by Dimension
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {dimensions.map((d) => {
          const c = LEVEL_COLORS[d.level];
          const pct = (d.weight / totalWeight) * 100;
          return (
            <div
              key={d.id}
              className={`bg-gradient-to-r ${c.gradient} relative group`}
              style={{ width: `${pct}%` }}
              title={`${d.label}: ${d.score} (${(d.weight * 100).toFixed(0)}% weight)`}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[9px] text-white font-bold whitespace-nowrap z-10">
                {d.label}: {d.score}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex mt-2 gap-3 flex-wrap">
        {dimensions.map((d) => {
          const c = LEVEL_COLORS[d.level];
          return (
            <div key={d.id} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-sm bg-gradient-to-r ${c.gradient}`} />
              <span className="text-[9px] text-zinc-500">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Trend Summary ───────────────────────────────────────────────────────────

function TrendSummary({ metrics }: { metrics: RawMetrics }) {
  function trendIcon(current: number, previous: number) {
    if (current > previous * 1.05) return <ArrowUpRight className="w-3 h-3 text-rose-400" />;
    if (current < previous * 0.95) return <ArrowDownRight className="w-3 h-3 text-emerald-400" />;
    return <Minus className="w-3 h-3 text-zinc-600" />;
  }

  function trendPct(current: number, previous: number) {
    if (previous === 0) return current > 0 ? "+∞" : "0%";
    const pct = ((current - previous) / previous) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
  }

  const trends = [
    {
      label: "Resume Volume",
      current: metrics.resumesLast7d,
      previous: metrics.resumesPrev7d,
      unit: "this week",
    },
    {
      label: "Applications",
      current: metrics.intakeLast7d,
      previous: metrics.intakePrev7d,
      unit: "this week",
    },
    {
      label: "AI Spend",
      current: metrics.aiCostLast7d,
      previous: metrics.aiCostPrev7d,
      unit: "this week",
      format: (v: number) => `$${v.toFixed(2)}`,
    },
    {
      label: "AI Tokens",
      current: metrics.aiTokensLast7d,
      previous: metrics.aiTokensPrev7d,
      unit: "this week",
      format: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          Week-over-Week Trends
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {trends.map((t) => (
          <div key={t.label} className="flex items-center gap-3">
            {trendIcon(t.current, t.previous)}
            <div>
              <div className="text-xs text-zinc-400">{t.label}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white tabular-nums">
                  {t.format ? t.format(t.current) : t.current.toLocaleString()}
                </span>
                <span className={`text-[10px] font-bold tabular-nums ${
                  t.current > t.previous * 1.05 ? "text-rose-400" :
                  t.current < t.previous * 0.95 ? "text-emerald-400" : "text-zinc-600"
                }`}>
                  {trendPct(t.current, t.previous)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live Monitoring Bar ─────────────────────────────────────────────────────

function LiveMonitorBar({ level, generatedAt }: { level: RiskLevel; generatedAt: string }) {
  const c = LEVEL_COLORS[level];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  };

  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-xl border ${c.border} ${c.bg} backdrop-blur-sm`}>
      <div className="flex items-center gap-2.5">
        {/* Animated live dot */}
        <span
          className={`w-2 h-2 rounded-full ${c.dot}`}
          style={{ animation: `liveDot ${HEARTBEAT_SPEED[level]} ease-in-out infinite` }}
        />
        <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>
          Live Monitoring
        </span>
        <span className="text-[10px] text-zinc-600">•</span>
        <Radio className={`w-3 h-3 ${c.text}`} style={{ animation: `liveDot 2s ease-in-out infinite` }} />
        <span className="text-[10px] text-zinc-500 tabular-nums">
          Scanned {formatElapsed(elapsed)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-zinc-600 tabular-nums">
          {new Date(generatedAt).toLocaleTimeString()}
        </span>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border}`}>
          PRI {level}
        </span>
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

export function RiskAnalysisClient({
  report,
  rawMetrics,
}: {
  report: PlatformRiskReport;
  rawMetrics: RawMetrics;
}) {
  // Sort dimensions by score descending (highest risk first)
  const sortedDims = [...report.dimensions].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      <PulseStyleInjector />

      {/* Live Monitoring Status Bar */}
      <LiveMonitorBar level={report.level} generatedAt={report.generatedAt} />

      {/* Top Row: PRI Gauge + Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <PriGauge pri={report.pri} level={report.level} />

        <div className="flex flex-col gap-4">
          <KeyMetricsBar metrics={rawMetrics} />
          <TrendSummary metrics={rawMetrics} />
        </div>
      </div>

      {/* Weight Contribution Bar */}
      <WeightBar dimensions={report.dimensions} />

      {/* Risk Dimensions Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-white">
            Risk Dimensions
          </h2>
          <span className="text-[10px] text-zinc-600">
            — sorted by risk (highest first) — click to expand
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {sortedDims.map((dim) => (
            <RiskDimensionCard key={dim.id} dim={dim} />
          ))}
        </div>
      </div>

      {/* Footer Timestamp */}
      <div className="text-center text-[10px] text-zinc-700 py-4">
        Report generated at {new Date(report.generatedAt).toLocaleString()} •
        Platform Risk Index (PRI) v1.0
      </div>
    </div>
  );
}
