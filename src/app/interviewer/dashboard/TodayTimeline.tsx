"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Video } from "lucide-react";
import { formatDate } from "@/lib/locale-utils"

interface TodayIV {
  id:              string;
  scheduledAt:     string;
  durationMinutes: number;
  status:          string;
  candidateName:   string;
  positionTitle:   string;
}

interface Props {
  interviews:    TodayIV[];
  upcomingCount: number;
}

function timeToMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

const DAY_START = 8 * 60;  // 8am
const DAY_END   = 20 * 60; // 8pm
const DAY_SPAN  = DAY_END - DAY_START;

function BlockCard({ iv, now }: { iv: TodayIV; now: number }) {
  const start  = new Date(iv.scheduledAt);
  const end    = new Date(start.getTime() + iv.durationMinutes * 60_000);
  const startM = timeToMinutes(start);
  const endM   = timeToMinutes(end);
  const msToStart = start.getTime() - Date.now();
  const isLive    = now >= startM && now < endM;
  const isPast    = now >= endM || iv.status === "COMPLETED";
  const isSoon    = msToStart > 0 && msToStart < 5 * 60_000;

  const top    = ((Math.max(startM, DAY_START) - DAY_START) / DAY_SPAN) * 100;
  const height = Math.max(((Math.min(endM, DAY_END) - Math.max(startM, DAY_START)) / DAY_SPAN) * 100, 4);

  return (
    <div
      className={`absolute left-16 right-0 rounded-xl px-3 py-2 border transition-all ${
        isLive ? "bg-emerald-900/60 border-emerald-500/40" :
        isSoon ? "bg-amber-900/40 border-amber-500/30 animate-pulse" :
        isPast ? "bg-zinc-900/40 border-zinc-800 opacity-50" :
                 "bg-rose-900/30 border-rose-500/20 hover:border-rose-500/40"
      }`}
      style={{ top: `${top}%`, height: `${height}%`, minHeight: "44px" }}
    >
      <div className="flex items-start justify-between gap-2 h-full">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold truncate ${isLive ? "text-emerald-300" : isPast ? "text-zinc-500" : "text-white"}`}>
            {iv.candidateName}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">{iv.positionTitle}</p>
          {isLive && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
            </div>
          )}
        </div>
        {(isLive || isSoon) && (
          <Link href={`/interview/${iv.id}/live`}>
            <button className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${
              isLive ? "bg-emerald-500 text-black" : "bg-amber-500 text-black"
            }`}>
              <Zap className="w-3 h-3" /> Join
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function TodayTimeline({ interviews, upcomingCount }: Props) {
  const [nowMin, setNowMin] = useState(() => timeToMinutes(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNowMin(timeToMinutes(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm
  const nowPct = ((nowMin - DAY_START) / DAY_SPAN) * 100;

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
            <Video className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Today&apos;s Schedule</h2>
            <p className="text-xs text-zinc-600">
              {interviews.length > 0 ? `${interviews.length} interview${interviews.length > 1 ? "s" : ""}` : "Clear runway"}{" "}
              {upcomingCount > 0 && `· ${upcomingCount} this week`}
            </p>
          </div>
        </div>
        <p className="text-xs font-bold text-zinc-500">
          {formatDate(new Date(), { style: "full" })}
        </p>
      </div>

      {interviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-sm font-bold text-white">Clear runway today</p>
          <p className="text-xs text-zinc-600 mt-1">No interviews scheduled. A great time to review feedback.</p>
        </div>
      ) : (
        <div className="relative" style={{ height: "320px" }}>
          {/* Hour lines + labels */}
          {hours.map((h) => {
            const pct = ((h * 60 - DAY_START) / DAY_SPAN) * 100;
            if (pct < 0 || pct > 100) return null;
            return (
              <div key={h} className="absolute left-0 right-0 flex items-center gap-3" style={{ top: `${pct}%` }}>
                <span className="text-[10px] text-zinc-700 font-bold w-12 text-right shrink-0">
                  {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
                </span>
                <div className="flex-1 h-px bg-zinc-800/60" />
              </div>
            );
          })}

          {/* Now indicator */}
          {nowMin >= DAY_START && nowMin <= DAY_END && (
            <div
              className="absolute left-0 right-0 flex items-center gap-2 z-10 pointer-events-none"
              style={{ top: `${nowPct}%` }}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-11" />
              <div className="flex-1 h-px bg-red-500/60" />
            </div>
          )}

          {/* Interview blocks */}
          {interviews.map((iv) => (
            <BlockCard key={iv.id} iv={iv} now={nowMin} />
          ))}
        </div>
      )}
    </div>
  );
}
