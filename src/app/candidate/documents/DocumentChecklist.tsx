"use client";

import { useState, useCallback, useRef } from "react";
import type { DocRequirement, DocCategory } from "@/lib/document-checklist";
import { CATEGORY_CONFIG } from "@/lib/document-checklist";

type UploadedDoc = {
  id: string;
  docType: string;
  label: string;
  originalFileName: string;
  aiStatus: string;
  aiConfidence: number | null;
  aiWarnings: string[] | null;
  verificationStatus: string;
  createdAt: string;
};

type Props = {
  profileId: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  docs: DocRequirement[];
  uploadedDocs: UploadedDoc[];
  onCountryChange: (code: string) => void;
};

type DocStatus = "MISSING" | "UPLOADING" | "ANALYZING" | "UPLOADED" | "VERIFIED" | "WARNING" | "REJECTED";

function getDocStatus(doc: DocRequirement, uploaded?: UploadedDoc): DocStatus {
  if (!uploaded) return "MISSING";
  if (uploaded.verificationStatus === "VERIFIED") return "VERIFIED";
  if (uploaded.verificationStatus === "REJECTED") return "REJECTED";
  if (uploaded.aiStatus === "ANALYZING") return "ANALYZING";
  if (uploaded.aiWarnings && uploaded.aiWarnings.length > 0) return "WARNING";
  return "UPLOADED";
}

const STATUS_CONFIG: Record<DocStatus, { icon: string; text: string; classes: string }> = {
  MISSING:   { icon: "⬜", text: "Not uploaded",  classes: "text-gray-400 dark:text-zinc-500" },
  UPLOADING: { icon: "⏳", text: "Uploading...",  classes: "text-blue-500 animate-pulse" },
  ANALYZING: { icon: "🔄", text: "AI Analyzing",  classes: "text-indigo-500 animate-pulse" },
  UPLOADED:  { icon: "✅", text: "Uploaded",       classes: "text-emerald-600 dark:text-emerald-400" },
  VERIFIED:  { icon: "✅", text: "Verified",       classes: "text-emerald-600 dark:text-emerald-400 font-bold" },
  WARNING:   { icon: "⚠️", text: "Needs Review",  classes: "text-amber-600 dark:text-amber-400" },
  REJECTED:  { icon: "🔴", text: "Rejected",       classes: "text-red-600 dark:text-red-400" },
};

export function DocumentChecklist({
  profileId,
  countryCode,
  countryName,
  countryFlag,
  docs,
  uploadedDocs: initialDocs,
  onCountryChange,
}: Props) {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>(initialDocs);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [dragOverType, setDragOverType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocTypeRef = useRef<string>("");
  const pendingDocRef = useRef<DocRequirement | null>(null);

  const uploadedMap = new Map<string, UploadedDoc>();
  for (const doc of uploadedDocs) uploadedMap.set(doc.docType, doc);

  // Group docs by category
  const grouped = new Map<DocCategory, DocRequirement[]>();
  for (const doc of docs) {
    const list = grouped.get(doc.category) || [];
    list.push(doc);
    grouped.set(doc.category, list);
  }

  const requiredCount = docs.filter((d) => d.required).length;
  const requiredUploaded = docs.filter(
    (d) => d.required && uploadedMap.has(d.docType)
  ).length;
  const totalUploaded = docs.filter((d) => uploadedMap.has(d.docType)).length;
  const progressPercent = requiredCount > 0 ? Math.round((requiredUploaded / requiredCount) * 100) : 100;

  const handleUpload = useCallback(
    async (file: File, doc: DocRequirement) => {
      setUploadingType(doc.docType);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", doc.docType);
      formData.append("countryCode", countryCode);
      formData.append("label", doc.label);
      formData.append("category", doc.category);
      formData.append("profileId", profileId);

      try {
        const res = await fetch("/api/candidate-documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Upload failed");
          return;
        }

        const data = await res.json();

        // Add to local state
        setUploadedDocs((prev) => {
          const filtered = prev.filter((d) => d.docType !== doc.docType);
          return [
            ...filtered,
            {
              id: data.document.id,
              docType: doc.docType,
              label: doc.label,
              originalFileName: file.name,
              aiStatus: "ANALYZING",
              aiConfidence: null,
              aiWarnings: null,
              verificationStatus: "UNVERIFIED",
              createdAt: new Date().toISOString(),
            },
          ];
        });

        // Poll for AI completion
        pollAiStatus(data.document.id, doc.docType);
      } catch {
        alert("Upload failed — please try again.");
      } finally {
        setUploadingType(null);
      }
    },
    [countryCode, profileId]
  );

  const pollAiStatus = useCallback(
    async (docId: string, docType: string) => {
      // Poll every 2 seconds for up to 30 seconds
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        try {
          const res = await fetch(`/api/candidate-documents/${docId}`);
          if (!res.ok) continue;
          const doc = await res.json();

          if (doc.aiStatus === "COMPLETED" || doc.aiStatus === "FAILED") {
            setUploadedDocs((prev) =>
              prev.map((d) =>
                d.docType === docType
                  ? {
                      ...d,
                      aiStatus: doc.aiStatus,
                      aiConfidence: doc.aiConfidence,
                      aiWarnings: doc.aiWarnings,
                    }
                  : d
              )
            );
            break;
          }
        } catch {
          // ignore polling errors
        }
      }
    },
    []
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && pendingDocRef.current) {
        handleUpload(file, pendingDocRef.current);
      }
      e.target.value = "";
    },
    [handleUpload]
  );

  const triggerFileSelect = useCallback((doc: DocRequirement) => {
    pendingDocTypeRef.current = doc.docType;
    pendingDocRef.current = doc;
    const accept = doc.acceptedFormats
      .map((f) => {
        if (f === "PDF") return ".pdf";
        if (f === "JPG") return ".jpg,.jpeg";
        if (f === "PNG") return ".png";
        return `.${f.toLowerCase()}`;
      })
      .join(",");

    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, doc: DocRequirement) => {
      e.preventDefault();
      setDragOverType(null);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file, doc);
    },
    [handleUpload]
  );

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileSelect}
      />

      {/* Progress Bar */}
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{countryFlag}</span>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {countryName} Compliance Checklist
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                {totalUploaded} of {docs.length} documents uploaded · {requiredUploaded} of {requiredCount} required
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={countryCode}
              onChange={(e) => onCountryChange(e.target.value)}
              className="text-sm font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-500 outline-none dark:text-white"
            >
              <option value="US">🇺🇸 United States</option>
              <option value="IN">🇮🇳 India</option>
            </select>
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background:
                progressPercent === 100
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : progressPercent >= 70
                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                    : "linear-gradient(90deg, #f43f5e, #e11d48)",
            }}
          />
        </div>
        {progressPercent === 100 && (
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            All required documents uploaded!
          </p>
        )}
      </div>

      {/* Category Groups */}
      {Array.from(grouped.entries()).map(([category, categoryDocs]) => {
        const config = CATEGORY_CONFIG[category];
        return (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-2 px-1">
              <span>{config.icon}</span>
              {config.label}
            </h4>
            <div className="space-y-2">
              {categoryDocs.map((doc) => {
                const uploaded = uploadedMap.get(doc.docType);
                const isUploading = uploadingType === doc.docType;
                const isDragOver = dragOverType === doc.docType;
                const status: DocStatus = isUploading ? "UPLOADING" : getDocStatus(doc, uploaded);
                const statusConfig = STATUS_CONFIG[status];

                return (
                  <div
                    key={doc.docType}
                    className={`group rounded-xl border transition-all duration-200 ${
                      isDragOver
                        ? "border-rose-400 bg-rose-50/50 dark:bg-rose-900/10 shadow-lg shadow-rose-500/10"
                        : status === "MISSING"
                          ? "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-rose-300 dark:hover:border-rose-800/50"
                          : status === "REJECTED"
                            ? "border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10"
                            : status === "WARNING"
                              ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10"
                              : "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-900/10"
                    } p-4`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverType(doc.docType);
                    }}
                    onDragLeave={() => setDragOverType(null)}
                    onDrop={(e) => handleDrop(e, doc)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg shrink-0">{statusConfig.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                              {doc.label}
                            </span>
                            {doc.required && (
                              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-full">
                                Required
                              </span>
                            )}
                            {doc.legalReference && (
                              <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                                ({doc.legalReference})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
                            {uploaded ? (
                              <span className={statusConfig.classes}>
                                {statusConfig.text} · {uploaded.originalFileName}
                                {uploaded.aiConfidence !== null && (
                                  <span className="ml-1 text-gray-400 dark:text-zinc-500">
                                    ({Math.round(uploaded.aiConfidence * 100)}% confidence)
                                  </span>
                                )}
                              </span>
                            ) : (
                              doc.description
                            )}
                          </p>
                          {/* AI Warnings */}
                          {uploaded?.aiWarnings && uploaded.aiWarnings.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {uploaded.aiWarnings.map((w, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                >
                                  ⚠️ {w}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Upload Button */}
                      <button
                        type="button"
                        onClick={() => triggerFileSelect(doc)}
                        disabled={isUploading}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isUploading
                            ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed"
                            : uploaded
                              ? "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                              : "bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/20"
                        }`}
                      >
                        {isUploading ? (
                          <>
                            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75"/></svg>
                            Uploading...
                          </>
                        ) : uploaded ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            Replace
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            Upload
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Accepted Formats Footer */}
      <p className="text-[10px] text-gray-400 dark:text-zinc-600 text-center px-4">
        Accepted formats: PDF, JPG, PNG · Max file size: 15 MB · Documents are encrypted and stored securely
      </p>
    </div>
  );
}
