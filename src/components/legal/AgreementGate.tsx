"use client";

import { useState } from "react";
import { Scale, ExternalLink, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

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
  onAccept:        (data: { name?: string; title?: string }) => Promise<void>;
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
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const canSubmit = agreed && (!requiresName || (name.trim().length > 0));

  const handleAccept = async () => {
    if (!canSubmit || isLoading) return;
    await onAccept({ name: name.trim() || undefined, title: jobTitle.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-300 overflow-hidden"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Scale className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">IQMela Legal</p>
              <h1 className="text-xl font-black text-white">{title}</h1>
            </div>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">{subtitle}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3" style={{ minHeight: 0 }}>
          {/* Document list */}
          {documents.map((doc) => (
            <div key={doc.href} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <button
                onClick={() => setExpandedDoc(expandedDoc === doc.href ? null : doc.href)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-white">{doc.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{doc.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Link
                    href={doc.href}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 px-2 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </Link>
                  {expandedDoc === doc.href
                    ? <ChevronUp className="w-4 h-4 text-zinc-500" />
                    : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </div>
              </button>
              {expandedDoc === doc.href && (
                <div className="px-4 pb-4 border-t border-zinc-800/60">
                  <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                    Please read the full document by clicking &ldquo;Open&rdquo; above. By continuing, you confirm
                    you have read and understood its contents.
                  </p>
                </div>
              )}
            </div>
          ))}

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
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">{titleLabel}</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="CEO / VP Engineering / HR Director"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
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

          {/* Checkbox */}
          <div
            onClick={() => setAgreed(!agreed)}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none ${
              agreed
                ? "border-indigo-500/50 bg-indigo-950/30"
                : "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              agreed ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"
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
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              : "Accept & Continue →"}
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-3">
            Acceptance is recorded with your account ID, timestamp, and IP address for legal compliance.
          </p>
        </div>
      </div>
    </div>
  );
}
