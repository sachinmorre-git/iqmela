"use client";

import { useState, useTransition, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { submitAvailabilitySlotsAction } from "@/app/org-admin/positions/[id]/poll-actions";
import { formatDate, formatTime } from "@/lib/locale-utils"

interface SlotPickerGridProps {
  token: string;
  dateStart: string;
  dateEnd: string;
  durationMinutes: number;
}

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
}

const HOUR_START = 8;  // 8 AM
const HOUR_END = 20;   // 8 PM
const BLOCK_MINUTES = 30;

export function SlotPickerGrid({ token, dateStart, dateEnd, durationMinutes }: SlotPickerGridProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate dates between dateStart and dateEnd
  const dates = useMemo(() => {
    const result: string[] = [];
    const start = new Date(dateStart + "T00:00:00");
    const end = new Date(dateEnd + "T00:00:00");
    while (start <= end) {
      result.push(start.toISOString().split("T")[0]);
      start.setDate(start.getDate() + 1);
    }
    return result;
  }, [dateStart, dateEnd]);

  // Generate time blocks for a day
  const timeBlocks = useMemo(() => {
    const blocks: { time: string; label: string }[] = [];
    for (let hour = HOUR_START; hour < HOUR_END; hour++) {
      for (let min = 0; min < 60; min += BLOCK_MINUTES) {
        const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        const label = formatTime(new Date(`2000-01-01T${time}`), { showTimezone: false });
        blocks.push({ time, label });
      }
    }
    return blocks;
  }, []);

  const blockKey = (date: string, time: string) => `${date}|${time}`;

  const toggleBlock = (date: string, time: string) => {
    const key = blockKey(date, time);
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Convert selected blocks to TimeSlot[] for submission
  const slotsFromBlocks = (): TimeSlot[] => {
    const slotsByDate = new Map<string, string[]>();
    
    selectedBlocks.forEach((key) => {
      const [date, time] = key.split("|");
      if (!slotsByDate.has(date)) slotsByDate.set(date, []);
      slotsByDate.get(date)!.push(time);
    });

    const slots: TimeSlot[] = [];
    slotsByDate.forEach((times, date) => {
      times.sort();
      for (const startTime of times) {
        const [h, m] = startTime.split(":").map(Number);
        const endMin = h * 60 + m + BLOCK_MINUTES;
        const endTime = `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`;
        slots.push({ date, startTime, endTime });
      }
    });

    return slots;
  };

  const handleSubmit = () => {
    if (selectedBlocks.size === 0) {
      setError("Select at least one time slot");
      return;
    }
    setError(null);
    startTransition(async () => {
      const slots = slotsFromBlocks();
      const res = await submitAvailabilitySlotsAction(token, slots);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Failed to submit");
      }
    });
  };

  if (success) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-8 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Availability Submitted!</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Thanks! We&apos;ll find a common time that works for everyone and notify you when it&apos;s confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Instructions */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Tap the blocks when you&apos;re available
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Select all 30-min windows that work for you. We need at least {Math.ceil(durationMinutes / 30)} consecutive block(s).
        </p>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Date Headers */}
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}>
            <div className="px-2 py-3 text-[10px] font-bold text-gray-400 uppercase" />
            {dates.map((d) => (
              <div key={d} className="px-2 py-3 text-center border-l border-gray-50 dark:border-zinc-800">
                <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase">
                  {formatDate(new Date(d + "T12:00:00"))}
                </p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {formatDate(new Date(d + "T12:00:00"))}
                </p>
              </div>
            ))}
          </div>

          {/* Time Rows */}
          {timeBlocks.map(({ time, label }) => (
            <div
              key={time}
              className="grid border-t border-gray-50 dark:border-zinc-800/50"
              style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}
            >
              <div className="px-2 py-1.5 flex items-center">
                <span className="text-[10px] text-gray-400 font-mono">{label}</span>
              </div>
              {dates.map((d) => {
                const key = blockKey(d, time);
                const isSelected = selectedBlocks.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleBlock(d, time)}
                    className={`h-8 border-l border-gray-50 dark:border-zinc-800/50 transition-all duration-100 ${
                      isSelected
                        ? "bg-rose-500 hover:bg-rose-600"
                        : "bg-transparent hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    }`}
                    title={`${d} ${label}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          {selectedBlocks.size} slot{selectedBlocks.size !== 1 ? "s" : ""} selected
        </p>

        {error && <p className="text-xs text-red-500 mr-2">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || selectedBlocks.size === 0}
          className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…
            </>
          ) : (
            "✓ Submit Availability"
          )}
        </button>
      </div>
    </div>
  );
}
