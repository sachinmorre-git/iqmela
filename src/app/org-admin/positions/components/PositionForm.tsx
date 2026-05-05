"use client"

import { useRef, useState, useCallback, useTransition } from "react"
import Link from "next/link"
import {
  Zap,
  Sparkles,
} from "lucide-react"
import { InterviewPlanConfigurator } from "../[id]/InterviewPlanConfigurator"
import { StageInput } from "../[id]/pipeline-actions"

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"

const LABEL_CLS = "block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2"

interface JdFields {
  title: string
  department: string
  location: string
  employmentType: string
  description: string
  jdText: string
}

const DEFAULT_PIPELINE: StageInput[] = [
  { stageIndex: 0, roundLabel: "AI Screen", roundType: "AI_SCREEN", durationMinutes: 30, isRequired: true },
  { stageIndex: 1, roundLabel: "Panel Round 1", roundType: "PANEL", durationMinutes: 45, isRequired: true },
  { stageIndex: 2, roundLabel: "Panel Round 2", roundType: "PANEL", durationMinutes: 45, isRequired: true },
]

type UploadState = "idle" | "uploading" | "success" | "error"

export default function PositionForm({
  mode,
  departments,
  position,
  existingStages,
  hasPlan,
  defaultGenerationStrategy,
  serverAction,
}: {
  mode: "create" | "edit"
  departments: { id: string; name: string }[]
  position?: any
  existingStages?: any[]
  hasPlan?: boolean
  defaultGenerationStrategy?: string
  serverAction: (formData: FormData) => Promise<void>
}) {
  const isEdit = mode === "edit"
  const [isPending, startTransition] = useTransition()

  // Drop zone state
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Controlled form fields
  const [fields, setFields] = useState<JdFields>({
    title: position?.title || "",
    department: position?.departmentId || "",
    location: position?.location || "",
    employmentType: position?.employmentType || "",
    description: position?.description || "",
    jdText: position?.jdText || "",
  })

  // Settings State
  const [settings, setSettings] = useState({
    intakeWindowDays: position?.intakeWindowDays ?? 10,
    atsPreScreenSize: position?.atsPreScreenSize ?? 100,
    aiShortlistSize: position?.aiShortlistSize ?? 10,
    autoProcessOnClose: position?.autoProcessOnClose ?? true,
    autoInviteAiScreen: position?.autoInviteAiScreen ?? false,
    resumePurgeDays: position?.resumePurgeDays ?? 90,
    aiGenerationStrategy: position?.aiInterviewConfigs?.[0]?.generationStrategy ?? defaultGenerationStrategy ?? "STANDARDIZED",
  })

  // Pipeline stages
  const mappedExisting: StageInput[] | undefined = existingStages?.map((s, i) => ({
    stageIndex: s.stageIndex ?? i,
    roundLabel: s.roundLabel,
    roundType: s.roundType,
    durationMinutes: s.durationMinutes,
    isRequired: s.isRequired ?? true,
    description: s.description ?? undefined,
    assignedPanelJson: s.assignedPanelJson ?? undefined,
  }))
  const [pipelineStages, setPipelineStages] = useState<StageInput[]>(
    isEdit && mappedExisting?.length ? mappedExisting : DEFAULT_PIPELINE
  )

  const setField = (key: keyof JdFields, val: string) =>
    setFields(prev => ({ ...prev, [key]: val }))
  
  const setSetting = (key: keyof typeof settings, val: number | boolean | string) =>
    setSettings(prev => ({ ...prev, [key]: val }))

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
    startTransition(async () => { await serverAction(fd) })
  }

  // ── Drop zone classes ────────────────────────────────────────────────────

  const dropZoneClass = [
    "relative flex items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-4 transition-all duration-200 cursor-pointer",
    isDragging
      ? "border-rose-400 bg-rose-500/10 scale-[1.005]"
      : uploadState === "success"
      ? "border-emerald-500 bg-emerald-500/5"
      : uploadState === "error"
      ? "border-red-500 bg-red-500/5"
      : "border-gray-300 dark:border-zinc-700 hover:border-rose-400 hover:bg-rose-500/5",
  ].join(" ")

  return (
    <div className="w-full max-w-7xl mx-auto px-2">
      {/* Back link + header */}
      <div className="mb-6 mb-8">
        <Link
          href={isEdit ? `/org-admin/positions/${position?.id}` : "/org-admin/positions"}
          className="text-sm text-rose-600 dark:text-rose-400 hover:underline mb-4 inline-block font-medium"
        >
          {isEdit ? "← Back to Position" : "← Back to Positions"}
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {isEdit ? "Edit Position" : "Post New Position"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
          {isEdit
            ? <>Update the details for <span className="font-semibold text-gray-700 dark:text-gray-300">{position?.title}</span>.</>
            : "Drop your JD file to auto-fill, or perfectly tailor it manually."
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col xl:flex-row gap-6 xl:gap-8 items-start">
        {isEdit && <input type="hidden" name="id" value={position?.id} />}
        
        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-6">

          {/* JD Drop Zone — compact inline */}
          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
            <div
              className={dropZoneClass}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => uploadState !== "uploading" && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={onFileInput} />
              {uploadState === "idle" && (
                <>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-lg select-none shrink-0">📄</div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {isDragging ? "Release to process your JD!" : <>✨ Drag & drop your Job Description <span className="text-xs text-gray-400 dark:text-zinc-500 font-normal">(PDF, DOCX, TXT)</span></>}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                      or <span className="text-rose-500 font-medium underline underline-offset-2">browse file</span> — AI will extract & auto-fill all fields
                    </p>
                  </div>
                </>
              )}
              {uploadState === "uploading" && (
                <div className="inline-flex items-center gap-2 text-rose-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-semibold">AI is reading your JD…</span>
                </div>
              )}
              {uploadState === "success" && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <p className="text-sm font-semibold text-emerald-500">Fields auto-filled!</p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setUploadState("idle"); setFields({ title: "", department: "", location: "", employmentType: "", description: "", jdText: "" }) }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 ml-2"
                  >
                    Upload different file
                  </button>
                </div>
              )}
              {uploadState === "error" && (
                <div className="flex items-center gap-3">
                  <span className="text-xl">❌</span>
                  <p className="text-sm font-semibold text-red-500">Failed to parse JD</p>
                  <p className="text-xs text-red-400">{uploadError}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); setUploadState("idle") }} className="text-xs text-rose-500 font-medium hover:underline ml-2">Try again</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Divider ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
            <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
              {uploadState === "success" ? "Review & edit auto-filled details" : "Or fill in manually"}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-zinc-800" />
          </div>

          {/* Main Form Fields */}
          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 md:p-8 space-y-6">
            <div>
              <label htmlFor="title" className={LABEL_CLS}>Position Title <span className="text-red-500">*</span></label>
              <input required id="title" name="title" type="text" placeholder="e.g. Senior Frontend Engineer" className={INPUT_CLS} value={fields.title} onChange={e => setField("title", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label htmlFor="department" className={LABEL_CLS}>Department</label>
                <select id="department" name="department" className={INPUT_CLS} value={fields.department} onChange={e => setField("department", e.target.value)}>
                  <option value="" className="dark:bg-zinc-800">Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id} className="dark:bg-zinc-800">{d.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="location" className={LABEL_CLS}>Location</label>
                <input id="location" name="location" type="text" placeholder="e.g. Remote / NYC" className={INPUT_CLS} value={fields.location} onChange={e => setField("location", e.target.value)} />
              </div>
              <div>
                <label htmlFor="employmentType" className={LABEL_CLS}>Employment Type</label>
                <select id="employmentType" name="employmentType" className={INPUT_CLS} value={fields.employmentType} onChange={e => setField("employmentType", e.target.value)}>
                  <option value="" className="dark:bg-zinc-800">Select type…</option>
                  <option value="FULL_TIME" className="dark:bg-zinc-800">Full-time</option>
                  <option value="PART_TIME" className="dark:bg-zinc-800">Part-time</option>
                  <option value="CONTRACT" className="dark:bg-zinc-800">Contract</option>
                  <option value="INTERNSHIP" className="dark:bg-zinc-800">Internship</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="description" className={LABEL_CLS}>Short Description</label>
              <textarea id="description" name="description" rows={2} placeholder="A brief, public-facing summary shown to candidates on the listings page." className={INPUT_CLS} value={fields.description} onChange={e => setField("description", e.target.value)} />
            </div>

            <div>
              <label htmlFor="jdText" className={LABEL_CLS}>Full Job Description</label>
              <textarea id="jdText" name="jdText" rows={12} placeholder={`Paste or write the full job description here.\n\nYou can include:\n• Responsibilities\n• Requirements\n• Tech stack\n• Benefits`} className={INPUT_CLS} value={fields.jdText} onChange={e => setField("jdText", e.target.value)} />
              <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">This text will be analyzed by the AI for resume ranking.</p>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN: SETTINGS SIDEBAR ── */}
        <div className="w-full xl:w-[460px] shrink-0 flex flex-col gap-6 xl:sticky xl:top-8">
          
          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 space-y-8">
            
            {/* Status */}
            <div>
              <label htmlFor="status" className={LABEL_CLS}>Publish Status</label>
              <select id="status" name="status" defaultValue={position?.status || "DRAFT"} className={INPUT_CLS}>
                <option value="DRAFT" className="dark:bg-zinc-800">Draft (Invisible)</option>
                <option value="OPEN" className="dark:bg-zinc-800">Open (Accepting candidates)</option>
                <option value="PAUSED" className="dark:bg-zinc-800">Paused</option>
                <option value="CLOSED" className="dark:bg-zinc-800">Closed</option>
                <option value="ARCHIVED" className="dark:bg-zinc-800">Archived</option>
              </select>
            </div>

            {/* AI Settings */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Zap size={16} className="text-rose-500 fill-rose-500/20" />
                AI Pipeline Settings
              </h3>
              
              <div className="space-y-3">
                {/* Compact Cards */}
                <div className="bg-gray-50 dark:bg-[#1a1b1e] rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Intake Window</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" name="intakeWindowDays" min="1" max="60" value={settings.intakeWindowDays} onChange={(e) => setSetting("intakeWindowDays", parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
                    <div className="flex items-center gap-1 shrink-0 justify-end">
                      <input type="number" min="1" max="60" value={settings.intakeWindowDays} onChange={(e) => setSetting("intakeWindowDays", parseInt(e.target.value) || 1)} className="w-[32px] bg-transparent focus:outline-none text-[13px] font-mono font-bold text-gray-800 dark:text-gray-300 tabular-nums py-0.5 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-transparent focus:border-rose-500" />
                      <span className="text-[12px] text-gray-500 font-mono">d</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#1a1b1e] rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[14px] font-bold text-gray-800 dark:text-gray-200">ATS Pre-Screen Pool</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" name="atsPreScreenSize" min="10" max="500" step="10" value={settings.atsPreScreenSize} onChange={(e) => setSetting("atsPreScreenSize", parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
                    <div className="flex items-center gap-1 shrink-0 justify-end">
                      <input type="number" min="10" max="500" step="10" value={settings.atsPreScreenSize} onChange={(e) => setSetting("atsPreScreenSize", parseInt(e.target.value) || 10)} className="w-[38px] bg-transparent focus:outline-none text-[13px] font-mono font-bold text-gray-800 dark:text-gray-300 tabular-nums py-0.5 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-transparent focus:border-rose-500" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#1a1b1e] rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[14px] font-bold text-gray-800 dark:text-gray-200">AI Shortlist Size</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" name="aiShortlistSize" min="5" max="50" step="5" value={settings.aiShortlistSize} onChange={(e) => setSetting("aiShortlistSize", parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
                     <div className="flex items-center gap-1 shrink-0 justify-end bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded">
                      <input type="number" min="5" max="50" step="5" value={settings.aiShortlistSize} onChange={(e) => setSetting("aiShortlistSize", parseInt(e.target.value) || 5)} className="w-[28px] bg-transparent focus:outline-none text-[13px] font-mono font-bold text-rose-800 dark:text-rose-400 tabular-nums text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#1a1b1e] rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Resume Purge Limit</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" name="resumePurgeDays" min="30" max="365" step="30" value={settings.resumePurgeDays} onChange={(e) => setSetting("resumePurgeDays", parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
                    <div className="flex items-center gap-1 shrink-0 justify-end">
                      <input type="number" min="30" max="365" step="30" value={settings.resumePurgeDays} onChange={(e) => setSetting("resumePurgeDays", parseInt(e.target.value) || 30)} className="w-[38px] bg-transparent focus:outline-none text-[13px] font-mono font-bold text-gray-800 dark:text-gray-300 tabular-nums py-0.5 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-transparent focus:border-rose-500" />
                      <span className="text-[12px] text-gray-500 font-mono">d</span>
                    </div>
                  </div>
                </div>
                
                {/* Auto Process Toggle */}
                <div className="mt-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl p-3 flex items-center justify-between">
                   <div className="text-sm font-bold text-rose-900 dark:text-rose-400">Auto-Process on Close</div>
                   <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input type="checkbox" checked={settings.autoProcessOnClose} onChange={(e) => setSetting("autoProcessOnClose", e.target.checked)} className="sr-only peer" />
                      <input type="hidden" name="autoProcessOnClose" value={settings.autoProcessOnClose ? "true" : "false"} />
                      <div className="w-9 h-5 bg-rose-200 dark:bg-rose-900/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                    </label>
                </div>

                {/* Auto-Invite AI Screen Toggle */}
                <div className="mt-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-3 flex items-center justify-between">
                   <div className="text-sm font-bold text-indigo-900 dark:text-indigo-400">Auto-Invite AI Screening</div>
                   <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input type="checkbox" checked={settings.autoInviteAiScreen} onChange={(e) => setSetting("autoInviteAiScreen", e.target.checked)} className="sr-only peer" />
                      <input type="hidden" name="autoInviteAiScreen" value={settings.autoInviteAiScreen ? "true" : "false"} />
                      <div className="w-9 h-5 bg-indigo-200 dark:bg-indigo-900/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                    </label>
                </div>

                {/* AI Screening Round Questions Strategy */}
                <div className="bg-gray-50 dark:bg-[#1a1b1e] rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[14px] font-bold text-gray-800 dark:text-gray-200">AI Screening Round Questions Strategy</div>
                  </div>
                  <input type="hidden" name="aiGenerationStrategy" value={settings.aiGenerationStrategy} />
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="aiGenerationStrategyRadio"
                          value="STANDARDIZED"
                          checked={settings.aiGenerationStrategy === "STANDARDIZED"}
                          onChange={() => setSetting("aiGenerationStrategy", "STANDARDIZED")}
                          className="w-4 h-4 text-rose-600 bg-gray-100 border-gray-300 focus:ring-rose-500 dark:focus:ring-rose-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600 mt-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-rose-600 transition-colors">Common Questions</span>
                        <span className="text-xs text-gray-500 dark:text-zinc-400">Job description based</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="aiGenerationStrategyRadio"
                          value="TAILORED"
                          checked={settings.aiGenerationStrategy === "TAILORED"}
                          onChange={() => setSetting("aiGenerationStrategy", "TAILORED")}
                          className="w-4 h-4 text-rose-600 bg-gray-100 border-gray-300 focus:ring-rose-500 dark:focus:ring-rose-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-zinc-700 dark:border-zinc-600 mt-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-rose-600 transition-colors">Tailored Questions</span>
                        <span className="text-xs text-gray-500 dark:text-zinc-400">Individual resume based</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* ── INTERVIEW PIPELINE CONFIGURATOR ── */}
          <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <InterviewPlanConfigurator 
              existingStages={pipelineStages}
              hasPlan={isEdit ? (hasPlan || pipelineStages.length > 0) : undefined}
              onChange={setPipelineStages} 
            />
            {/* Hidden input to serialize pipeline stages for form submission */}
            <input type="hidden" name="pipelineStages" value={JSON.stringify(pipelineStages)} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={isEdit ? `/org-admin/positions/${position?.id}` : "/org-admin/positions"}
              className="flex-1 inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-zinc-700 px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center rounded-xl px-6 py-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : isEdit ? "Save Changes" : "Save Position"}
            </button>
          </div>

        </div>

      </form>
    </div>
  )
}
