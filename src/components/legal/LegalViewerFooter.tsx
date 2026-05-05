"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { CheckCircle2, ArrowDown } from "lucide-react";

/**
 * Sticky footer that appears on legal pages when opened with ?viewer=1.
 * Tracks scroll position — once the user scrolls to the bottom,
 * the "Confirm" button enables. Clicking it sends a postMessage
 * back to the opener window and closes the popup.
 */
export function LegalViewerFooter() {
  const searchParams = useSearchParams();
  const pathname     = usePathname();
  const isViewer     = searchParams.get("viewer") === "1";

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [confirmed,        setConfirmed]        = useState(false);

  // Track scroll  
  const handleScroll = useCallback(() => {
    const scrollTop    = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    if (scrollHeight - scrollTop - clientHeight < 60) {
      setScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    if (!isViewer) return;
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Check immediately in case the page is short enough
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isViewer, handleScroll]);

  if (!isViewer) return null;

  const handleConfirm = () => {
    setConfirmed(true);
    // Notify the opener window
    if (window.opener) {
      window.opener.postMessage(
        { type: "LEGAL_DOC_READ", href: pathname },
        window.location.origin
      );
    }
    // Close the popup after a brief delay
    setTimeout(() => window.close(), 400);
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 z-50 border-t-2 border-rose-500/30 bg-zinc-950/95 backdrop-blur-lg shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {scrolledToBottom ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                You&apos;ve reached the end of this document.
              </p>
            </>
          ) : (
            <>
              <ArrowDown className="w-5 h-5 text-amber-400 animate-bounce shrink-0" />
              <p className="text-sm text-amber-400 font-medium">
                Please scroll to the bottom to confirm you&apos;ve read this document.
              </p>
            </>
          )}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!scrolledToBottom || confirmed}
          className={`shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            confirmed
              ? "bg-green-600 text-white"
              : scrolledToBottom
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 cursor-pointer"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {confirmed ? (
            <><CheckCircle2 className="w-4 h-4" /> Confirmed ✓</>
          ) : (
            "Confirm I have read this →"
          )}
        </button>
      </div>
    </div>
  );
}
