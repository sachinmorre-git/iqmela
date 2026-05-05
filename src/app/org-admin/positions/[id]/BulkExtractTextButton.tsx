"use client"

import { useState, useTransition } from "react"
import { bulkExtractTextAction, type TextExtractionResult } from "./actions"

export function BulkExtractTextButton({
  positionId,
  totalResumes,
  alreadyExtracted,
}: {
  positionId: string
  totalResumes: number
  alreadyExtracted: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<TextExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remaining = totalResumes - alreadyExtracted

  const handleClick = () => {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await bulkExtractTextAction(positionId)
      if (!res.success) {
        setError(res.error ?? "Unknown error")
      } else if (res.result) {
        setResult(res.result)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || totalResumes === 0}
        className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-rose-600 hover:from-cyan-700 hover:to-rose-700 text-white shadow-md shadow-rose-500/20 border border-rose-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 w-full min-w-[220px]"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Extracting text from {remaining} file{remaining !== 1 ? "s" : ""}…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Extract All Resume Text
            {remaining > 0 && (
              <span className="text-[10px] opacity-75 font-normal">
                ({remaining} new)
              </span>
            )}
          </>
        )}
      </button>

      {/* Result summary */}
      {result && !isPending && (
        <div className="flex flex-col gap-3 w-full bg-white dark:bg-zinc-800 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Text Extraction Summary</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300">
              Total: {result.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
              ✓ {result.succeeded} Extracted
            </span>
            {result.skipped > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                ↩ {result.skipped} Skipped
              </span>
            )}
            {result.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                ✗ {result.failed} Failed
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="w-full flex flex-col gap-1.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 p-2.5">
              {result.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-600 dark:text-red-400 leading-tight">
                  <strong className="font-semibold">{e.fileName}:</strong> {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && !isPending && (
        <p className="text-xs text-red-500 dark:text-red-400 text-right">{error}</p>
      )}
    </div>
  )
}
