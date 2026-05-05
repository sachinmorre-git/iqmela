"use client";

import { useState } from "react";
import { CATEGORY_CONFIG, type DocCategory } from "@/lib/document-checklist";

type CandidateDoc = {
  id: string;
  docType: string;
  label: string;
  category: string;
  countryCode: string;
  originalFileName: string;
  fileSize: number;
  aiStatus: string;
  aiConfidence: number | null;
  aiDocTypeGuess: string | null;
  aiWarnings: string[] | null;
  aiExtractedJson: Record<string, string | null> | null;
  verificationStatus: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export function DocumentsPanel({
  documents,
  candidateName,
}: {
  documents: CandidateDoc[];
  candidateName: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xl mx-auto mb-3">📋</div>
        <p className="text-sm font-semibold text-gray-600 dark:text-zinc-300">No documents uploaded</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          This candidate hasn&apos;t uploaded any compliance documents yet.
        </p>
      </div>
    );
  }

  // Group by country
  const byCountry = new Map<string, CandidateDoc[]>();
  for (const doc of documents) {
    const list = byCountry.get(doc.countryCode) || [];
    list.push(doc);
    byCountry.set(doc.countryCode, list);
  }

  const countryNames: Record<string, string> = { US: "🇺🇸 United States", IN: "🇮🇳 India" };

  const totalDocs = documents.length;
  const verifiedDocs = documents.filter((d) => d.verificationStatus === "VERIFIED").length;
  const warningDocs = documents.filter((d) => d.aiWarnings && (d.aiWarnings as string[]).length > 0).length;

  const handleVerify = async (docId: string) => {
    try {
      const res = await fetch(`/api/candidate-documents/${docId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Verify failed:", err);
    }
  };

  const handleReject = async (docId: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/candidate-documents/${docId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", reason }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="flex items-center gap-6 text-xs">
        <span className="inline-flex items-center gap-1.5 font-bold text-gray-700 dark:text-zinc-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
          {totalDocs} documents
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
          ✅ {verifiedDocs} verified
        </span>
        {warningDocs > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
            ⚠️ {warningDocs} need review
          </span>
        )}
      </div>

      {/* Documents by Country */}
      {Array.from(byCountry.entries()).map(([code, docs]) => (
        <div key={code} className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            {countryNames[code] || code}
          </h4>
          <div className="space-y-2">
            {docs.map((doc) => {
              const catConfig = CATEGORY_CONFIG[doc.category as DocCategory];
              const isExpanded = expandedId === doc.id;
              const hasWarnings = doc.aiWarnings && (doc.aiWarnings as string[]).length > 0;
              const isVerified = doc.verificationStatus === "VERIFIED";
              const isRejected = doc.verificationStatus === "REJECTED";

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border transition-all ${
                    isRejected
                      ? "border-red-200 dark:border-red-800/40 bg-red-50/20 dark:bg-red-900/10"
                      : isVerified
                        ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-900/10"
                        : hasWarnings
                          ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-900/10"
                          : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  {/* Main Row */}
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                  >
                    <span className="text-base shrink-0">{catConfig?.icon ?? "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {doc.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isVerified
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : isRejected
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : hasWarnings
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          {isVerified ? "Verified" : isRejected ? "Rejected" : hasWarnings ? "Review" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                        {doc.originalFileName} · {(doc.fileSize / 1024).toFixed(0)} KB
                        {doc.aiConfidence !== null && (
                          <span className="ml-1">
                            · AI: {Math.round(doc.aiConfidence * 100)}%
                          </span>
                        )}
                      </p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-3" style={{ animation: "fadeSlideIn 200ms ease-out" }}>
                      {/* AI Extracted Data */}
                      {doc.aiExtractedJson && (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(doc.aiExtractedJson).map(([key, val]) =>
                            val ? (
                              <div key={key} className="text-xs">
                                <span className="font-semibold text-gray-600 dark:text-zinc-300 capitalize">
                                  {key.replace(/([A-Z])/g, " $1").trim()}:
                                </span>{" "}
                                <span className="text-gray-500 dark:text-zinc-400">{val}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}

                      {/* AI Warnings */}
                      {hasWarnings && (
                        <div className="flex flex-wrap gap-1">
                          {(doc.aiWarnings as string[]).map((w, i) => (
                            <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              ⚠️ {w}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Rejection reason */}
                      {isRejected && doc.rejectionReason && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                          Reason: {doc.rejectionReason}
                        </p>
                      )}

                      {/* AI Type Check */}
                      {doc.aiDocTypeGuess && doc.aiDocTypeGuess !== doc.docType && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ AI detected this as <strong>{doc.aiDocTypeGuess}</strong> but it was uploaded as <strong>{doc.docType}</strong>
                        </p>
                      )}

                      {/* Action Buttons */}
                      {!isVerified && !isRejected && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleVerify(doc.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                          >
                            ✅ Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(doc.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                          >
                            🔴 Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
