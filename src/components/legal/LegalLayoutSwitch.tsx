"use client";

import Link from "next/link";
import Image from "next/image";
import { Scale } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { LegalViewerFooter } from "@/components/legal/LegalViewerFooter";

/**
 * Switches between two layouts:
 * - Normal mode: full site chrome (header, footer, nav)
 * - Viewer mode (?viewer=1): clean document-only view for the popup
 */
export function LegalLayoutSwitch({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isViewer     = searchParams.get("viewer") === "1";

  // ══════════════════════════════════════════════════════════════
  // Viewer mode — clean document-only popup
  // ══════════════════════════════════════════════════════════════
  if (isViewer) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        {/* Minimal header — document title only, no navigation */}
        <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/icon/iq-icon.svg"
              alt="IQMela"
              className="w-7 h-7 rounded-md drop-shadow-[0_0_6px_rgba(255,0,87,0.25)]"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-rose-400">IQMela Legal — Document Viewer</span>
          </div>
        </header>

        {/* Document content — no extra padding/chrome */}
        <main className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full">
          {children}
        </main>

        {/* Sticky confirmation footer */}
        <LegalViewerFooter />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Normal mode — full site layout
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/icon/iq-icon.svg"
              alt="IQMela"
              className="w-8 h-8 rounded-lg drop-shadow-[0_0_6px_rgba(255,0,87,0.25)]"
            />
            <span className="font-black text-white text-lg tracking-tight">IQMela</span>
            <span className="text-zinc-500 text-sm font-medium pl-2 border-l border-zinc-700">Legal</span>
          </Link>
          <Link
            href="/legal"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
          >
            ← All Documents
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-24">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of RelyOnAI LLP. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/terms"    className="hover:text-zinc-400 transition-colors">Terms</Link>
            <Link href="/legal/privacy"  className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/legal/dpa"      className="hover:text-zinc-400 transition-colors">DPA</Link>
            <Link href="/legal/conduct"  className="hover:text-zinc-400 transition-colors">Conduct</Link>
            <Link href="/legal/cookies"  className="hover:text-zinc-400 transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
