"use client"

import { useRef, useState, useCallback } from "react"

type UploadState = "idle" | "uploading" | "success" | "error"

interface JdDrawerProps {
  positionId: string
  description: string | null
  jdText: string | null
  jdKeywords: string[]
  jdRequiredSkills: string[]
  hasJdAnalysis: boolean
}

export function JdDrawer({
  positionId,
  description,
  jdText,
  jdKeywords,
  jdRequiredSkills,
  hasJdAnalysis,
}: JdDrawerProps) {
  const [open, setOpen] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showDropZone, setShowDropZone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File processing ────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ]
    if (!allowed.includes(file.type)) {
      setUploadState("error")
      setUploadError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.")
      return
    }
    setUploadState("uploading")
    setUploadError(null)
    try {
      const { analyzeJdAction } = await import("./actions")
      const formData = new FormData()
      formData.append("positionId", positionId)
      formData.append("file", file)
      // Hit the jd-parse API, then trigger re-analyze
      const res = await fetch("/api/org-admin/jd-parse", { method: "POST", body: formData })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to parse JD")
      setUploadState("success")
      setTimeout(() => {
        setShowDropZone(false)
        setUploadState("idle")
        window.location.reload()
      }, 1500)
    } catch (err) {
      setUploadState("error")
      setUploadError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [positionId])

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const dropZoneClass = [
    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all duration-200",
    isDragging
      ? "border-teal-400 bg-teal-500/10"
      : uploadState === "success"
      ? "border-emerald-500 bg-emerald-500/5"
      : uploadState === "error"
      ? "border-red-400 bg-red-500/5"
      : "border-gray-300 dark:border-zinc-700 hover:border-teal-400 hover:bg-teal-500/5",
  ].join(" ")

  return (
    <>
      {/* ── 5th info card trigger ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col justify-between h-full w-full text-left rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-900/10 shadow-sm px-4 py-4 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:shadow-md transition-all group cursor-pointer"
      >
        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          Job Description
        </p>
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {jdText ? "View / Re-Analyze" : "No JD yet"}
          </p>
          <svg className="w-4 h-4 text-teal-500 group-hover:translate-x-0.5 transition-transform shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer ────────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">📄 Job Description</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              {jdText ? "Full description & AI analysis" : "No JD added yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {jdText && (
              <button
                onClick={() => { setShowDropZone(v => !v); setUploadState("idle"); setUploadError(null) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-500 text-teal-500 hover:bg-teal-500 hover:text-white transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {showDropZone ? "Cancel" : "Re-Analyze JD"}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* Re-Analyze drop zone (collapsible) */}
          {showDropZone && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div
                className={dropZoneClass}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => uploadState !== "uploading" && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
                />
                {uploadState === "idle" && (
                  <>
                    <div className="text-2xl select-none">📄</div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {isDragging ? "Release to upload!" : "Drop new JD file here"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        or <span className="text-teal-500 underline underline-offset-2">browse</span> · PDF, DOCX, TXT
                      </p>
                    </div>
                  </>
                )}
                {uploadState === "uploading" && (
                  <div className="flex items-center gap-2 text-teal-500">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-sm font-semibold">Parsing & re-analyzing…</span>
                  </div>
                )}
                {uploadState === "success" && (
                  <div className="text-center">
                    <div className="text-2xl">✅</div>
                    <p className="text-sm font-semibold text-emerald-500 mt-1">Done! Refreshing…</p>
                  </div>
                )}
                {uploadState === "error" && (
                  <div className="text-center space-y-1">
                    <div className="text-2xl">❌</div>
                    <p className="text-xs text-red-500">{uploadError}</p>
                    <button onClick={e => { e.stopPropagation(); setUploadState("idle") }} className="text-xs text-teal-500 underline">Try again</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Short Description */}
          {description && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Short Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
            </div>
          )}

          {/* Divider if both exist */}
          {description && jdText && <div className="h-px bg-gray-100 dark:bg-zinc-800" />}

          {/* Full JD text */}
          {jdText ? (
            <div>
              <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Full Job Description</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{jdText}</p>

              {/* AI analysis pills */}
              {hasJdAnalysis && (
                <div className="mt-6 flex flex-col gap-4">
                  {jdRequiredSkills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {jdRequiredSkills.map(s => (
                          <span key={s} className="px-2 py-1 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-100 dark:border-violet-800/30">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {jdKeywords.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Core Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {jdKeywords.map(k => (
                          <span key={k} className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No job description yet</p>
              <p className="text-xs text-gray-400 mt-1">Edit this position to add a JD</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
