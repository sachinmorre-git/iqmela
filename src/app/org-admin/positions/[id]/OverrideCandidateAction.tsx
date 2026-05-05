"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { overrideCandidateAction } from "./actions"

export function OverrideCandidateAction({
  resumeId,
  aiName,
  aiEmail,
  aiPhone,
  aiLinkedin,
  overrideName,
  overrideEmail,
  overridePhone,
  overrideLinkedin
}: {
  resumeId: string
  aiName: string | null
  aiEmail: string | null
  aiPhone: string | null
  aiLinkedin: string | null
  overrideName: string | null
  overrideEmail: string | null
  overridePhone: string | null
  overrideLinkedin: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  
  const [form, setForm] = useState({
    overrideName: overrideName || aiName || "",
    overrideEmail: overrideEmail || aiEmail || "",
    overridePhone: overridePhone || aiPhone || "",
    overrideLinkedinUrl: overrideLinkedin || aiLinkedin || ""
  })

  // When opening modal, reset to current correct values
  const handleOpen = () => {
    setForm({
      overrideName: overrideName || aiName || "",
      overrideEmail: overrideEmail || aiEmail || "",
      overridePhone: overridePhone || aiPhone || "",
      overrideLinkedinUrl: overrideLinkedin || aiLinkedin || ""
    })
    setIsOpen(true)
  }

  const handleSave = () => {
    startTransition(async () => {
      // Send empty strings as null to clear overrides if they are deleted
      await overrideCandidateAction(resumeId, {
        overrideName: form.overrideName !== (aiName || "") ? form.overrideName : "",
        overrideEmail: form.overrideEmail !== (aiEmail || "") ? form.overrideEmail : "",
        overridePhone: form.overridePhone !== (aiPhone || "") ? form.overridePhone : "",
        overrideLinkedinUrl: form.overrideLinkedinUrl !== (aiLinkedin || "") ? form.overrideLinkedinUrl : ""
      })
      setIsOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        disabled={isPending}
        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-1 shrink-0"
        title="Override AI Extracted Details"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Edit Candidate Details</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Manually override the AI-extracted candidate information. Original AI values will be preserved in the background.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Name</span>
                <input
                  type="text"
                  value={form.overrideName}
                  onChange={(e) => setForm({ ...form, overrideName: e.target.value })}
                  placeholder={aiName || "Unknown"}
                  className="w-full border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow"
                />
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Email</span>
                <input
                  type="email"
                  value={form.overrideEmail}
                  onChange={(e) => setForm({ ...form, overrideEmail: e.target.value })}
                  placeholder={aiEmail || "Unknown"}
                  className="w-full border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow"
                />
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Phone</span>
                <input
                  type="text"
                  value={form.overridePhone}
                  onChange={(e) => setForm({ ...form, overridePhone: e.target.value })}
                  placeholder={aiPhone || "Unknown"}
                  className="w-full border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow"
                />
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">LinkedIn URL</span>
                <input
                  type="url"
                  value={form.overrideLinkedinUrl}
                  onChange={(e) => setForm({ ...form, overrideLinkedinUrl: e.target.value })}
                  placeholder={aiLinkedin || "Unknown"}
                  className="w-full border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow"
                />
              </label>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-zinc-800 transition-colors"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Overrides"}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
