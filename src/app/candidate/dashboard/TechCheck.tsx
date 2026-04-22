"use client";

import { useState } from "react";
import { Camera, Mic, Wifi, CheckCircle2, XCircle, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

type Status = "idle" | "checking" | "pass" | "fail";
interface Checks { camera: Status; mic: Status; connection: Status }

const ITEMS: { key: keyof Checks; label: string; icon: typeof Camera; hint: string }[] = [
  { key: "camera",     label: "Camera",      icon: Camera,  hint: "Interviewers need to see you clearly" },
  { key: "mic",        label: "Microphone",  icon: Mic,     hint: "Your voice must be captured without issues" },
  { key: "connection", label: "Connection",  icon: Wifi,    hint: "A stable internet ensures no lag or drops" },
];

export function TechCheck() {
  const [checks, setChecks] = useState<Checks>({ camera: "idle", mic: "idle", connection: "idle" });
  const [running, setRunning] = useState(false);

  const allPassed = checks.camera === "pass" && checks.mic === "pass" && checks.connection === "pass";
  const anyFailed = Object.values(checks).some((v) => v === "fail");
  const ran       = Object.values(checks).some((v) => v === "pass" || v === "fail");

  const set = (key: keyof Checks, val: Status) =>
    setChecks((prev) => ({ ...prev, [key]: val }));

  const runChecks = async () => {
    setRunning(true);
    setChecks({ camera: "checking", mic: "idle", connection: "idle" });

    // Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      set("camera", "pass");
    } catch { set("camera", "fail"); }

    await new Promise((r) => setTimeout(r, 400));
    set("mic", "checking");

    // Mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      set("mic", "pass");
    } catch { set("mic", "fail"); }

    await new Promise((r) => setTimeout(r, 400));
    set("connection", "checking");

    // Connection — ping attempt
    try {
      const t0  = performance.now();
      await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(3000) }).catch(() => {});
      const lat = performance.now() - t0;
      set("connection", lat < 4000 ? "pass" : "fail");
    } catch {
      set("connection", navigator.onLine ? "pass" : "fail");
    }

    setRunning(false);
  };

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tech Check</h2>
        </div>
        {allPassed && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">All systems go</span>
          </div>
        )}
        {anyFailed && ran && (
          <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
            Issues detected
          </span>
        )}
      </div>

      <div className="space-y-2.5 mb-5">
        {ITEMS.map(({ key, label, icon: Icon, hint }) => (
          <div key={key} className="flex items-center justify-between py-3 px-4 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">{label}</p>
                <p className="text-[10px] text-zinc-600 hidden sm:block">{hint}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {checks[key] === "idle"     && <span className="w-2 h-2 rounded-full bg-zinc-700" />}
              {checks[key] === "checking" && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
              {checks[key] === "pass"     && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {checks[key] === "fail"     && <XCircle className="w-4 h-4 text-red-400" />}
              <span className={`text-xs font-bold min-w-[70px] text-right ${
                checks[key] === "pass"     ? "text-emerald-400" :
                checks[key] === "fail"     ? "text-red-400"     :
                checks[key] === "checking" ? "text-zinc-400"    :
                                             "text-zinc-700"
              }`}>
                {checks[key] === "idle"     ? "—"          :
                 checks[key] === "checking" ? "Checking…"  :
                 checks[key] === "pass"     ? "Ready ✓"    :
                                              "Fix needed"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={runChecks}
        disabled={running}
        className="w-full py-3 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 hover:border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-teal-300 font-bold text-sm transition-all flex items-center justify-center gap-2"
      >
        {running
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Running checks…</>
          : ran
          ? <><RefreshCw className="w-4 h-4" /> Run Again</>
          : "Run Tech Check"}
      </button>
    </div>
  );
}
