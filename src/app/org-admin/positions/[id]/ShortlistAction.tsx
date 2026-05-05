"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { toggleShortlistAction } from "./actions"

export function ShortlistAction({
  resumeId,
  isShortlisted,
  initialNotes
}: {
  resumeId: string
  isShortlisted: boolean
  initialNotes: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(initialNotes || "")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleToggle = () => {
    startTransition(async () => {
      await toggleShortlistAction(resumeId, !isShortlisted, notes)
    })
  }

  const handleSaveNotes = () => {
    setIsModalOpen(false)
    startTransition(async () => {
      await toggleShortlistAction(resumeId, isShortlisted, notes)
    })
  }

  return (
    <>
      <div className="flex items-center gap-1.5 justify-end w-full">
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
            isShortlisted 
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/60"
              : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300"
          }`}
          title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
        >
          {isPending ? (
            <svg className="animate-spin h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          ) : isShortlisted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="mr-1 text-amber-500"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          )}
          {isShortlisted ? "Shortlisted" : "Shortlist"}
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          title={notes ? "Edit Notes" : "Add Notes"}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors border shadow-sm ${notes ? 'bg-pink-50 border-pink-200 text-pink-600 dark:bg-pink-900/30 dark:border-pink-800 dark:text-pink-400' : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Recruiter Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your thoughts about this candidate..."
              className="w-full min-h-[120px] border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition-shadow resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                onClick={() => {
                  setNotes(initialNotes || "")
                  setIsModalOpen(false)
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-zinc-800 transition-colors"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
