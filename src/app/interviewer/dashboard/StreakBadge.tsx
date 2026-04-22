import { Flame } from "lucide-react";

interface Props { streak: number }

export function StreakBadge({ streak }: Props) {
  if (streak === 0) return null;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
      streak >= 10
        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
        : streak >= 5
        ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
        : "bg-zinc-800/60 border-zinc-700 text-zinc-400"
    }`}>
      <Flame className={`w-4 h-4 ${streak >= 5 ? "text-amber-400" : "text-zinc-500"}`} />
      <span className="text-sm font-black">{streak}</span>
      <span className="text-xs font-medium opacity-70 hidden sm:block">on-time streak</span>
    </div>
  );
}
