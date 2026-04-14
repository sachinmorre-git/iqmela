"use client"

import { useState, useTransition } from "react"
import { bulkAdvancedJudgmentAction, BulkAdvancedJudgmentResult } from "./actions"

export function BulkAdvancedJudgmentButton({
  positionId,
  totalRanked
}: {
  positionId: string
  totalRanked: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<BulkAdvancedJudgmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(10)
  const [forceReExtract, setForceReExtract] = useState(false)

  const handleClick = () => {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await bulkAdvancedJudgmentAction(positionId, limit, forceReExtract)
      if (!res.success) {
        setError(res.error ?? "Unknown error")
      } else if (res.result) {
        setResult(res.result)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-2">
        <select 
          value={limit} 
          onChange={(e) => setLimit(Number(e.target.value))}
          disabled={isPending}
          className="text-xs font-semibold rounded-lg border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 shadow-sm disabled:opacity-50"
        >
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
          <option value={50}>Top 50</option>
        </select>
        <button
          onClick={handleClick}
          disabled={isPending || totalRanked === 0}
          className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 border border-emerald-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 min-w-[200px]"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Running AI Judgment...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Run DeepSeek Reasoner
            </>
          )}
        </button>
      </div>

      <label className="flex items-center gap-2 mt-0.5 -mr-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-300 cursor-pointer">
        <input 
          type="checkbox" 
          checked={forceReExtract} 
          onChange={(e) => setForceReExtract(e.target.checked)} 
          disabled={isPending}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 shadow-sm disabled:opacity-50"
        />
        Force Re-Reason
      </label>

      {/* Result summary area */}
      {result && !isPending && (
        <div className="flex flex-col gap-3 mt-2 w-full bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Judgment Summary</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              Total Processed: {result.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              ✓ {result.succeeded} Successful
            </span>
            {result.failed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                ✗ {result.failed} Failed
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="w-full flex flex-col gap-1.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 p-2.5 max-h-32 overflow-y-auto mt-1">
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
