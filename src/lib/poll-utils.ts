/**
 * Shared utilities for Smart Poll scheduling logic.
 */

/**
 * Adds N business weekdays (Mon–Fri) to a given date.
 * Used to compute the poll deadline.
 */
export function addWeekdays(date: Date, days: number): Date {
  let count = 0;
  const d = new Date(date);
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++; // skip Sun (0) and Sat (6)
  }
  return d;
}

/**
 * Returns true if the current UTC hour is within business hours (9am–5pm).
 * Used to gate hourly nudge emails.
 */
export function isBusinessHour(): boolean {
  const utcHour = new Date().getUTCHours();
  return utcHour >= 9 && utcHour < 17;
}

/**
 * Converts "HH:MM" time string to minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to "HH:MM" time string.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export interface TimeSlot {
  date: string;       // ISO date string e.g. "2026-04-21"
  startTime: string;  // "09:00"
  endTime: string;    // "09:30"
}

/**
 * Computes the intersection of all panelists' availability.
 * Returns common slots lasting at least `durationMinutes`.
 */
export function computeSlotIntersection(
  allPanelistSlots: TimeSlot[][],
  durationMinutes: number
): TimeSlot[] {
  if (allPanelistSlots.length === 0) return [];

  // Build: date → panelistIdx → Set of 30-min block start-minutes
  const dateMap = new Map<string, Map<number, Set<number>>>();

  allPanelistSlots.forEach((slots, panelistIdx) => {
    for (const slot of slots) {
      if (!dateMap.has(slot.date)) dateMap.set(slot.date, new Map());
      const pMap = dateMap.get(slot.date)!;
      if (!pMap.has(panelistIdx)) pMap.set(panelistIdx, new Set());

      const startMin = timeToMinutes(slot.startTime);
      const endMin   = timeToMinutes(slot.endTime);
      for (let m = startMin; m < endMin; m += 30) {
        pMap.get(panelistIdx)!.add(m);
      }
    }
  });

  const commonSlots: TimeSlot[] = [];
  const total = allPanelistSlots.length;

  for (const date of [...dateMap.keys()].sort()) {
    const pMap = dateMap.get(date)!;

    // Collect all blocks any panelist has
    const allBlocks = new Set<number>();
    pMap.forEach((blocks) => blocks.forEach((b) => allBlocks.add(b)));

    // Keep only blocks where ALL panelists are available
    const commonBlocks: number[] = [];
    for (const block of [...allBlocks].sort((a, b) => a - b)) {
      let allHave = true;
      for (let p = 0; p < total; p++) {
        if (!pMap.get(p)?.has(block)) { allHave = false; break; }
      }
      if (allHave) commonBlocks.push(block);
    }

    // Group consecutive common blocks into windows ≥ durationMinutes
    const blocksNeeded = Math.ceil(durationMinutes / 30);
    let windowStart = -1;
    let windowLen = 0;

    for (let i = 0; i < commonBlocks.length; i++) {
      if (windowStart === -1 || commonBlocks[i] !== commonBlocks[i - 1] + 30) {
        windowStart = commonBlocks[i];
        windowLen = 1;
      } else {
        windowLen++;
      }
      if (windowLen >= blocksNeeded) {
        commonSlots.push({
          date,
          startTime: minutesToTime(windowStart),
          endTime:   minutesToTime(windowStart + durationMinutes),
        });
        windowStart = -1;
        windowLen = 0;
      }
    }
  }

  return commonSlots;
}

/**
 * Score and rank common slots. Higher = better.
 * Prefers: morning slots, mid-week days, avoids Monday/Friday.
 */
export function rankCommonSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) => scoreSlot(b) - scoreSlot(a));
}

function scoreSlot(slot: TimeSlot): number {
  let score = 0;
  const d = new Date(slot.date);
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon ... 5=Fri, 6=Sat
  const startMin = timeToMinutes(slot.startTime);

  // Prefer mid-week (Tue=1pt, Wed=2pts, Thu=1pt)
  if (dow === 3) score += 2; // Wednesday
  if (dow === 2 || dow === 4) score += 1; // Tue / Thu
  // Penalise Monday and Friday slightly
  if (dow === 1 || dow === 5) score -= 1;

  // Prefer morning (9-11am = +2, 11-1pm = +1, afternoon = 0)
  if (startMin >= 540 && startMin < 660) score += 2;      // 9-11am
  else if (startMin >= 660 && startMin < 780) score += 1; // 11am-1pm

  return score;
}
