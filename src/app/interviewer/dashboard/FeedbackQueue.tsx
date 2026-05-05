"use client";

import { useState, useTransition } from "react";
function formatAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (diff < 60)   return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, ClipboardList } from "lucide-react";

interface FeedbackIV {
  id:            string;
  candidateName: string;
  positionTitle: string;
  positionId:    string;
  scheduledAt:   string;
}

interface Props {
  interviews: FeedbackIV[];
}

function urgencyClass(scheduledAt: string) {
  const hoursAgo = (Date.now() - new Date(scheduledAt).getTime()) / 3_600_000;
  if (hoursAgo > 48) return { badge: "text-red-400 bg-red-500/10 border-red-500/20",   label: "Overdue" };
  if (hoursAgo > 24) return { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: ">24h" };
  return                    { badge: "text-zinc-500 bg-zinc-800 border-zinc-700",        label: "Recent" };
}

function FeedbackCard({ iv, onSubmit }: { iv: FeedbackIV; onSubmit: (id: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [scores, setScores]   = useState({ technical: 0, communication: 0, problemSolving: 0, cultureFit: 0 });
  const [recommendation, setRec] = useState("HIRE");
  const [summary, setSummary] = useState("");
  const [submitting, start]   = useTransition();
  const [done, setDone]       = useState(false);

  const urg = urgencyClass(iv.scheduledAt);
  const overall = scores.technical + scores.communication + scores.problemSolving + scores.cultureFit;

  const handleSubmit = async () => {
    if (!summary.trim() || overall === 0) return;
    start(async () => {
      try {
        const res = await fetch(`/api/interviews/${iv.id}/panelist-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicalScore:      scores.technical,
            communicationScore:  scores.communication,
            problemSolvingScore: scores.problemSolving,
            cultureFitScore:     scores.cultureFit,
            overallScore:        Math.round((overall / 40) * 100),
            recommendation,
            summary,
          }),
        });
        if (res.ok) { setDone(true); setTimeout(() => onSubmit(iv.id), 600); }
      } catch { /* handle gracefully */ }
    });
  };

  if (done) return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-out fade-out duration-500">
      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      <p className="text-sm font-bold text-emerald-400">Feedback submitted for {iv.candidateName}</p>
    </div>
  );

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${open ? "border-zinc-700" : "border-zinc-800"} bg-zinc-900/40`}>
      {/* Header row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{iv.candidateName}</p>
            <p className="text-xs text-zinc-500 truncate">{iv.positionTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${urg.badge}`}>
            {urg.label}
          </span>
          <span className="text-[10px] text-zinc-600">{formatAgo(iv.scheduledAt)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {/* Inline feedback form */}
      {open && (
        <div className="border-t border-zinc-800 px-5 py-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Score sliders */}
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: "technical",      label: "Technical" },
              { key: "communication",  label: "Communication" },
              { key: "problemSolving", label: "Problem Solving" },
              { key: "cultureFit",     label: "Culture Fit" },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
                  <span className={`text-xs font-black ${scores[key] >= 7 ? "text-emerald-400" : scores[key] >= 5 ? "text-amber-400" : "text-red-400"}`}>
                    {scores[key] > 0 ? `${scores[key]}/10` : "—"}
                  </span>
                </div>
                <input
                  type="range" min={0} max={10}
                  value={scores[key]}
                  onChange={(e) => setScores((s) => ({ ...s, [key]: +e.target.value }))}
                  className="w-full h-1.5 rounded-full accent-rose-500 cursor-pointer bg-zinc-800"
                />
              </div>
            ))}
          </div>

          {/* Overall pill */}
          {overall > 0 && (
            <div className="text-center">
              <span className="text-xs text-zinc-500">Overall: </span>
              <span className={`text-sm font-black ${
                overall >= 32 ? "text-emerald-400" : overall >= 20 ? "text-amber-400" : "text-red-400"
              }`}>{Math.round((overall / 40) * 100)}/100</span>
            </div>
          )}

          {/* Recommendation */}
          <div className="flex gap-2 flex-wrap">
            {["STRONG_HIRE", "HIRE", "NO_HIRE", "STRONG_NO_HIRE"].map((r) => (
              <button
                key={r}
                onClick={() => setRec(r)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                  recommendation === r
                    ? r.includes("NO_HIRE") ? "bg-red-500 border-red-500 text-white" : "bg-emerald-500 border-emerald-500 text-black"
                    : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {r.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Summary */}
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary for the hiring manager (required)…"
            rows={2}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-700 resize-none focus:outline-none focus:border-rose-500 transition-colors"
          />

          <button
            onClick={handleSubmit}
            disabled={!summary.trim() || overall === 0 || submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Submit Feedback</>}
          </button>
        </div>
      )}
    </div>
  );
}

export function FeedbackQueue({ interviews }: Props) {
  const [list, setList] = useState(interviews);

  const remove = (id: string) => setList((l) => l.filter((iv) => iv.id !== id));

  if (list.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
          <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Feedback Due
          <span className="ml-2 text-amber-400">{list.length}</span>
        </h2>
      </div>
      <div className="space-y-2">
        {list.map((iv) => (
          <FeedbackCard key={iv.id} iv={iv} onSubmit={remove} />
        ))}
      </div>
    </div>
  );
}
