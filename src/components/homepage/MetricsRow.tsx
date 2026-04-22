"use client";

import { useEffect, useRef } from "react";

interface Props {
  totalInterviews: number;
  totalOrgs:       number;
  totalPositions:  number;
  avgScore:        number | null;
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || target === 0) { if (el) el.textContent = `0${suffix}`; return; }
    const duration = 1600;
    const start    = performance.now();
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      el.textContent = `${Math.round(ease * target).toLocaleString()}${suffix}`;
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const STATIC_METRICS = [
  { label: "AI latency",   value: "< 250ms",  sub: "inference speed"  },
  { label: "Platform SLA", value: "99.9%",    sub: "uptime guarantee" },
];

export function MetricsRow({ totalInterviews, totalOrgs, totalPositions, avgScore }: Props) {
  const live = [
    { label: "Interviews completed", value: totalInterviews, suffix: "+" },
    { label: "Organisations",        value: totalOrgs,       suffix: "+" },
    { label: "Positions created",    value: totalPositions,  suffix: "+" },
    {
      label: "Avg AI score",
      value: avgScore != null ? Math.round(avgScore) : null,
      suffix: "%",
      fallback: "—",
    },
  ];

  return (
    <section className="border-y border-zinc-800/60 bg-zinc-900/30 py-10 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {live.map(({ label, value, suffix, fallback }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <p className="text-2xl font-black text-white">
              {value == null
                ? (fallback ?? "—")
                : <CountUp target={value} suffix={suffix ?? ""} />}
            </p>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
        {STATIC_METRICS.map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <p className="text-2xl font-black text-indigo-400">{value}</p>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
