"use client"

import { useRef, useState, useCallback, useTransition } from "react"
import Link from "next/link"
import { createPosition } from "./actions"

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"

const LABEL_CLS = "block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2"

interface JdFields {
  title: string
  department: string
  location: string
  employmentType: string
  description: string
  jdText: string
}

type UploadState = "idle" | "uploading" | "success" | "error"

export default function NewPositionForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition()

  // Drop zone state
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Controlled form fields
  const [fields, setFields] = useState<JdFields>({
    title: "", department: "", location: "", employmentType: "", description: "", jdText: "",
  })

  const setField = (key: keyof JdFields, val: string) =>
    setFields(prev => ({ ...prev, [key]: val }))

  // ── File processing ──────────────────────────────────────────────────────

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
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/org-admin/jd-parse", { method: "POST", body: formData })
      const json = await res.json()

      if (!res.ok || !json.success) throw new Error(json.error || "Failed to parse JD")

      const d = json.data
      // Try to match AI-parsed department name to an existing department ID
      const parsedDept = (d.department ?? "").toLowerCase().trim()
      const matchedDept = departments.find(
        dept => dept.name.toLowerCase() === parsedDept
      )
      setFields({
        title:          d.title          ?? "",
        department:     matchedDept?.id   ?? "",
        location:       d.location       ?? "",
        employmentType: d.employmentType ?? "",
        description:    d.description    ?? "",
        jdText:         d.jdText         ?? "",
      })
      setUploadState("success")
    } catch (err) {
      setUploadState("error")
      setUploadError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [])

  // ── Drag handlers ────────────────────────────────────────────────────────

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])
  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  // ── Form submit ──────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await createPosition(fd) })
  }

  // ── Drop zone classes ────────────────────────────────────────────────────

  const dropZoneClass = [
    "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 cursor-pointer",
    isDragging
      ? "border-teal-400 bg-teal-500/10 scale-[1.01]"
      : uploadState === "success"
      ? "border-emerald-500 bg-emerald-500/5"
      : uploadState === "error"
      ? "border-red-500 bg-red-500/5"
      : "border-gray-300 dark:border-zinc-700 hover:border-teal-400 hover:bg-teal-500/5",
  ].join(" ")

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Back link + header */}
      <div className="mb-8">
        <Link
          href="/org-admin/positions"
          className="text-sm text-teal-600 dark:text-teal-400 hover:underline mb-4 inline-block"
        >
          ← Back to Positions
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Post New Position
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
          Drop your JD file to auto-fill, or fill in the details manually.
        </p>
      </div>

      {/* JD Drop Zone Card */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base font-semibold text-gray-900 dark:text-white">✨ AI Auto-Fill</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">(PDF, DOCX, or TXT)</span>
        </div>

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
            onChange={onFileInput}
          />

          {uploadState === "idle" && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-2xl select-none">
                📄
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isDragging ? "Release to process your JD!" : "Drag & drop your Job Description here"}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  or{" "}
                  <span className="text-teal-500 font-medium underline underline-offset-2">browse file</span>
                  {" "}— AI will extract & auto-fill all fields below
                </p>
              </div>
            </>
          )}

          {uploadState === "uploading" && (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-teal-500">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-semibold">AI is reading your JD…</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500">Extracting fields, this takes a few seconds</p>
            </div>
          )}

          {uploadState === "success" && (
            <div className="text-center space-y-2">
              <div className="text-3xl">✅</div>
              <p className="text-sm font-semibold text-emerald-500">Fields auto-filled from your JD!</p>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setUploadState("idle")
                  setFields({ title: "", department: "", location: "", employmentType: "", description: "", jdText: "" })
                }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2"
              >
                Clear & upload a different file
              </button>
            </div>
          )}

          {uploadState === "error" && (
            <div className="text-center space-y-2">
              <div className="text-3xl">❌</div>
              <p className="text-sm font-semibold text-red-500">Failed to parse JD</p>
              <p className="text-xs text-red-400">{uploadError}</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setUploadState("idle") }}
                className="text-xs text-teal-500 font-medium hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
        <span className="text-xs text-gray-400 dark:text-zinc-600 font-medium uppercase tracking-wider">
          {uploadState === "success" ? "Review & edit auto-filled details" : "Or fill in manually"}
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
      </div>

      {/* ── Position Form Card ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          <div>
            <label htmlFor="title" className={LABEL_CLS}>
              Position Title <span className="text-red-500">*</span>
            </label>
            <input
              required id="title" name="title" type="text"
              placeholder="e.g. Senior Frontend Engineer"
              className={INPUT_CLS}
              value={fields.title}
              onChange={e => setField("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="department" className={LABEL_CLS}>Department</label>
              <select id="department" name="department"
                className={INPUT_CLS} value={fields.department}
                onChange={e => setField("department", e.target.value)}>
                <option value="" className="dark:bg-zinc-800">Select department…</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id} className="dark:bg-zinc-800">{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="location" className={LABEL_CLS}>Location</label>
              <input id="location" name="location" type="text" placeholder="e.g. Remote / NYC"
                className={INPUT_CLS} value={fields.location}
                onChange={e => setField("location", e.target.value)} />
            </div>
            <div>
              <label htmlFor="employmentType" className={LABEL_CLS}>Employment Type</label>
              <select id="employmentType" name="employmentType" className={INPUT_CLS}
                value={fields.employmentType}
                onChange={e => setField("employmentType", e.target.value)}>
                <option value="" className="dark:bg-zinc-800">Select type…</option>
                <option value="FULL_TIME" className="dark:bg-zinc-800">Full-time</option>
                <option value="PART_TIME" className="dark:bg-zinc-800">Part-time</option>
                <option value="CONTRACT" className="dark:bg-zinc-800">Contract</option>
                <option value="INTERNSHIP" className="dark:bg-zinc-800">Internship</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-1/3">
            <label htmlFor="status" className={LABEL_CLS}>Status</label>
            <select id="status" name="status" defaultValue="DRAFT" className={INPUT_CLS}>
              <option value="DRAFT" className="dark:bg-zinc-800">Draft</option>
              <option value="OPEN" className="dark:bg-zinc-800">Open</option>
              <option value="PAUSED" className="dark:bg-zinc-800">Paused</option>
              <option value="CLOSED" className="dark:bg-zinc-800">Closed</option>
              <option value="ARCHIVED" className="dark:bg-zinc-800">Archived</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className={LABEL_CLS}>Short Description</label>
            <textarea id="description" name="description" rows={3}
              placeholder="A brief, public-facing summary shown to candidates on the listings page."
              className={INPUT_CLS} value={fields.description}
              onChange={e => setField("description", e.target.value)} />
          </div>

          <div>
            <label htmlFor="jdText" className={LABEL_CLS}>Full Job Description</label>
            <textarea id="jdText" name="jdText" rows={10}
              placeholder={`Paste or write the full job description here.\n\nYou can include:\n• Responsibilities\n• Requirements\n• Tech stack\n• Benefits`}
              className={INPUT_CLS} value={fields.jdText}
              onChange={e => setField("jdText", e.target.value)} />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              This text will also be used for AI-powered resume ranking in a later step.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
            <Link
              href="/org-admin/positions"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-zinc-700 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : "Save Position"}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
