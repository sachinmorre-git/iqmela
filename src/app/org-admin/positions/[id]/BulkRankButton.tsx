"use client"

import { useState, useTransition } from "react"
import { bulkRankAllAction, BulkRankingResult } from "./actions"

export function BulkRankButton({
  positionId,
  totalToRank,
  totalResumes,
}: {
  positionId: string
  totalToRank: number
  totalResumes: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<BulkRankingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await bulkRankAllAction(positionId)
      if (!res.success) {
        setError(res.error ?? "Unknown error")
      } else if (res.result) {
        setResult(res.result)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={isPending || totalToRank === 0}
        title={totalToRank === 0 ? "No extracted resumes available to rank" : "Rank Extracted Candidates"}
        className="inline-flex w-full items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed min-w-[220px] hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Ranking {totalToRank}...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Rank All Candidates
          </>
        )}
      </button>

      {/* Helper text for sequencing guard */}
      {totalToRank === 0 && totalResumes > 0 && !result && !isPending && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium text-center w-full px-2 py-1 mt-0.5">
           ⚠️ Please run Extract Data first
        </p>
      )}

      {/* Result summary area */}
      {result && !isPending && (
        <div className="flex flex-col gap-3 mt-1 w-full bg-white dark:bg-zinc-800 p-4 rounded-xl border border-pink-100 dark:border-pink-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Ranking Summary</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300">
              Total Processed: {result.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
              ✓ {result.succeeded} Successful
            </span>
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
        <p className="text-xs text-red-500 dark:text-red-400 text-right w-full">{error}</p>
      )}
    </div>
  )
}
