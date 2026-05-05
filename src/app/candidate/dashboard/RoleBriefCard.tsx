import { Calendar, Clock, Users, Briefcase } from "lucide-react";
import { formatDate, formatTime } from "@/lib/locale-utils"

interface Props {
  positionTitle:   string;
  roundLabel:      string;
  interviewerNames: string[];
  durationMinutes: number;
  scheduledAt:     string;
  completedRounds: number;
  totalRounds:     number;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-rose-600", "bg-pink-600", "bg-rose-600",
  "bg-amber-600",  "bg-rose-600",   "bg-sky-600",
];

export function RoleBriefCard({
  positionTitle, roundLabel, interviewerNames,
  durationMinutes, scheduledAt, completedRounds, totalRounds,
}: Props) {
  const date = new Date(scheduledAt);
  const dateStr = formatDate(date);
  const timeStr = formatTime(date, { showTimezone: false });

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6 space-y-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
          <Briefcase className="w-4 h-4 text-rose-400" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Role Brief</h2>
      </div>

      {/* Role + Round */}
      <div>
        <h3 className="text-xl font-black text-white leading-tight">{positionTitle}</h3>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/15 border border-rose-500/25 text-rose-400 text-xs font-bold">
          {roundLabel}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Calendar className="w-4 h-4 text-zinc-600 shrink-0" />
          <span>{dateStr} · {timeStr}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <Clock className="w-4 h-4 text-zinc-600 shrink-0" />
          <span>{durationMinutes} minutes</span>
        </div>
        {interviewerNames.length > 0 && (
          <div className="flex items-start gap-3 text-sm text-zinc-400">
            <Users className="w-4 h-4 text-zinc-600 shrink-0 mt-1" />
            <div className="flex flex-wrap gap-2">
              {interviewerNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-[9px] font-black text-white shrink-0`}>
                    {initials(name)}
                  </div>
                  <span className="text-white text-xs font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalRounds > 1 && (
        <div className="pt-3 border-t border-zinc-800/60">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">
            Interview {completedRounds + 1} of {totalRounds}
          </p>
          <div className="flex gap-1">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i < completedRounds  ? "bg-rose-600" :
                  i === completedRounds ? "bg-rose-400" :
                                         "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
