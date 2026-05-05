"use client";

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ACCEPTED_EXT = ".pdf,.doc,.docx,.txt";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const names = new Set(existing.map((f) => f.name));
  const filtered = incoming.filter((f) => ACCEPTED_MIME.includes(f.type) && !names.has(f.name));
  return [...existing, ...filtered];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "done" | "error";

interface ResumeUploadZoneProps {
  positionId: string;
  compact?: boolean;
  uploadEndpoint?: string; // Override the upload API URL (e.g., for vendor cross-tenant uploads)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ResumeUploadZone({ positionId, compact, uploadEndpoint }: ResumeUploadZoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [result, setResult] = useState<{ uploaded: number; errors: string[] } | null>(null);

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => mergeFiles(prev, dropped));
    setResult(null); setUploadState("idle");
  }, []);

  // ── Input handler ───────────────────────────────────────────────────────────

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => mergeFiles(prev, selected));
    setResult(null); setUploadState("idle");
    e.target.value = "";
  }, []);

  // ── Remove ──────────────────────────────────────────────────────────────────

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!files.length || uploadState === "uploading") return;

    setUploadState("uploading");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("positionId", positionId);
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch(uploadEndpoint || "/api/org-admin/resumes/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadState("error");
        setResult({ uploaded: 0, errors: [data.error ?? "Upload failed"] });
        return;
      }

      setUploadState("done");
      setResult({ uploaded: data.count, errors: data.errors ?? [] });
      setFiles([]); // clear queue on success

      // Re-fetch the server component so the uploaded resumes list refreshes
      router.refresh();

    } catch {
      setUploadState("error");
      setResult({ uploaded: 0, errors: ["Network error — please try again"] });
    }
  };

  // ── Compact inline mode — vertical mini-card in header ─────────────────────

  if (compact) {
    return (
      <div className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm p-3 min-w-[220px]">
        {/* Drag-drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
            px-3 py-3 cursor-pointer transition-all duration-200 select-none
            ${isDragging
              ? "border-rose-500 bg-rose-50/60 dark:bg-rose-900/20"
              : "border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30 hover:border-rose-400 hover:bg-rose-50/30 dark:hover:bg-rose-900/10"
            }
          `}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDragging ? "bg-rose-100 dark:bg-rose-800/40 text-rose-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-400"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div className="text-center pointer-events-none">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {isDragging ? "Drop files here" : files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""} ready` : "Drag & Drop or "}
              {!isDragging && files.length === 0 && <span className="text-rose-600 dark:text-rose-400">Click to Browse</span>}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">PDF, DOC, DOCX · Max 10 MB</p>
          </div>
          <input ref={inputRef} type="file" multiple accept={ACCEPTED_EXT} className="hidden" onChange={handleChange} />
        </div>

        {/* Result banner */}
        {result && (
          <div className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium text-center ${uploadState === "done" ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>
            {uploadState === "done" ? `✓ ${result.uploaded} file${result.uploaded !== 1 ? "s" : ""} uploaded` : result.errors[0]}
          </div>
        )}

        {/* Files queued nudge */}
        {files.length > 0 && uploadState !== "uploading" && (
          <div className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold text-center bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 animate-pulse">
            📎 {files.length} file{files.length !== 1 ? "s" : ""} ready — tap Upload below
          </div>
        )}

        {/* Upload Resumes button */}
        <button
          type="button"
          disabled={files.length === 0 || uploadState === "uploading"}
          onClick={handleUpload}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 ${files.length > 0 && uploadState !== "uploading" ? "animate-bounce" : ""}`}
        >
          {uploadState === "uploading" ? (
            <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Uploading…</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>Upload Resumes</>
          )}
        </button>
      </div>
    )
  }

  // ── Full drop zone render ────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-2xl border-2 border-dashed px-6 py-12
          cursor-pointer transition-all duration-200 select-none
          ${isDragging
            ? "border-rose-500 bg-rose-50/60 dark:bg-rose-900/20 scale-[1.005]"
            : "border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30 hover:border-rose-400 hover:bg-rose-50/40 dark:hover:bg-rose-900/10"
          }
        `}
      >
        {/* Upload icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-rose-100 dark:bg-rose-800/40 text-rose-600" : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        <div className="text-center pointer-events-none">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {isDragging ? "Drop files here" : "Drag & drop resumes here"}
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            or <span className="text-rose-600 dark:text-rose-400 font-medium">click to browse</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
            Supported: PDF, DOC, DOCX · Max 10 MB per file
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={handleChange}
          aria-hidden="true"
        />
      </div>

      {/* File queue */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {files.length} file{files.length !== 1 ? "s" : ""} queued
          </p>
          <ul className="flex flex-col gap-1.5">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 dark:text-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium
          ${uploadState === "done"
            ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50"
            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50"
          }`}
        >
          <span>
            {uploadState === "done"
              ? `✓ ${result.uploaded} file${result.uploaded !== 1 ? "s" : ""} uploaded successfully.`
              : "Upload failed."}
            {result.errors.length > 0 && (
              <span className="block mt-1 text-xs opacity-80">
                {result.errors.join(" · ")}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          disabled={files.length === 0 || uploadState === "uploading"}
          onClick={handleUpload}
          className={`rounded-xl shadow-md shadow-rose-600/20 bg-rose-600 hover:bg-rose-700 text-white border-transparent hover:-translate-y-0.5 transition-transform
            ${(files.length === 0 || uploadState === "uploading") ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {uploadState === "uploading" ? (
            <>
              <svg className="mr-2 animate-spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {files.length === 0
                ? "Upload Resumes"
                : `Upload ${files.length} Resume${files.length !== 1 ? "s" : ""}`}
            </>
          )}
        </Button>

        {files.length > 0 && uploadState !== "uploading" && (
          <button
            type="button"
            onClick={() => { setFiles([]); setResult(null); setUploadState("idle"); }}
            className="text-xs text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors font-medium"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
