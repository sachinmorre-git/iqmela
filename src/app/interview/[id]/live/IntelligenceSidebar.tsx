"use client";

import React, { useState, useEffect, useRef } from "react";
import { PenLine, Save, BrainCircuit, ShieldAlert, Zap, Eye, PersonStanding, Mic, Pause, WifiOff } from "lucide-react";
import { saveInterviewNotes, generateInterviewerQuestions } from "./actions";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Button } from "@/components/ui/button";
import type { LiveSnapshot } from "./signalBuffer";
import { formatTime } from "@/lib/locale-utils"

export function IntelligenceSidebar({ interviewId, initialNotes }: { interviewId: string, initialNotes: string }) {
  const [activeTab, setActiveTab] = useState<'NOTES' | 'INTELLIGENCE'>('NOTES');
  
  // Tab 1: Notes State
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Auto-save debouncer for Private Notes
  useEffect(() => {
    if (notes === initialNotes) return; 
    
    const handler = setTimeout(async () => {
      setIsSaving(true);
      try {
         await saveInterviewNotes(interviewId, notes);
         setLastSaved(new Date());
      } catch (err) {
         console.error("Failed to save notes remotely", err);
      } finally {
         setIsSaving(false);
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [notes, interviewId, initialNotes]);


  // Tab 2: Intelligence & HUD State
  const [prepData, setPrepData]     = useState<any>(null);
  const [isLoadingPrep, setIsLoadingPrep] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [violations, setViolations] = useState<Record<string, number>>({});

  // Live Signals from candidate's signal buffer (via Data Channel)
  const [liveSignals, setLiveSignals]   = useState<LiveSnapshot | null>(null);
  const [signalStale, setSignalStale]   = useState(false);
  const signalTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Map WebRTC LiveKit Data Channels to the Proctor HUD
  const room = useRoomContext();
  
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant: any) => {
      const str = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(str);
        if (data.type === "PROCTOR_VIOLATION") {
           console.warn(`🚨 PROCTOR VIOLATION INTERCEPTED: ${data.violationType} | ${data.message}`);
           setViolations(prev => ({
             ...prev,
             [data.violationType]: (prev[data.violationType] || 0) + 1
           }));
           // Force focus back to Intelligence Tab so Interviewer sees it immediately!
           setActiveTab('INTELLIGENCE');
        }
        // ── Live Signals from candidate signal engine ──────────────────────
        if (data.type === "LIVE_SIGNALS") {
          const { type: _t, ...snapshot } = data;
          setLiveSignals(snapshot as LiveSnapshot);
          setSignalStale(false);
          // Reset staleness timer (30s = signal lost if no update)
          if (signalTimer.current) clearTimeout(signalTimer.current);
          signalTimer.current = setTimeout(() => setSignalStale(true), 30_000);
        }
      } catch (err) {}
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      if (signalTimer.current) clearTimeout(signalTimer.current);
    };
  }, [room]);


  const loadIntelligence = async () => {
    setIsLoadingPrep(true);
    setErrorMsg(null);
    try {
       const res = await generateInterviewerQuestions(interviewId);
       setPrepData(res);
    } catch (err: any) {
       setErrorMsg(err.message || "Failed to generate AI data. Ensure Resume is uploaded and extracted.");
    } finally {
       setIsLoadingPrep(false);
    }
  };

  return (
    <div className="w-[380px] h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-50 shrink-0 shadow-2xl">
      
      {/* Sidebar Header & Tab Navigation */}
      <div className="flex flex-col shrink-0 border-b border-zinc-800 bg-black/40 pt-4 px-4 gap-4">
        <h2 className="font-black text-xl text-white tracking-tight flex items-center gap-2 px-2">
          <BrainCircuit className="w-6 h-6 text-rose-500" />
          Command Center
        </h2>
        
        <div className="flex gap-2 w-full p-1 bg-zinc-900 rounded-xl mb-4 border border-zinc-800">
           <button 
             onClick={() => setActiveTab('NOTES')}
             className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'NOTES' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <PenLine className="w-4 h-4" /> Notes
           </button>
           <button 
             onClick={() => setActiveTab('INTELLIGENCE')}
             className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 relative ${activeTab === 'INTELLIGENCE' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             <Zap className="w-4 h-4" /> Copilot
             {Object.keys(violations).length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
           </button>
        </div>
      </div>

      {/* Primary Content Render */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        
        {activeTab === 'NOTES' && (
          <textarea 
            className="w-full h-full p-6 bg-transparent text-sm text-zinc-300 resize-none focus:outline-none placeholder:text-zinc-700 leading-relaxed"
            placeholder="Start typing your evaluation context here...&#10;&#10;These notes are totally invisible to the candidate and are violently persistent to your Postgres database in the background."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}

        {activeTab === 'INTELLIGENCE' && (
          <div className="w-full h-full flex flex-col p-6 gap-6">
             
             {/* ── INTERVIEW PROGRESS TRACKER ────────────────────────── */}
             <InterviewProgress />

             {/* ── CANDIDATE PULSE RING ───────────────────────────────── */}
             {liveSignals && !signalStale && (
               <CandidatePulseRing signals={liveSignals} />
             )}

             {/* ── LIVE SIGNALS PANEL ───────────────────────────────────── */}
             {(liveSignals || signalStale) && (
               <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40 animate-in fade-in duration-500">
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-zinc-400 font-extrabold uppercase tracking-widest text-[10px]">Live Signals</h3>
                   {signalStale ? (
                     <span className="flex items-center gap-1 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                       <WifiOff className="w-3 h-3" /> Signal lost
                     </span>
                   ) : (
                     <span className="text-[9px] text-zinc-600 font-medium">Updates every 10s</span>
                   )}
                 </div>
                 {liveSignals && !signalStale && (
                   <div className="space-y-2">
                     {/* Gaze */}
                     <SignalRow
                       icon={<Eye className="w-3.5 h-3.5" />}
                       label="Gaze"
                       value={liveSignals.gaze.label === "FOCUSED" ? "Focused" : liveSignals.gaze.label === "SLIGHTLY_OFF" ? "Slightly off" : "Distracted"}
                       color={liveSignals.gaze.label === "FOCUSED" ? "green" : liveSignals.gaze.label === "SLIGHTLY_OFF" ? "yellow" : "red"}
                     />
                     {/* Posture */}
                     <SignalRow
                       icon={<PersonStanding className="w-3.5 h-3.5" />}
                       label="Posture"
                       value={liveSignals.posture.label === "UPRIGHT" ? "Upright" : "Looking down"}
                       color={liveSignals.posture.label === "UPRIGHT" ? "green" : "yellow"}
                     />
                     {/* Pace */}
                     <SignalRow
                       icon={<Mic className="w-3.5 h-3.5" />}
                       label="Pace"
                       value={liveSignals.pace.label === "NORMAL" ? "Normal" : liveSignals.pace.label === "FAST" ? "Fast" : liveSignals.pace.label === "SLOW" ? "Slow" : "Silent"}
                       color={liveSignals.pace.label === "NORMAL" ? "green" : liveSignals.pace.label === "SILENT" ? "red" : "yellow"}
                     />
                     {/* Pauses */}
                     <SignalRow
                       icon={<Pause className="w-3.5 h-3.5" />}
                       label="Pauses"
                       value={liveSignals.pauses === 0 ? "None" : `${liveSignals.pauses} gap${liveSignals.pauses !== 1 ? "s" : ""}`}
                       color={liveSignals.pauses === 0 ? "green" : liveSignals.pauses >= 5 ? "red" : "yellow"}
                     />
                   </div>
                 )}
               </div>
             )}

             {/* ⚠️ LIVE PROCTOR HUD */}
             {Object.keys(violations).length > 0 && (
               <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 animate-in fade-in slide-in-from-top-4">
                 <h3 className="text-red-500 font-extrabold uppercase tracking-widest text-[10px] mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> Live Proctor Violations
                 </h3>
                 <div className="space-y-2">
                   {Object.entries(violations).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-red-500/10">
                        <span className="text-xs font-semibold text-zinc-300">{type.replace(/_/g, " ")}</span>
                        <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(239,68,68,0.4)]">{count}x</span>
                      </div>
                   ))}
                 </div>
               </div>
             )}

             {/* Intelligence Generation Trigger */}
             {!prepData && !isLoadingPrep && (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4 border border-zinc-800 rounded-3xl bg-zinc-900/30">
                  <BrainCircuit className="w-10 h-10 text-rose-500/50 mb-4" />
                  <h3 className="text-white font-bold mb-2">Initialize AI Copilot</h3>
                  <p className="text-xs text-zinc-500 mb-6 font-medium">Dynamically cross-reference the Job Description against the Candidate's exact Resume footprint to generate targeted probing questions.</p>
                  <Button onClick={loadIntelligence} className="w-full bg-white text-black hover:bg-zinc-200 font-bold shadow-lg">
                    Generate Context
                  </Button>
                  {errorMsg && <p className="text-red-400 text-xs mt-4 font-semibold">{errorMsg}</p>}
                </div>
             )}

             {isLoadingPrep && (
               <div className="flex flex-col items-center justify-center py-12 gap-4">
                 <div className="w-8 h-8 rounded-full border-4 border-zinc-800 border-t-rose-500 animate-spin"></div>
                 <p className="text-xs text-rose-400 font-bold uppercase tracking-widest animate-pulse">Running Neural Pipeline...</p>
               </div>
             )}

             {prepData && (
                <div className="space-y-8 animate-in fade-in pb-8">
                  {/* Match Readout */}
                  <div>
                    <h3 className="text-zinc-500 font-extrabold uppercase tracking-widest text-[10px] mb-3">AI Verdict</h3>
                    <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                      <span className="font-semibold text-sm text-zinc-300">{prepData.ranking.matchLabel.replace(/_/g, " ")}</span>
                      <span className={`font-black text-xl ${prepData.ranking.matchScore >= 80 ? 'text-emerald-500' : prepData.ranking.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {prepData.ranking.matchScore}%
                      </span>
                    </div>
                  </div>

                  {/* Missing Skills Mapping */}
                  {prepData.ranking.missingSkills?.length > 0 && (
                    <div>
                      <h3 className="text-zinc-500 font-extrabold uppercase tracking-widest text-[10px] mb-3">Identified Skill Gaps</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {prepData.ranking.missingSkills.map((gap: string) => (
                          <span key={gap} className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold rounded uppercase tracking-wide">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated Questions */}
                  <div>
                    <h3 className="text-zinc-500 font-extrabold uppercase tracking-widest text-[10px] mb-3 flex justify-between items-center">
                      Live Recommended Questions
                      <span className="bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30">Auto-Generated</span>
                    </h3>
                    <div className="space-y-4">
                      {prepData.prep?.questions?.map((q: any, i: number) => (
                        <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                           <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1.5 block">{q.category}</span>
                           <p className="text-sm text-white font-medium mb-3 leading-snug">{q.question}</p>
                           <p className="text-xs text-zinc-500 font-medium italic border-l-2 border-zinc-700 pl-2">Rationale: {q.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
             )}

          </div>
        )}
      </div>

      {/* Universal Footer Sync UI */}
      {activeTab === 'NOTES' && (
        <div className="h-12 border-t border-zinc-800 flex items-center justify-between px-6 bg-black/40 shrink-0">
          {isSaving ? (
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin"></span> Syncing to Cloud...
            </span>
          ) : lastSaved ? (
             <span className="text-xs font-semibold text-green-500/80 flex items-center gap-2">
              <Save className="w-3 h-3" /> Saved {formatTime(lastSaved, { showTimezone: false })}
            </span>
          ) : (
            <span className="text-xs font-medium text-zinc-600 flex items-center gap-2">
              <Save className="w-3 h-3" /> Waiting to sync...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── SignalRow helper ───────────────────────────────────────────────────────────
function SignalRow({
  icon, label, value, color,
}: {
  icon:  React.ReactNode;
  label: string;
  value: string;
  color: "green" | "yellow" | "red";
}) {
  const dotColor = color === "green" ? "bg-emerald-400" : color === "yellow" ? "bg-amber-400" : "bg-red-400";
  const textColor = color === "green" ? "text-emerald-400" : color === "yellow" ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-zinc-800/60">
      <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
        <span className="text-zinc-600">{icon}</span>
        {label}
      </span>
      <span className={`flex items-center gap-1.5 text-xs font-bold ${textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {value}
      </span>
    </div>
  );
}

// ── InterviewProgress ──────────────────────────────────────────────────────────
function InterviewProgress() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const isLong = elapsed > 3600; // 1h+

  return (
    <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-400 font-extrabold uppercase tracking-widest text-[10px]">Interview Progress</h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLong ? "bg-amber-400" : "bg-emerald-400"}`} />
          <span className={`text-sm font-mono font-black tracking-wider ${isLong ? "text-amber-400" : "text-emerald-400"}`}>
            {mm}:{ss}
          </span>
        </div>
      </div>
      {/* Progress bar — assuming ~60 min interview */}
      <div className="mt-2.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${Math.min((elapsed / 3600) * 100, 100)}%`,
            background: isLong
              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
              : "linear-gradient(90deg, #10b981, #06b6d4)",
          }}
        />
      </div>
    </div>
  );
}

// ── CandidatePulseRing ─────────────────────────────────────────────────────────
function CandidatePulseRing({ signals }: { signals: LiveSnapshot }) {
  // Compute composite pulse score (0-100) from live signals
  const gazeScore = signals.gaze.label === "FOCUSED" ? 100 : signals.gaze.label === "SLIGHTLY_OFF" ? 60 : 20;
  const postureScore = signals.posture.label === "UPRIGHT" ? 100 : 40;
  const paceScore = signals.pace.label === "NORMAL" ? 100 : signals.pace.label === "SILENT" ? 10 : 60;
  const pauseScore = Math.max(0, 100 - signals.pauses * 15);

  const composite = Math.round((gazeScore * 0.3 + postureScore * 0.2 + paceScore * 0.3 + pauseScore * 0.2));
  const pulseColor = composite >= 75 ? "#10b981" : composite >= 45 ? "#f59e0b" : "#ef4444";
  const pulseLabel = composite >= 75 ? "Strong" : composite >= 45 ? "Moderate" : "Weak";
  const pulseTextColor = composite >= 75 ? "text-emerald-400" : composite >= 45 ? "text-amber-400" : "text-red-400";

  return (
    <div className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40 animate-in fade-in duration-500">
      <h3 className="text-zinc-400 font-extrabold uppercase tracking-widest text-[10px] mb-3">Candidate Pulse</h3>
      <div className="flex items-center gap-4">
        {/* Animated ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="5" className="stroke-zinc-800" />
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="5"
              strokeDasharray={`${composite * 2.51} 251`}
              strokeLinecap="round"
              style={{ stroke: pulseColor, transition: "stroke-dasharray 0.8s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-black ${pulseTextColor}`}>{composite}</span>
          </div>
          {/* Pulse animation */}
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ borderWidth: 2, borderColor: pulseColor, borderStyle: "solid" }}
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: pulseColor }} />
            <span className={`text-xs font-bold ${pulseTextColor}`}>{pulseLabel}</span>
          </div>
          {/* Mini breakdown */}
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: "Gaze", val: gazeScore },
              { label: "Posture", val: postureScore },
              { label: "Pace", val: paceScore },
              { label: "Pauses", val: pauseScore },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-1">
                <span className="text-[8px] text-zinc-600 w-10 shrink-0">{d.label}</span>
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${d.val}%`,
                    backgroundColor: d.val >= 75 ? "#10b981" : d.val >= 45 ? "#f59e0b" : "#ef4444",
                    transition: "width 0.5s ease-out",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
