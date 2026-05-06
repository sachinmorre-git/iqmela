"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

type IssueCategory = "TECHNICAL" | "BILLING" | "OTHER";

interface DetectedIssue {
  type: "error" | "rage_click" | "failed_upload" | "network_error";
  message: string;
  timestamp: number;
  element?: string;
}

/**
 * Smart Help Beacon — Global floating support widget
 *
 * Features:
 * - Auto-detects: JS errors, network failures, rage clicks, failed uploads
 * - Contextual: captures current page, browser info, recent errors
 * - Floating bottom-right FAB with slide-up report form
 * - Creates support tickets via API
 */
export function HelpBeacon() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([]);
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    category: "TECHNICAL" as IssueCategory,
  });

  // Dragging State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartMouse = useRef({ x: 0, y: 0 });

  const pathname = usePathname();
  const clickMapRef = useRef<Map<string, { count: number; lastTime: number }>>(new Map());
  const errorCountRef = useRef(0);

  // ── Auto-Detect: JavaScript Errors ──────────────────────────────────────
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const issue: DetectedIssue = {
        type: "error",
        message: event.message || "Unknown error",
        timestamp: Date.now(),
      };
      setDetectedIssues((prev) => [...prev.slice(-4), issue]);
      errorCountRef.current++;

      // Pulse the beacon on errors
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 3000);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || event.reason?.toString() || "Unhandled promise rejection";
      const issue: DetectedIssue = {
        type: "error",
        message: msg,
        timestamp: Date.now(),
      };
      setDetectedIssues((prev) => [...prev.slice(-4), issue]);
      errorCountRef.current++;
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 3000);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // ── Auto-Detect: Network / Fetch Failures ──────────────────────────────
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);

        // Detect server errors (5xx) or failed uploads
        if (response.status >= 500) {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "unknown";
          const issue: DetectedIssue = {
            type: "network_error",
            message: `Server error ${response.status} on ${url.split("?")[0]}`,
            timestamp: Date.now(),
          };
          setDetectedIssues((prev) => [...prev.slice(-4), issue]);
          setShowPulse(true);
          setTimeout(() => setShowPulse(false), 3000);
        }

        // Detect failed uploads specifically
        if (response.status >= 400) {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
          if (url.includes("upload") || url.includes("document")) {
            const issue: DetectedIssue = {
              type: "failed_upload",
              message: `Upload failed (${response.status}) at ${url.split("?")[0]}`,
              timestamp: Date.now(),
            };
            setDetectedIssues((prev) => [...prev.slice(-4), issue]);
            setShowPulse(true);
            setTimeout(() => setShowPulse(false), 5000);
          }
        }

        return response;
      } catch (err) {
        // Network completely failed
        const issue: DetectedIssue = {
          type: "network_error",
          message: `Network request failed: ${(err as Error).message || "Connection error"}`,
          timestamp: Date.now(),
        };
        setDetectedIssues((prev) => [...prev.slice(-4), issue]);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 3000);
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // ── Auto-Detect: Rage Clicks ────────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const identifier =
        target.id ||
        target.getAttribute("data-testid") ||
        `${target.tagName}.${target.className?.toString().split(" ")[0] || "unknown"}`;

      const now = Date.now();
      const existing = clickMapRef.current.get(identifier);

      if (existing && now - existing.lastTime < 1000) {
        existing.count++;
        existing.lastTime = now;

        // 4+ rapid clicks on same element = rage click
        if (existing.count >= 4) {
          const issue: DetectedIssue = {
            type: "rage_click",
            message: `Repeated clicks on "${identifier}" — button may not be working`,
            timestamp: now,
            element: identifier,
          };
          setDetectedIssues((prev) => [...prev.slice(-4), issue]);
          setShowPulse(true);
          setTimeout(() => setShowPulse(false), 5000);
          existing.count = 0; // Reset after detection
        }
      } else {
        clickMapRef.current.set(identifier, { count: 1, lastTime: now });
      }

      // Cleanup old entries
      if (clickMapRef.current.size > 50) {
        const entries = Array.from(clickMapRef.current.entries());
        entries
          .filter(([, v]) => now - v.lastTime > 10000)
          .forEach(([k]) => clickMapRef.current.delete(k));
      }
    };

    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // ── Clear issues on page change ─────────────────────────────────────────
  useEffect(() => {
    setDetectedIssues([]);
    errorCountRef.current = 0;
  }, [pathname]);

  // ── Build Context ───────────────────────────────────────────────────────
  const buildContext = useCallback(() => {
    const context: string[] = [];
    context.push(`Page: ${pathname}`);
    context.push(`Browser: ${navigator.userAgent.split(" ").slice(-2).join(" ")}`);
    context.push(`Screen: ${window.innerWidth}×${window.innerHeight}`);
    context.push(`Time: ${new Date().toISOString()}`);

    if (detectedIssues.length > 0) {
      context.push("");
      context.push("— Auto-Detected Issues —");
      for (const issue of detectedIssues) {
        const time = new Date(issue.timestamp).toLocaleTimeString();
        context.push(`[${time}] ${issue.type}: ${issue.message}`);
      }
    }

    return context.join("\n");
  }, [pathname, detectedIssues]);

  // ── Pre-populate on open ────────────────────────────────────────────────
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSubmitted(false);

    // Auto-fill subject if we have detected issues
    if (detectedIssues.length > 0) {
      const latest = detectedIssues[detectedIssues.length - 1];
      const autoSubject =
        latest.type === "rage_click"
          ? `Button not responding on ${pathname}`
          : latest.type === "failed_upload"
            ? `File upload failed on ${pathname}`
            : latest.type === "network_error"
              ? `Server error on ${pathname}`
              : `Error encountered on ${pathname}`;

      setFormData((prev) => ({
        ...prev,
        subject: prev.subject || autoSubject,
        description: prev.description || `I encountered an issue:\n\n${latest.message}\n\n---\nSystem Context:\n${buildContext()}`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        description: prev.description || `\n\n---\nSystem Context:\n${buildContext()}`,
      }));
    }
  }, [detectedIssues, pathname, buildContext]);

  // ── Drag Handlers ───────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    setIsDragging(true);
    dragStartMouse.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartMouse.current.x;
    const dy = e.clientY - dragStartMouse.current.y;
    setPosition({
      x: dragStartPos.current.x + dx,
      y: dragStartPos.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Modify handleOpen to prevent opening if we just dragged significantly
  const handleClick = (e: React.MouseEvent) => {
    const dx = Math.abs(position.x - dragStartPos.current.x);
    const dy = Math.abs(position.y - dragStartPos.current.y);
    if (dx > 5 || dy > 5) {
      // It was a drag, not a click
      return;
    }
    handleOpen();
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/help-beacon/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formData.subject,
          description: formData.description,
          category: formData.category,
          page: pathname,
          detectedIssues: detectedIssues.map((i) => ({
            type: i.type,
            message: i.message,
          })),
          browserInfo: {
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}×${window.innerHeight}`,
            url: window.location.href,
          },
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setFormData({ subject: "", description: "", category: "TECHNICAL" });
        setDetectedIssues([]);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
        }, 3000);
      }
    } catch {
      // Don't auto-report this one — infinite loop!
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const issueCount = detectedIssues.length;

  return (
    <>
      {/* Draggable Container */}
      <div
        className="fixed bottom-6 left-6 z-[9999]"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, touchAction: 'none' }}
      >
        {/* Floating Action Button */}
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-14 h-14 rounded-full shadow-2xl transition-all duration-300 group ${
            isDragging ? "cursor-grabbing transition-none" : "cursor-pointer"
          } ${
            issueCount > 0
              ? "bg-gradient-to-br from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 shadow-rose-500/30"
              : "bg-gradient-to-br from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 shadow-rose-500/20"
          } ${showPulse && !isDragging ? "animate-bounce" : !isDragging ? "hover:scale-110" : ""}`}
          title={issueCount > 0 ? `${issueCount} issue(s) detected — click to report` : "Need help? Report an issue"}
        >
        {/* Icon */}
        <div className="flex items-center justify-center w-full h-full text-white">
          {issueCount > 0 ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
            </svg>
          )}
        </div>

        {/* Badge */}
        {issueCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-rose-600 text-[10px] font-black flex items-center justify-center shadow-lg ring-2 ring-rose-500">
            {issueCount}
          </span>
        )}

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 dark:bg-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
            {issueCount > 0 ? "Issues detected — Report" : "Need help?"}
          </span>
        </button>
      </div>

      {/* Slide-up Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/20 dark:bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            style={{ animation: "fadeIn 150ms ease-out" }}
          />

          {/* Panel */}
          <div
            className="fixed bottom-24 left-6 z-[9999] w-[380px] max-h-[520px] rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-2xl shadow-rose-500/10 overflow-hidden flex flex-col"
            style={{ animation: "slideUp 250ms ease-out" }}
          >
            {submitted ? (
              /* ── Success State ── */
              <div className="flex flex-col items-center justify-center p-8 text-center" style={{ animation: "fadeSlideIn 300ms ease-out" }}>
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-3xl mb-4">
                  ✅
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Report Submitted</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
                  Our team will review your issue and get back to you shortly.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-rose-50 to-indigo-50 dark:from-rose-900/10 dark:to-indigo-900/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Report an Issue</h3>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400">We&apos;ll auto-capture context for you</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Auto-detected issues banner */}
                {issueCount > 0 && (
                  <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30">
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                      {issueCount} issue{issueCount > 1 ? "s" : ""} auto-detected on this page
                    </p>
                    <div className="mt-1 space-y-0.5">
                      {detectedIssues.slice(-3).map((issue, i) => (
                        <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400/80 truncate">
                          • {issue.type === "rage_click" ? "🖱️" : issue.type === "failed_upload" ? "📁" : issue.type === "network_error" ? "🌐" : "⚠️"} {issue.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                      What happened? *
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="e.g., Upload button not working..."
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all dark:text-white placeholder:text-gray-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value as IssueCategory }))}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all dark:text-white appearance-none"
                    >
                      <option value="TECHNICAL">🔧 Technical Issue</option>
                      <option value="BILLING">💳 Billing</option>
                      <option value="OTHER">💬 Other / Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                      Details *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe the issue in more detail..."
                      rows={4}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50/50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all dark:text-white placeholder:text-gray-400 resize-none"
                      required
                    />
                  </div>

                  {/* Context Preview */}
                  <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 p-3 border border-gray-100 dark:border-zinc-800">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Auto-Captured Context
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 leading-relaxed font-mono">
                      Page: {pathname}<br />
                      Screen: {typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "—"}<br />
                      {issueCount > 0 && <>Detected Issues: {issueCount}<br /></>}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.subject.trim()}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/></svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Submit Report
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
