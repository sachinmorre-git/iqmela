/**
 * signalBuffer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory ring buffer that accumulates all behavioral signals captured during
 * a live interview session. Signals are:
 *   • Pushed every frame (gaze zone, head pitch, emotion blendshapes)
 *   • Summarised every 10s for the live Data Channel snapshot
 *   • Flushed in full at session end → uploaded to Vercel Blob
 */

export type GazeZone = "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN";
export type PostureLabel = "UPRIGHT" | "DOWN";
export type PaceLabel = "SLOW" | "NORMAL" | "FAST" | "SILENT";
export type GazeLabel = "FOCUSED" | "SLIGHTLY_OFF" | "DISTRACTED";

export type SignalType =
  | "GAZE_ZONE"
  | "HEAD_DOWN"
  | "ENGAGEMENT"
  | "COMPOSURE"
  | "PACE"
  | "SILENCE_GAP"
  | "VIOLATION";

export interface SessionSignal {
  ts:    number;       // ms from session start
  type:  SignalType;
  value: any;
}

/** Simplified snapshot sent to interviewer via Data Channel every 10s */
export interface LiveSnapshot {
  gaze:       { pct: number; label: GazeLabel };
  posture:    { label: PostureLabel };
  pace:       { wpm: number; label: PaceLabel };
  pauses:     number;   // total silence gaps so far this session
  violations: number;   // total violations so far
}

const MAX_ENTRIES = 5000;

export class SignalBuffer {
  private signals:   SessionSignal[] = [];
  private startTime: number          = Date.now();

  // Rolling buffers for live label computation
  private gazeWindow:    GazeZone[] = [];   // last 180 frames
  private headDownCount: number      = 0;   // frames currently looking down
  private currentPaceWpm: number     = 120; // last computed WPM
  private totalSilences: number      = 0;
  private totalViolations: number    = 0;

  // ── Push a single signal ──────────────────────────────────────────────────
  push(type: SignalType, value: any): void {
    this.signals.push({ ts: Date.now() - this.startTime, type, value });
    if (this.signals.length > MAX_ENTRIES) this.signals.shift();

    // Maintain rolling counters for snapshot
    if (type === "GAZE_ZONE") {
      this.gazeWindow = [...this.gazeWindow.slice(-179), value as GazeZone];
    }
    if (type === "SILENCE_GAP")  this.totalSilences++;
    if (type === "VIOLATION")     this.totalViolations++;
    if (type === "PACE")          this.currentPaceWpm = value?.wpm ?? this.currentPaceWpm;
  }

  // ── Track head-down frame count (caller increments/resets each frame) ──────
  setHeadDownCount(n: number): void { this.headDownCount = n; }

  // ── Compute gaze label from rolling window ────────────────────────────────
  private gazeLabel(): GazeLabel {
    if (this.gazeWindow.length === 0) return "FOCUSED";
    const pct = this.gazeWindow.filter(z => z === "CENTER").length / this.gazeWindow.length;
    if (pct >= 0.70) return "FOCUSED";
    if (pct >= 0.45) return "SLIGHTLY_OFF";
    return "DISTRACTED";
  }

  private gazePct(): number {
    if (this.gazeWindow.length === 0) return 1;
    return this.gazeWindow.filter(z => z === "CENTER").length / this.gazeWindow.length;
  }

  private paceLabel(wpm: number): PaceLabel {
    if (wpm === 0)    return "SILENT";
    if (wpm < 80)     return "SLOW";
    if (wpm <= 180)   return "NORMAL";
    return "FAST";
  }

  // ── Snapshot for Data Channel ────────────────────────────────────────────
  snapshot(): LiveSnapshot {
    return {
      gaze:       { pct: this.gazePct(), label: this.gazeLabel() },
      posture:    { label: this.headDownCount > 0 ? "DOWN" : "UPRIGHT" },
      pace:       { wpm: this.currentPaceWpm, label: this.paceLabel(this.currentPaceWpm) },
      pauses:     this.totalSilences,
      violations: this.totalViolations,
    };
  }

  // ── Flush all signals for post-session upload ────────────────────────────
  flush(): { startedAt: string; durationMs: number; signals: SessionSignal[] } {
    return {
      startedAt:  new Date(this.startTime).toISOString(),
      durationMs: Date.now() - this.startTime,
      signals:    [...this.signals],
    };
  }

  size(): number { return this.signals.length; }
}
