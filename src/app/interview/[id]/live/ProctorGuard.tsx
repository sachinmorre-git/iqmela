"use client";

import React, { useEffect, useRef, useState } from "react";
import { reportProctorViolationAction } from "./proctorActions";
import { useLocalParticipant } from "@livekit/components-react";
import { Maximize } from "lucide-react";

export function ProctorGuard({ 
  children, 
  interviewId, 
  isCandidate 
}: { 
  children: React.ReactNode, 
  interviewId: string, 
  isCandidate: boolean 
}) {
  const { localParticipant } = useLocalParticipant();
  const reportQueue      = useRef(false);
  const fullscreenEscRef = useRef(0); // track escape count
  const [fsWarning, setFsWarning] = useState(false);
  const [activeViolation, setActiveViolation] = useState<{type: string, message: string} | null>(null);
  const [violationCount, setViolationCount] = useState(0);

  // ── Request fullscreen on mount (candidate only) ───────────────────────────
  useEffect(() => {
    if (!isCandidate) return;
    const req = () => document.documentElement.requestFullscreen().catch(() => {});
    req();
  }, [isCandidate]);

  useEffect(() => {
    // Only lock down the environment if this physical client belongs to the candidate
    if (!isCandidate) return;

    // 1. Defend against Context Switching (Navigating away from the Tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerViolation("TAB_SWITCH", "Candidate switched tabs or minimized the browser window.");
      }
    };

    // 2. Defend against Dual-Monitor Cheating (Clicking another application window)
    const handleBlur = () => {
       if (document.visibilityState === "visible") {
         triggerViolation("OUT_OF_FOCUS", "Candidate clicked away from the interview interface onto another window application.");
       }
    };

    // 3. Defend against AI Prompt Copying
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation("COPY_ATTEMPT", "Attempted to copy text from the platform.");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation("PASTE_ATTEMPT", "Attempted to paste external text into the platform.");
    };

    // 4. Defend against Right-Click Inspect Elements / Developer Tools bypasses
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerViolation("CONTEXT_MENU_ATTEMPT", "Attempted to open the Right-Click menu.");
    };

    // 5. ── Fullscreen Escape Guard ───────────────────────────────────────────
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenEscRef.current += 1;
        if (fullscreenEscRef.current === 1) {
          // First escape — show warning toast + re-request after 2s
          setFsWarning(true);
          setTimeout(() => setFsWarning(false), 5000);
          setTimeout(() => document.documentElement.requestFullscreen().catch(() => {}), 2000);
        } else {
          // Repeat escape — log as SEVERE
          triggerViolation("FULLSCREEN_ESCAPED_REPEAT", "Candidate exited fullscreen mode repeatedly.");
          setTimeout(() => document.documentElement.requestFullscreen().catch(() => {}), 2000);
        }
      }
    };

    // 6. ── Keyboard Guard ────────────────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      // New tab attempt
      if (meta && e.key === "t") {
        e.preventDefault();
        triggerViolation("NEW_TAB_ATTEMPT", "Attempted to open a new browser tab.");
      }
      // DevTools
      if (e.key === "F12") {
        e.preventDefault();
        triggerViolation("DEVTOOLS_ATTEMPT", "Attempted to open browser DevTools.");
      }
      // In-page search (silent block — prevents searching question text)
      if (meta && e.key === "f") {
        e.preventDefault();
      }
    };

    // Mount Global Listeners securely
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      // Clean up tightly on unmount
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };

  }, [isCandidate, interviewId]);

  const triggerViolation = async (type: string, message: string) => {
    // 1. Dispatch P2P LiveKit Telemetry Instantly
    if (localParticipant) {
      try {
        const strData = JSON.stringify({ type: "PROCTOR_VIOLATION", violationType: type, message });
        const encoder = new TextEncoder();
        await localParticipant.publishData(encoder.encode(strData), { reliable: true });
      } catch (err) {
        console.error("LiveKit DataChannel broadcast failed", err);
      }
    }

    // 2. Debounce rapid identical firings to prevent Database DOS pinging
    if (reportQueue.current) return;
    reportQueue.current = true;
    
    // 3. Asynchronous Database Dispatch for final report
    reportProctorViolationAction(interviewId, type, { browserEvent: message }).catch(console.error);

    // Unlock debounce queue after physical network delay
    setTimeout(() => { reportQueue.current = false; }, 2000);

    // Actively warn the candidate
    setViolationCount(prev => prev + 1);
    setActiveViolation({ type, message });
    setTimeout(() => setActiveViolation(null), 5000);
  };

  return (
    <>
      {children}

      {/* ── Fullscreen escape warning toast ─────────────────────────────── */}
      {fsWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-amber-900/90 backdrop-blur-sm border border-amber-500/40 text-white px-6 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Maximize className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">Fullscreen Required</p>
            <p className="text-xs text-amber-200/80">Please stay in fullscreen mode during the interview. Returning you now…</p>
          </div>
        </div>
      )}

      {/* ── Active Violation Warning Toast ──────────────────────────────── */}
      {activeViolation && !fsWarning && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-red-950/90 backdrop-blur-md border border-red-500/50 text-white px-6 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 w-max">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-red-400 tracking-wide uppercase">Proctoring Alert</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                {violationCount} Violations
              </span>
            </div>
            <p className="text-xs text-red-200/80 mt-0.5">{activeViolation.message}</p>
            <p className="text-[9px] text-red-400/60 mt-1 uppercase tracking-widest font-bold">This action has been noted in your interview report.</p>
          </div>
        </div>
      )}
    </>
  );
}
