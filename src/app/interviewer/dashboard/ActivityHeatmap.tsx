"use client";

import { useMemo } from "react";
import { formatDate } from "@/lib/locale-utils"

interface Props {
  countsByDate: Record<string, number>;
  startDate:    string;
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function getCellColor(count: number): string {
  if (count === 0) return "bg-zinc-900 border-zinc-800";
  if (count === 1) return "bg-rose-900/60 border-rose-700/40";
  if (count === 2) return "bg-rose-700/70 border-rose-600/50";
  return                  "bg-rose-500 border-rose-400/60";
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function ActivityHeatmap({ countsByDate, startDate }: Props) {
  const weeks = useMemo(() => {
    const start = new Date(startDate);
    // rewind to Sunday
    start.setDate(start.getDate() - start.getDay());
    const cells: { key: string; count: number; date: Date }[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 12; w++) {
      const week: { key: string; count: number; date: Date }[] = [];
      for (let d = 0; d < 7; d++) {
        const key   = toKey(cur);
        const count = countsByDate[key] ?? 0;
        week.push({ key, count, date: new Date(cur) });
        cur.setDate(cur.getDate() + 1);
      }
      cells.push(week);
    }
    return cells;
  }, [countsByDate, startDate]);

  const months = useMemo(() => {
    const seen = new Set<string>();
    return weeks.map((wk) => {
      const lbl = formatDate(wk[0].date, { style: "short" }).split(" ")[0];
      if (seen.has(lbl)) return "";
      seen.add(lbl);
      return lbl;
    });
  }, [weeks]);

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-5">12-Week Activity</h2>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1 min-w-0">
          {/* Month labels */}
          <div className="flex gap-1 pl-5">
            {weeks.map((_, wi) => (
              <div key={wi} className="w-4 text-[9px] text-zinc-600 font-bold text-center">
                {months[wi]}
              </div>
            ))}
          </div>

          {/* Grid: days as rows, weeks as columns */}
          {DAYS.map((day, di) => (
            <div key={di} className="flex items-center gap-1">
              <span className="w-4 text-[9px] text-zinc-700 font-bold text-right shrink-0">{day}</span>
              {weeks.map((wk, wi) => {
                const cell = wk[di];
                const isFuture = cell.date > new Date();
                return (
                  <div
                    key={wi}
                    title={isFuture ? "" : `${cell.key}: ${cell.count} interview${cell.count !== 1 ? "s" : ""}`}
                    className={`w-4 h-4 rounded-sm border transition-all cursor-default ${
                      isFuture ? "bg-zinc-950 border-zinc-900 opacity-30" : getCellColor(cell.count)
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-600">
        <span>Less</span>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className={`w-3.5 h-3.5 rounded-sm border ${getCellColor(n)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
