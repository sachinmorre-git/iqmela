"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Scale, ExternalLink, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";

interface AgreementDoc {
  label:       string;
  href:        string;
  description: string;
}

interface AgreementGateProps {
  title:           string;
  subtitle:        string;
  documents:       AgreementDoc[];
  checkboxLabel:   React.ReactNode;
  requiresName?:   boolean;
  nameLabel?:      string;
  titleLabel?:     string;
  orgName?:        string;
  onAccept:        (data: { name?: string; title?: string; viewedDocuments: string[] }) => Promise<void>;
  isLoading?:      boolean;
  error?:          string | null;
}

export function AgreementGate({
  title,
  subtitle,
  documents,
  checkboxLabel,
  requiresName = false,
  nameLabel    = "Your full name",
  titleLabel   = "Your job title",
  orgName,
  onAccept,
  isLoading = false,
  error     = null,
}: AgreementGateProps) {
  const [agreed,      setAgreed]      = useState(false);
  const [name,        setName]        = useState("");
  const [jobTitle,    setJobTitle]    = useState("");
  const [viewedDocs,  setViewedDocs]  = useState<Set<string>>(new Set());

  const allDocsViewed = documents.every((doc) => viewedDocs.has(doc.href));
  const canSubmit     = agreed && allDocsViewed && (!requiresName || (name.trim().length > 0));

  // Listen for "document read" messages from popup windows
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "LEGAL_DOC_READ" && e.data?.href) {
        setViewedDocs((prev) => new Set(prev).add(e.data.href));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const openDocPopup = useCallback((doc: AgreementDoc) => {
    const width  = Math.min(800, window.screen.width - 100);
    const height = Math.min(700, window.screen.height - 100);
    const left   = (window.screen.width  - width)  / 2;
    const top    = (window.screen.height - height) / 2;

    // Add ?viewer=1 so the legal page knows to show the "I've read this" footer
    const url = `${doc.href}?viewer=1`;

    window.open(
      url,
      `legal_${doc.href}`,
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,status=no`
    );
  }, []);

  const handleAccept = async () => {
    if (!canSubmit || isLoading) return;
    await onAccept({
      name:            name.trim() || undefined,
      title:           jobTitle.trim() || undefined,
      viewedDocuments: Array.from(viewedDocs),
    });
  };

  const remainingDocs = documents.filter((d) => !viewedDocs.has(d.href));

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-300 overflow-hidden"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/icon/iq-icon.svg"
              alt="IQMela"
              className="w-10 h-10 rounded-xl shadow-lg shadow-pink-500/20 drop-shadow-[0_0_8px_rgba(255,0,87,0.35)]"
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">IQMela Legal</p>
              <h1 className="text-xl font-black text-white">{title}</h1>
            </div>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">{subtitle}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3" style={{ minHeight: 0 }}>
          {/* Document list */}
          {documents.map((doc) => {
            const isViewed = viewedDocs.has(doc.href);

            return (
              <div
                key={doc.href}
                className={`border rounded-xl overflow-hidden transition-all ${
                  isViewed
                    ? "border-green-500/40 bg-green-950/10"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isViewed ? (
                      <Eye className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-zinc-600 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{doc.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{doc.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isViewed && (
                      <span className="text-[9px] font-bold text-green-400 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                        Read ✓
                      </span>
                    )}
                    <button
                      onClick={() => openDocPopup(doc)}
                      className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 px-2.5 py-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 transition-colors hover:bg-rose-500/20"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {isViewed ? "Re-read" : "Open & Read"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Progress indicator */}
          {!allDocsViewed && (
            <>
              <div className="flex items-center gap-2 px-1 pt-1">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${(viewedDocs.size / documents.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                  {viewedDocs.size}/{documents.length} reviewed
                </span>
              </div>
              <p className="text-xs text-amber-400/70 px-1">
                ⚠ Please open and read {remainingDocs.length === 1 ? "the remaining document" : `all ${remainingDocs.length} remaining documents`} before accepting.
              </p>
            </>
          )}

          {/* Name inputs (MSA gate only) */}
          {requiresName && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">{nameLabel} <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">{titleLabel}</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="CEO / VP Engineering / HR Director"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
              {orgName && (
                <p className="text-xs text-zinc-500">
                  By clicking Accept, {name || "you"} confirm{name ? "s" : ""} authority to bind{" "}
                  <span className="text-white font-semibold">{orgName}</span> to these agreements.
                </p>
              )}
            </div>
          )}

          {/* Checkbox — only clickable after all docs are viewed */}
          <div
            onClick={() => allDocsViewed && setAgreed(!agreed)}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all select-none ${
              !allDocsViewed
                ? "border-zinc-800 bg-zinc-900/20 opacity-40 cursor-not-allowed"
                : agreed
                  ? "border-rose-500/50 bg-rose-950/30 cursor-pointer"
                  : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600 cursor-pointer"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              agreed ? "bg-rose-600 border-rose-600" : "border-zinc-600"
            }`}>
              {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm text-zinc-300 leading-relaxed">{checkboxLabel}</span>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 font-medium px-1">{error}</p>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-8 py-5 border-t border-zinc-800/60 bg-black/30 shrink-0">
          <button
            onClick={handleAccept}
            disabled={!canSubmit || isLoading}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : !allDocsViewed
                ? `Review ${remainingDocs.length} document${remainingDocs.length > 1 ? "s" : ""} to continue`
                : "Accept & Continue →"}
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-3">
            Acceptance is recorded with your account ID, timestamp, IP address, and document review confirmation for legal compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
