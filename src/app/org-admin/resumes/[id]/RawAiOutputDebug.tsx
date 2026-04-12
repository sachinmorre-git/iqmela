"use client"

import { useState } from "react"

export function RawAiOutputDebug({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2 border border-dashed border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          Raw AI Output (debug)
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div className="border-t border-dashed border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30 p-4 max-h-[400px] overflow-y-auto">
          <pre className="text-xs text-gray-500 dark:text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
