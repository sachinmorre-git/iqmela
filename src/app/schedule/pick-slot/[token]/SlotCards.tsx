"use client";

import { useState, useTransition } from "react";
import { Loader2, Calendar, Clock } from "lucide-react";
import { confirmSlotAction } from "@/app/org-admin/positions/[id]/poll-actions";
import { formatDate, formatTime, formatDateTime } from "@/lib/locale-utils"

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

interface SlotCardsProps {
  slots: Slot[];
  durationMinutes: number;
  candidateToken: string;
}

export function SlotCards({ slots, durationMinutes, candidateToken }: SlotCardsProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = (slot: Slot) => {
    setSelectedSlot(slot);
    setError(null);
    startTransition(async () => {
      const res = await confirmSlotAction(candidateToken, slot);
      if (res.success) {
        const date = new Date(`${slot.date}T${slot.startTime}:00`);
        setConfirmedDate(
          formatDateTime(date)
        );
        setConfirmed(true);
      } else {
        setError(res.error || "Failed to confirm");
        setSelectedSlot(null);
      }
    });
  };

  if (confirmed) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-8 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Interview Confirmed!</h2>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">📅 {confirmedDate}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Duration: {durationMinutes} min</p>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Confirmation emails have been sent to you and the interview panel. See you there!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {slots.map((slot, i) => {
        const date = new Date(`${slot.date}T${slot.startTime}:00`);
        const dayLabel = formatDate(date);
        const timeLabel = formatTime(date, { showTimezone: false });
        const isSelecting = selectedSlot === slot;

        return (
          <div
            key={i}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{dayLabel}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {timeLabel} • {durationMinutes} min
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleConfirm(slot)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isSelecting && isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…</>
                ) : (
                  "Select"
                )}
              </button>
            </div>
          </div>
        );
      })}

      {/* Can't make it */}
      <div className="text-center pt-4">
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Can&apos;t make any of these times?{" "}
          <button type="button" className="text-rose-600 dark:text-rose-400 font-semibold hover:underline">
            Request more options
          </button>
        </p>
      </div>
    </div>
  );
}
