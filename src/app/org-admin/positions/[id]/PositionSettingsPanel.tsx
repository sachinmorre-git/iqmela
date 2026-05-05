"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle2, ChevronRight } from "lucide-react"
import { updatePositionSettingsAction, type PositionSettingsInput } from "./position-settings-actions"

/* ═══════════════════════════════════════════════════════════════════ */
/*  REUSABLE APPLE-STYLE PRIMITIVES                                  */
/* ═══════════════════════════════════════════════════════════════════ */

function SettingSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Sync draft when value changes externally (e.g. from slider)
  const displayed = focused ? draft : String(value)

  const handleBlur = () => {
    setFocused(false)
    const n = parseInt(draft, 10)
    if (isNaN(n) || draft.trim() === "") {
      setDraft(String(value)) // revert to last valid
    } else {
      const clamped = Math.max(min, Math.min(max, n))
      onChange(clamped)
      setDraft(String(clamped))
    }
  }

  return (
    <div className="flex items-center gap-6 py-5 border-b border-gray-100 dark:border-zinc-800/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight">{label}</p>
        <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => { onChange(Number(e.target.value)); setDraft(e.target.value) }}
          className="w-28 h-1 accent-rose-500 bg-gray-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
        />
        <div className="flex items-center gap-0.5">
          <input
            type="text"
            inputMode="numeric"
            value={displayed}
            onFocus={() => { setFocused(true); setDraft(String(value)) }}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            className="w-12 text-right text-sm font-bold text-gray-900 dark:text-white tabular-nums bg-transparent border-b border-gray-200 dark:border-zinc-700 focus:border-rose-500 focus:outline-none py-0.5"
          />
          {unit && (
            <span className="text-xs text-gray-400 dark:text-zinc-500 ml-0.5">{unit}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-6 py-5 border-b border-gray-100 dark:border-zinc-800/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight">{label}</p>
        <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 ease-in-out ${
          value ? "bg-rose-500" : "bg-gray-300 dark:bg-zinc-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  FUNNEL VISUALIZATION — shows the 3-stage pipeline at a glance    */
/* ═══════════════════════════════════════════════════════════════════ */

function FunnelViz({
  intakeDays,
  preScreenSize,
  shortlistSize,
}: {
  intakeDays: number
  preScreenSize: number
  shortlistSize: number
}) {
  const stages = [
    {
      label: "Intake",
      value: `${intakeDays} days`,
      sublabel: "All platforms",
      color: "from-sky-500 to-cyan-500",
      bg: "bg-sky-500/10 dark:bg-sky-500/5",
      border: "border-sky-200 dark:border-sky-800/40",
      text: "text-sky-700 dark:text-sky-400",
      icon: "📥",
    },
    {
      label: "ATS Screen",
      value: `Top ${preScreenSize}`,
      sublabel: "Zero cost",
      color: "from-pink-500 to-purple-500",
      bg: "bg-pink-500/10 dark:bg-pink-500/5",
      border: "border-pink-200 dark:border-pink-800/40",
      text: "text-pink-700 dark:text-pink-400",
      icon: "⚡",
    },
    {
      label: "AI Shortlist",
      value: `Top ${shortlistSize}`,
      sublabel: "Deep analysis",
      color: "from-rose-500 to-emerald-500",
      bg: "bg-rose-500/10 dark:bg-rose-500/5",
      border: "border-rose-200 dark:border-rose-800/40",
      text: "text-rose-700 dark:text-rose-400",
      icon: "🧠",
    },
  ]

  return (
    <div className="flex items-center gap-0">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div
            className={`flex flex-col items-center gap-1 px-5 py-4 rounded-2xl border ${s.bg} ${s.border} min-w-[140px]`}
          >
            <span className="text-lg">{s.icon}</span>
            <span className={`text-xl font-black tabular-nums ${s.text}`}>{s.value}</span>
            <span className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {s.label}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">{s.sublabel}</span>
          </div>
          {i < stages.length - 1 && (
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-zinc-600 mx-1 shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  MAIN PANEL                                                       */
/* ═══════════════════════════════════════════════════════════════════ */

export function PositionSettingsPanel({
  positionId,
  initial,
}: {
  positionId: string
  initial: PositionSettingsInput
}) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<PositionSettingsInput>(initial)

  const set = <K extends keyof PositionSettingsInput>(k: K, v: PositionSettingsInput[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await updatePositionSettingsAction(positionId, form)
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        setError(res.error ?? "Failed to save")
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Funnel Visualization ─────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          Hiring Funnel
        </h3>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6">
          <FunnelViz
            intakeDays={form.intakeWindowDays}
            preScreenSize={form.atsPreScreenSize}
            shortlistSize={form.aiShortlistSize}
          />
        </div>
      </section>

      {/* ── AI Pipeline Settings (Compact Grid) ───────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3 mt-6">
          <div>
            <h3 className="text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
              AI Pipeline Configuration
            </h3>
            <p className="text-[13px] text-gray-500 dark:text-zinc-400">
              Configure how resumes are processed and retained for this position.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Card 1: Intake Window */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col justify-between">
            <div className="mb-4">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-200">Intake Window</div>
              <div className="text-[12px] text-gray-500 dark:text-zinc-400 mt-1 leading-snug">Days to accept resumes before auto-rejecting.</div>
            </div>
            <div className="flex items-center gap-4 mt-auto">
              <input type="range" min="3" max="60" step="1" value={form.intakeWindowDays} onChange={(e) => set("intakeWindowDays", parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
              <div className="flex items-center gap-1 shrink-0 justify-end">
                <input type="number" min="3" max="60" value={form.intakeWindowDays} onChange={(e) => set("intakeWindowDays", parseInt(e.target.value) || 3)} className="w-10 text-right bg-transparent border-b border-transparent focus:border-rose-500 hover:border-gray-300 dark:hover:border-zinc-600 focus:outline-none text-[15px] font-bold text-gray-900 dark:text-white tabular-nums py-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-[13px] text-gray-400">d</span>
              </div>
            </div>
          </div>

          {/* Card 2: ATS Pre-Screen Pool */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col justify-between">
            <div className="mb-4">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-200">ATS Pre-Screen Pool</div>
              <div className="text-[12px] text-gray-500 dark:text-zinc-400 mt-1 leading-snug">Zero-cost keyword screening limit.</div>
            </div>
            <div className="flex items-center gap-4 mt-auto">
              <input type="range" min="10" max="500" step="10" value={form.atsPreScreenSize} onChange={(e) => set("atsPreScreenSize", parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
              <div className="flex items-center gap-1 shrink-0 justify-end">
                <input type="number" min="10" max="500" step="10" value={form.atsPreScreenSize} onChange={(e) => set("atsPreScreenSize", parseInt(e.target.value) || 10)} className="w-12 text-right bg-transparent border-b border-transparent focus:border-rose-500 hover:border-gray-300 dark:hover:border-zinc-600 focus:outline-none text-[15px] font-bold text-gray-900 dark:text-white tabular-nums py-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          </div>

          {/* Card 3: AI Shortlist Size */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col justify-between">
            <div className="mb-4">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-200">AI Shortlist Size</div>
              <div className="text-[12px] text-gray-500 dark:text-zinc-400 mt-1 leading-snug">Number of candidates deep-scored by AI.</div>
            </div>
            <div className="flex items-center gap-4 mt-auto">
              <input type="range" min="1" max="50" step="1" value={form.aiShortlistSize} onChange={(e) => set("aiShortlistSize", parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
              <div className="flex items-center gap-1 shrink-0 justify-end">
                <input type="number" min="1" max="50" value={form.aiShortlistSize} onChange={(e) => set("aiShortlistSize", parseInt(e.target.value) || 1)} className="w-10 text-right bg-transparent border-b border-transparent focus:border-rose-500 hover:border-gray-300 dark:hover:border-zinc-600 focus:outline-none text-[15px] font-bold text-gray-900 dark:text-white tabular-nums py-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          </div>

          {/* Card 4: Data Retention */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col justify-between">
            <div className="mb-4">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-200">Resume Purge Limit</div>
              <div className="text-[12px] text-gray-500 dark:text-zinc-400 mt-1 leading-snug">Days to retain raw PDF files for compliance.</div>
            </div>
            <div className="flex items-center gap-4 mt-auto">
              <input type="range" min="7" max="365" step="7" value={form.resumePurgeDays} onChange={(e) => set("resumePurgeDays", parseInt(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer dark:bg-zinc-700 accent-rose-500" />
              <div className="flex items-center gap-1 shrink-0 justify-end">
                <input type="number" min="7" max="365" step="7" value={form.resumePurgeDays} onChange={(e) => set("resumePurgeDays", parseInt(e.target.value) || 7)} className="w-10 text-right bg-transparent border-b border-transparent focus:border-rose-500 hover:border-gray-300 dark:hover:border-zinc-600 focus:outline-none text-[15px] font-bold text-gray-900 dark:text-white tabular-nums py-0.5 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                <span className="text-[13px] text-gray-400">d</span>
              </div>
            </div>
          </div>

        </div>

        {/* Auto Process Toggle */}
        <div className="mt-3 bg-rose-50 dark:bg-[#0f171c] border border-rose-100 dark:border-rose-900/30 rounded-xl p-4 flex items-center justify-between shadow-sm">
           <div>
              <div className="text-[14px] font-bold text-rose-900 dark:text-rose-500 mb-0.5">Auto-Process on Close</div>
              <div className="text-[12px] text-rose-700 dark:text-rose-700">
                Automatically trigger ATS and AI screening the moment the intake window ends.
              </div>
           </div>
           <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input type="checkbox" checked={form.autoProcessOnClose} onChange={(e) => set("autoProcessOnClose", e.target.checked)} className="sr-only peer" />
              <div className="w-[42px] h-[24px] bg-rose-200/50 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-rose-500"></div>
            </label>
        </div>

        {/* Auto-Invite AI Screen Toggle */}
        <div className="mt-3 bg-indigo-50 dark:bg-[#0f131c] border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 flex items-center justify-between shadow-sm">
           <div>
              <div className="text-[14px] font-bold text-indigo-900 dark:text-indigo-400 mb-0.5">Auto-Invite AI Screening</div>
              <div className="text-[12px] text-indigo-700 dark:text-indigo-600">
                Automatically send AI interview invitations to candidates when they are shortlisted by the pipeline.
              </div>
           </div>
           <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input type="checkbox" checked={form.autoInviteAiScreen} onChange={(e) => set("autoInviteAiScreen", e.target.checked)} className="sr-only peer" />
              <div className="w-[42px] h-[24px] bg-indigo-200/50 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[18px] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
        </div>
      </section>

      {/* ── Save ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          )}
          {isPending ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
