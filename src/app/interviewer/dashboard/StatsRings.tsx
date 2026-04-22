"use client";

import { useEffect, useRef } from "react";
import { TrendingUp, Star, Clock } from "lucide-react";

interface Props {
  totalConducted: number;
  avgScore:        number;
  onTimeRate:      number;
}

function Ring({
  value,
  max,
  label,
  sub,
  color,
  icon: Icon,
  suffix = "",
}: {
  value:   number;
  max:     number;
  label:   string;
  sub:     string;
  color:   string;
  icon:    typeof TrendingUp;
  suffix?: string;
}) {
  const r   = 44;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(value / max, 1);
  const dash = pct * circ;

  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.strokeDashoffset = `${circ}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
        el.style.strokeDashoffset = `${circ - dash}`;
      });
    });
  }, [dash, circ]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background track */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(39,39,42)" strokeWidth="8" />
          {/* Progress */}
          <circle
            ref={circleRef}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-0.5">
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
          <span className="text-xl font-black text-white leading-none mt-0.5">
            {value}{suffix}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-zinc-600">{sub}</p>
      </div>
    </div>
  );
}

export function StatsRings({ totalConducted, avgScore, onTimeRate }: Props) {
  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">Your Stats</h2>
      <div className="flex flex-col gap-6 items-center">
        <Ring
          value={totalConducted}
          max={Math.max(totalConducted, 50)}
          label="Interviews"
          sub="conducted total"
          color="#818cf8"
          icon={TrendingUp}
        />
        <Ring
          value={avgScore}
          max={10}
          label={`${avgScore > 0 ? avgScore.toFixed(1) : "—"} / 10`}
          sub="avg feedback score"
          color="#34d399"
          icon={Star}
          suffix=""
        />
        <Ring
          value={onTimeRate}
          max={100}
          label="On-time rate"
          sub="feedback within 48h"
          color="#f59e0b"
          icon={Clock}
          suffix="%"
        />
      </div>
    </div>
  );
}
