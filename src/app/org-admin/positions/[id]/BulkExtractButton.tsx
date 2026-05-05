"use client"

import { useState, useTransition } from "react"
import { bulkExtractAllAction, BulkExtractionResult } from "./actions"

export function BulkExtractButton({
  positionId,
  totalResumes,
}: {
  positionId: string
  totalResumes: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<BulkExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forceReExtract, setForceReExtract] = useState(false)

  const handleClick = () => {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await bulkExtractAllAction(positionId, forceReExtract)
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
        onClick={handleClick}
        disabled={isPending || totalResumes === 0}
        className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white shadow-md shadow-pink-500/20 border border-pink-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 min-w-[220px]"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Extracting all {totalResumes}...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
            Extract All Candidate Data
          </>
        )}
      </button>

      <label className="flex items-center gap-2 mt-1 -mr-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-300 cursor-pointer">
        <input 
          type="checkbox" 
          checked={forceReExtract} 
          onChange={(e) => setForceReExtract(e.target.checked)} 
          disabled={isPending}
          className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 shadow-sm disabled:opacity-50"
        />
        Force re-extract all
      </label>

      {/* Result summary area */}
      {result && !isPending && (
        <div className="flex flex-col gap-3 mt-4 w-full bg-white dark:bg-zinc-800 p-4 rounded-xl border border-pink-100 dark:border-pink-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Extraction Summary</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300">
              Total Processed: {result.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
              ✓ {result.succeeded} Successful
            </span>
            {result.warnings > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                ⚠ {result.warnings} Warnings
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
