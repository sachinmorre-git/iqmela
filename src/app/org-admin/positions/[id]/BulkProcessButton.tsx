"use client"

import { useState, useTransition } from "react"
import { bulkProcessAllAction } from "./actions"
import type { BulkExtractionResult, BulkRankingResult } from "./actions"

export function BulkProcessButton({
  positionId,
  totalResumes,
  hasJd
}: {
  positionId: string
  totalResumes: number
  hasJd: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ extract?: BulkExtractionResult; rank?: BulkRankingResult } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [forceReExtract, setForceReExtract] = useState(false)

  const handleClick = () => {
    setResult(null)
    setError(null)
    setWarning(null)
    startTransition(async () => {
      const res = await bulkProcessAllAction(positionId, forceReExtract)
      if (!res.success) {
        setError(res.error ?? "Unknown error")
      } else {
        if (res.warning) setWarning(res.warning)
        setResult({
          extract: res.extractResult,
          rank: res.rankResult
        })
      }
    })
  }

  const tooltipText = totalResumes === 0 
    ? "No resumes uploaded" 
    : !hasJd 
      ? "Position is missing a Job Description" 
      : "Extract & Rank all resumes in one click"

  return (
    <div className="flex flex-col items-end gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={isPending || totalResumes === 0 || !hasJd}
        title={tooltipText}
        className="inline-flex w-full items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold bg-violet-600 text-white border border-violet-500 shadow-md shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed min-w-[220px] hover:bg-violet-700 hover:-translate-y-0.5 transition-all"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Running Pipeline...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Run Full AI Pipeline
          </>
        )}
      </button>

      {/* Force re-extract toggle */}
      <label className="flex items-center gap-2 mt-0.5 -mr-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-300 cursor-pointer">
        <input 
          type="checkbox" 
          checked={forceReExtract} 
          onChange={(e) => setForceReExtract(e.target.checked)} 
          disabled={isPending}
          className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 shadow-sm disabled:opacity-50"
        />
        Force AI re-extraction
      </label>

      {/* Helper text for prerequisite */}
      {!hasJd && !result && !isPending && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium text-center w-full px-2 py-1 mt-0.5">
           ⚠️ Please write a Job Description first
        </p>
      )}

      {/* Result summary area */}
      {result && !isPending && (
        <div className="flex flex-col gap-3 mt-1 w-full bg-violet-50 dark:bg-violet-900/10 p-4 rounded-xl border border-violet-100 dark:border-violet-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-100">Pipeline Summary</p>
          
          {result.extract && (
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                Extraction: {result.extract.succeeded}/{result.extract.total}
              </span>
              {result.extract.failed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                  {result.extract.failed} Fails
                </span>
              )}
            </div>
          )}

          {result.rank && (
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                Ranking: {result.rank.succeeded}/{result.rank.total}
              </span>
              {result.rank.failed > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                  {result.rank.failed} Fails
                </span>
              )}
            </div>
          )}

          {warning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 leading-tight">{warning}</p>
          )}

          {((result.extract?.errors.length || 0) > 0 || (result.rank?.errors.length || 0) > 0) && (
            <div className="w-full flex flex-col gap-1.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 p-2.5 mt-2 max-h-32 overflow-y-auto">
              {result.extract?.errors.map((e, i) => (
                <p key={`e-${i}`} className="text-[11px] text-red-600 dark:text-red-400 leading-tight">
                   <strong className="font-semibold">{e.fileName} (Ext):</strong> {e.error}
                </p>
              ))}
              {result.rank?.errors.map((e, i) => (
                <p key={`r-${i}`} className="text-[11px] text-red-600 dark:text-red-400 leading-tight">
                   <strong className="font-semibold">{e.fileName} (Rank):</strong> {e.error}
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
