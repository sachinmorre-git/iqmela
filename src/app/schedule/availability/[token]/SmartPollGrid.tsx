"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, Clock, Flame, AlertTriangle, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { formatDate, formatTime } from "@/lib/locale-utils"
import { toast as sonnerToast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeSlot {
  date: string;      // "2026-04-21"
  startTime: string; // "09:00"
  endTime: string;   // "09:30"
}

interface Participant {
  userId: string;
  isMe: boolean;
  name: string;
  email: string;
  avatarUrl: string | null;
  slots: TimeSlot[];
  hasSubmitted: boolean;
}

interface PollData {
  id: string;
  roundLabel: string;
  positionTitle: string;
  candidateName: string;
  durationMinutes: number;
  minSlotsRequired: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  deadline: string;
  status: string;
  commonSlots: TimeSlot[];
}

interface Props {
  token: string;
  initialPoll: PollData;
  initialParticipants: Participant[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARTICIPANT_COLORS = [
  { bg: "bg-rose-500",   ring: "ring-rose-400",   dot: "#f43f5e", light: "bg-rose-100 dark:bg-rose-900/30",   text: "text-rose-700 dark:text-rose-400" },
  { bg: "bg-pink-500",   ring: "ring-pink-400",   dot: "#ec4899", light: "bg-pink-100 dark:bg-pink-900/30",   text: "text-pink-700 dark:text-pink-400" },
  { bg: "bg-amber-500",  ring: "ring-amber-400",  dot: "#f59e0b", light: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-violet-500", ring: "ring-violet-400", dot: "#8b5cf6", light: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400" },
  { bg: "bg-sky-500",    ring: "ring-sky-400",    dot: "#0ea5e9", light: "bg-sky-100 dark:bg-sky-900/30",     text: "text-sky-700 dark:text-sky-400" },
  { bg: "bg-emerald-500",ring: "ring-emerald-400",dot: "#10b981", light: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
];

// Business hours: 9am – 5pm in 30-min slots
const TIME_SLOTS_LABELS: string[] = [];
for (let h = 9; h < 17; h++) {
  TIME_SLOTS_LABELS.push(`${h.toString().padStart(2, "0")}:00`);
  TIME_SLOTS_LABELS.push(`${h.toString().padStart(2, "0")}:30`);
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(d); // weekdays only
  }
  return days;
}

function dateToISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
  return d;
}

function slotKey(date: string, time: string): string {
  return `${date}|${time}`;
}

function getDeadlineWeekdays(deadline: string): number {
  const now = new Date();
  const end = new Date(deadline);
  let count = 0;
  const d = new Date(now);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SmartPollGrid({ token, initialPoll, initialParticipants }: Props) {
  const [poll, setPoll] = useState<PollData>(initialPoll);
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [mySelections, setMySelections] = useState<Set<string>>(new Set());
  const [overrideMinSlots, setOverrideMinSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Color mapping by participant userId
  const colorMap = useRef<Map<string, (typeof PARTICIPANT_COLORS)[0]>>(new Map());
  participants.forEach((p, i) => {
    if (!colorMap.current.has(p.userId)) {
      colorMap.current.set(p.userId, PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]);
    }
  });

  const me = participants.find((p) => p.isMe);
  const myColor = me ? colorMap.current.get(me.userId) : PARTICIPANT_COLORS[0];
  const myCount = mySelections.size;
  const minRequired = poll.minSlotsRequired;
  const meetsMin = myCount >= minRequired;
  const canSubmit = (meetsMin || overrideMinSlots) && !isSubmitting;
  const weekdaysLeft = getDeadlineWeekdays(poll.deadline);
  const isExpiredOrCanceled = poll.status === "EXPIRED" || poll.status === "CANCELED";

  // Pre-populate my selections from server data
  useEffect(() => {
    const mine = participants.find((p) => p.isMe);
    if (mine?.slots?.length) {
      const keys = new Set(mine.slots.map((s) => slotKey(s.date, s.startTime)));
      setMySelections(keys);
    }
  }, []);

  // Subscribe to SSE for live grid updates
  useEffect(() => {
    const es = new EventSource(`/api/poll/${token}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "grid-update") {
          const prev = participants.map((p) => p.hasSubmitted);
          setParticipants(data.participants);
          if (data.pollStatus) setPoll((p) => ({ ...p, status: data.pollStatus, commonSlots: data.commonSlots || [] }));

          // Toast if a new person just submitted
          const newSubmitter = (data.participants as Participant[]).find(
            (p, i) => !p.isMe && p.hasSubmitted && !prev[i]
          );
          if (newSubmitter) {
            const responded = (data.participants as Participant[]).filter((p) => p.hasSubmitted).length;
            const total = data.participants.length;
            sonnerToast.info(`✨ ${newSubmitter.name.split(" ")[0]} just responded — ${responded} of ${total} done!`);
            setLastUpdate(formatTime(new Date(), { showTimezone: false }));
          }
        }
      } catch { /* ignore parse errors */ }
    };

    return () => es.close();
  }, [token]);



  // Compute the week to display
  const rangeStart = new Date(poll.dateRangeStart + "T00:00:00");
  const rangeEnd = new Date(poll.dateRangeEnd + "T00:00:00");
  const baseWeek = startOfWeek(rangeStart);
  const currentWeekStart = new Date(baseWeek);
  currentWeekStart.setDate(baseWeek.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(currentWeekStart);
  const maxWeekOffset = Math.ceil(
    (rangeEnd.getTime() - rangeStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  // For each cell, compute who has it selected
  function getCellParticipants(date: string, time: string): Participant[] {
    return participants.filter((p) =>
      p.slots.some((s) => s.date === date && s.startTime === time)
    );
  }

  function isHotSlot(date: string, time: string): boolean {
    const submitted = participants.filter((p) => p.hasSubmitted);
    if (submitted.length < 2) return false;
    return submitted.every((p) => p.slots.some((s) => s.date === date && s.startTime === time));
  }

  function toggleSlot(date: string, time: string) {
    if (submitted || isExpiredOrCanceled || poll.status === "CONFIRMED") return;
    const key = slotKey(date, time);
    setMySelections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 15) {
          sonnerToast.warning("You've selected a lot — the AI works best with 5–15 focused picks.");
          return prev;
        }
        next.add(key);
      }
      // Auto-save draft to server (non-blocking)
      const slots: TimeSlot[] = [...next].map((k) => {
        const [d, t] = k.split("|");
        const h = parseInt(t.split(":")[0]);
        const m = parseInt(t.split(":")[1]);
        const endMin = h * 60 + m + 30;
        const endH = Math.floor(endMin / 60).toString().padStart(2, "0");
        const endM = (endMin % 60).toString().padStart(2, "0");
        return { date: d, startTime: t, endTime: `${endH}:${endM}` };
      });
      fetch(`/api/poll/${token}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, isFinal: false }),
      }).catch(() => {});
      return next;
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const slots: TimeSlot[] = [...mySelections].map((key) => {
        const [date, startTime] = key.split("|");
        const [h, m] = startTime.split(":").map(Number);
        const endMin = h * 60 + m + 30;
        return {
          date,
          startTime,
          endTime: `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`,
        };
      });
      const res = await fetch(`/api/poll/${token}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, overrideMinSlots, isFinal: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progressPercent = Math.min((myCount / minRequired) * 100, 100);
  const submittedCount = participants.filter((p) => p.hasSubmitted).length;

  // ── Submitted State ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-in fade-in zoom-in-95">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">{myCount}</div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Availability Submitted!</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2 max-w-sm">
            Your {myCount} slot{myCount !== 1 ? "s" : ""} have been saved. We'll find the best common time and let everyone know.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{submittedCount} of {participants.length} panelists have responded</span>
        </div>

        {!isExpiredOrCanceled && poll.status !== "CONFIRMED" && (
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              const slots = [...mySelections].map((key) => {
                const [date, startTime] = key.split("|");
                const [h, m] = startTime.split(":").map(Number);
                const endMin = h * 60 + m + 30;
                return {
                  date,
                  startTime,
                  endTime: `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`,
                };
              });
              // Fire an auto-save to immediately clear the 'submittedAt' on the backend
              fetch(`/api/poll/${token}/slots`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots, overrideMinSlots, isFinal: false }),
              }).catch(() => {});
            }}
            className="mt-4 px-6 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
          >
            Edit My Availability
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* ── Left Column: Calendar ───────────────────────────────────────── */}
      <div className="flex-1 w-full min-w-[50%] space-y-6">
      {/* ── Deadline Banner ─────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border
        ${weekdaysLeft <= 1
          ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          : weekdaysLeft <= 2
          ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
          : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400"
        }`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          {weekdaysLeft <= 0
            ? "⚠️ Deadline passed"
            : `⏳ ${weekdaysLeft} weekday${weekdaysLeft !== 1 ? "s" : ""} remaining to respond`}
        </span>
      </div>

      {/* ── AI Best Overlaps (if any) ────────────────────────────────────── */}
      {poll.commonSlots.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-cyan-50 dark:from-rose-900/20 dark:to-cyan-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Best Overlaps So Far</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {poll.commonSlots.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 rounded-lg text-xs font-semibold text-rose-800 dark:text-rose-300">
                {i === 0 && <Flame className="w-3 h-3 text-amber-500 shrink-0" />}
                {formatDate(new Date(s.date + "T00:00:00"))} @ {s.startTime}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Week Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Week of {formatDate(currentWeekStart)}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500">
            {weekOffset + 1} of {maxWeekOffset + 1} weeks
          </p>
        </div>
        <button
          onClick={() => setWeekOffset((w) => Math.min(maxWeekOffset, w + 1))}
          disabled={weekOffset >= maxWeekOffset}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Shared Transparency Grid ─────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="min-w-[480px]">
          {/* Day headers */}
          <div className="grid border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-800" style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}>
            <div className="p-2" />
            {weekDays.map((d) => {
              const iso = dateToISO(d);
              const inRange = iso >= poll.dateRangeStart && iso <= poll.dateRangeEnd;
              return (
                <div key={iso} className={`p-2 text-center border-l border-gray-100 dark:border-zinc-800 ${!inRange ? "opacity-30" : ""}`}>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase">
                    {formatDate(d)}
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time rows */}
          {TIME_SLOTS_LABELS.map((time, timeIdx) => (
            <div
              key={time}
              className={`grid ${timeIdx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-gray-50 dark:bg-zinc-800"} border-b border-gray-100 dark:border-zinc-800`}
              style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}
            >
              {/* Time label — only on the hour */}
              <div className="px-2 py-1 flex items-center justify-end">
                {time.endsWith(":00") && (
                  <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-600 leading-none">
                    {parseInt(time) > 12
                      ? `${parseInt(time) - 12}PM`
                      : parseInt(time) === 12
                      ? "12PM"
                      : `${parseInt(time)}AM`}
                  </span>
                )}
              </div>

              {/* Day cells */}
              {weekDays.map((d) => {
                const iso = dateToISO(d);
                const inRange = iso >= poll.dateRangeStart && iso <= poll.dateRangeEnd;
                const key = slotKey(iso, time);
                const isSelected = mySelections.has(key);
                const hot = isHotSlot(iso, time);
                const cellParticipants = getCellParticipants(iso, time);
                const othersInCell = cellParticipants.filter((p) => !p.isMe);

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!inRange || isExpiredOrCanceled}
                    onClick={() => inRange && toggleSlot(iso, time)}
                    className={`
                      relative h-9 border-l border-gray-100 dark:border-zinc-800 transition-all duration-150 group p-[2px]
                      ${!inRange ? "bg-gray-50/50 dark:bg-zinc-950/50 cursor-not-allowed" : "cursor-pointer"}
                      ${inRange && !isSelected ? "hover:bg-gray-50 dark:hover:bg-zinc-800/40" : ""}
                    `}
                  >
                    <div className={`
                      w-full h-full rounded-md flex items-center justify-center relative overflow-hidden transition-all duration-200
                      ${isSelected ? `${myColor?.light} ring-1 ring-inset ${myColor?.ring} shadow-sm` : ""}
                      ${hot && !isSelected ? "bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" : ""}
                      ${!isSelected && !hot ? "bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-600" : ""}
                    `}>
                      {/* Hot slot glow */}
                      {hot && (
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-400/10 dark:from-amber-500/10 dark:to-orange-500/5 rounded-sm" />
                      )}

                      {/* Hot slot badge */}
                      {hot && (
                        <div className="absolute top-0 right-0.5 z-10">
                          <Flame className="w-2.5 h-2.5 text-amber-500 drop-shadow" />
                        </div>
                      )}

                      {/* Participant color dots & Blank Dot */}
                      <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-1">
                        {/* Blank dot for unselected state (helps user understand it's clickable) */}
                        {!isSelected && inRange && othersInCell.length === 0 && (
                          <div className="w-2.5 h-2.5 rounded-full border border-gray-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 group-hover:border-rose-300 dark:group-hover:border-rose-600 transition-colors" />
                        )}

                        {othersInCell.slice(0, 4).map((p) => {
                          const c = colorMap.current.get(p.userId);
                          return (
                            <div
                              key={p.userId}
                              className="w-2 h-2 rounded-full shrink-0 opacity-80"
                              style={{ backgroundColor: c?.dot }}
                              title={p.name}
                            />
                          );
                        })}
                        {isSelected && (
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white dark:ring-zinc-900"
                            style={{ backgroundColor: myColor?.dot }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Hover tooltip showing who selected */}
                    {cellParticipants.length > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                        <div className="bg-gray-900 text-white text-[9px] rounded-lg px-2 py-1 whitespace-nowrap shadow-xl">
                          {cellParticipants.map((p) => p.name.split(" ")[0]).join(", ")}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400 dark:text-zinc-500 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800" />
          <span>Click to select</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-rose-500 ring-1 ring-rose-300" />
          <span>Your selection</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-pink-500" />
          <span>Panel member</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3 h-3 text-amber-500" />
          <span>All available = hot slot</span>
        </div>
      </div>

      </div>

      {/* ── Right Column: Command Center ─────────────────────────────────── */}
      <div className="w-full shrink-0 space-y-6 lg:sticky lg:top-24" style={{ maxWidth: '320px' }}>
      {/* ── Panel Progress ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Panel Progress</p>
          <span className="text-xs text-gray-500 dark:text-zinc-400">
            {submittedCount} of {participants.length} responded
            {lastUpdate && <span className="ml-1 opacity-50">· {lastUpdate}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {participants.map((p) => {
            const color = colorMap.current.get(p.userId) ?? PARTICIPANT_COLORS[0];
            return (
              <div key={p.userId} className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 relative
                    ${color.bg} ${p.isMe ? `ring-2 ${color.ring} ring-offset-1 ring-offset-white dark:ring-offset-zinc-900` : ""}
                  `}
                >
                  {p.name[0]?.toUpperCase()}
                  {p.hasSubmitted && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </div>
                <span className={`text-xs font-semibold ${p.hasSubmitted ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-zinc-400"}`}>
                  {p.name.split(" ")[0]}{p.isMe ? " (You)" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-500"
            style={{ width: `${(submittedCount / participants.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── My Progress ──────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Your Selection</p>
            <p className={`text-xs mt-0.5 font-semibold transition-colors ${
              myCount === 0 ? "text-gray-400 dark:text-zinc-500"
              : myCount < minRequired ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {myCount === 0
                ? `Select at least ${minRequired} slots to help the team align`
                : myCount < minRequired
                ? `${minRequired - myCount} more slot${minRequired - myCount !== 1 ? "s" : ""} to go…`
                : myCount >= 10
                ? `🌟 Great coverage — the AI loves more options!`
                : `✅ You're set! Submit when ready.`}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-4 transition-all duration-300 ${
            meetsMin
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
              : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
          }`}>
            {myCount}/{minRequired}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              meetsMin
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-amber-400 to-amber-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Override checkbox */}
        {!meetsMin && (
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={overrideMinSlots}
              onChange={(e) => setOverrideMinSlots(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-amber-500 rounded"
            />
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed group-hover:text-gray-700 dark:group-hover:text-zinc-300">
              I have fewer than {minRequired} available slots in this window
            </span>
          </label>
        )}

        {/* Override warning */}
        {overrideMinSlots && !meetsMin && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Submitting with fewer than {minRequired} slots may reduce overlap. The recruiter will be notified.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-semibold">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isExpiredOrCanceled}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm
            ${canSubmit && !isExpiredOrCanceled
              ? "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-200 dark:shadow-none hover:shadow-md active:scale-[0.98]"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed"
            }`}
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Submitting…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Submit My Availability ({myCount} slot{myCount !== 1 ? "s" : ""})
            </>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
