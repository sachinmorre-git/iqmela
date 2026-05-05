"use client"

import { useState, useTransition } from "react"
import { bulkProcessAllAction } from "./actions"
import type { BulkExtractionResult, BulkRankingResult, BulkAdvancedJudgmentResult } from "./actions"

export function BulkProcessButton({
  positionId,
  totalResumes,
  hasJd,
  compact,
  pendingCount,
}: {
  positionId: string
  totalResumes: number
  hasJd: boolean
  compact?: boolean
  pendingCount?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    extract?: BulkExtractionResult;
    rank?: BulkRankingResult;
    judgment?: BulkAdvancedJudgmentResult;
    preScreened?: number;
    autoShortlisted?: number;
    autoInvited?: number;
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [forceReExtract, setForceReExtract] = useState(false)
  const [currentStep, setCurrentStep] = useState<string | null>(null)

  const handleClick = () => {
    setResult(null)
    setError(null)
    setWarning(null)
    setCurrentStep("Extracting resumes…")
    startTransition(async () => {
      const res = await bulkProcessAllAction(positionId, forceReExtract)
      setCurrentStep(null)
      if (!res.success) {
        setError(res.error ?? "Unknown error")
      } else {
        if (res.warning) setWarning(res.warning)
        setResult({
          extract: res.extractResult,
          rank: res.rankResult,
          judgment: res.judgmentResult,
          preScreened: res.preScreened,
          autoShortlisted: res.autoShortlisted,
          autoInvited: res.autoInvited,
        })
      }
    })
  }

  const tooltipText = totalResumes === 0
    ? "No resumes uploaded"
    : !hasJd
      ? "Position is missing a Job Description"
      : "Extract, Rank, Shortlist & Invite — full ATS pipeline"

  const hasPending = (pendingCount ?? 0) > 0 && hasJd && !isPending && !result;

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {/* Pending nudge banner */}
        {hasPending && (
          <div className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold text-center bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 animate-pulse">
            ✨ {pendingCount} pending — tap to score
          </div>
        )}
        <button
          onClick={handleClick}
          disabled={isPending || totalResumes === 0 || !hasJd}
          title={tooltipText}
          className={`inline-flex items-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 text-sm font-semibold shadow-sm shadow-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-all ${hasPending ? "animate-bounce" : ""}`}
        >
          {isPending ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          )}
          {isPending ? (currentStep || "Running…") : "Run AI Pipeline"}
        </button>

        {/* Compact result for compact mode */}
        {result && !isPending && (
          <div className="text-[10px] font-semibold text-center space-y-0.5">
            {result.autoShortlisted != null && result.autoShortlisted > 0 && (
              <p className="text-amber-600 dark:text-amber-400">⭐ {result.autoShortlisted} auto-shortlisted</p>
            )}
            {result.autoInvited != null && result.autoInvited > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400">📨 {result.autoInvited} auto-invited</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-3 w-full">
      <button
        onClick={handleClick}
        disabled={isPending || totalResumes === 0 || !hasJd}
        title={tooltipText}
        className="inline-flex w-full items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold bg-pink-600 text-white border border-pink-500 shadow-md shadow-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed min-w-[220px] hover:bg-pink-700 hover:-translate-y-0.5 transition-all"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {currentStep || "Running Pipeline…"}
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Run Full AI Pipeline
          </>
        )}
      </button>

      {/* Pipeline stages indicator when running */}
      {isPending && (
        <div className="w-full px-3 py-2 rounded-lg bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-800/30">
          <div className="flex items-center gap-2 text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
            Full ATS Pipeline Running
          </div>
          <p className="text-[10px] text-pink-500/70 dark:text-pink-400/60 mt-0.5">
            Extract → Pre-Screen → AI Rank → Judgment → Shortlist → Invite
          </p>
        </div>
      )}

      {/* Force re-extract toggle */}
      <label className="flex items-center gap-2 mt-0.5 -mr-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-300 cursor-pointer">
        <input 
          type="checkbox" 
          checked={forceReExtract} 
          onChange={(e) => setForceReExtract(e.target.checked)} 
          disabled={isPending}
          className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 shadow-sm disabled:opacity-50"
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
        <div className="flex flex-col gap-3 mt-1 w-full bg-pink-50 dark:bg-pink-900/10 p-4 rounded-xl border border-pink-100 dark:border-pink-900/30 shadow-sm text-left">
          <p className="text-sm font-bold text-pink-900 dark:text-pink-100">✅ Full ATS Pipeline Complete</p>
          
          {/* Pipeline step badges */}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {result.extract && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300">
                📄 Extracted: {result.extract.succeeded}/{result.extract.total}
              </span>
            )}
            {result.preScreened != null && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                🔍 Pre-Screened: {result.preScreened}
              </span>
            )}
            {result.rank && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                📊 Ranked: {result.rank.succeeded}/{result.rank.total}
              </span>
            )}
          </div>

          {/* Judgment + downstream results */}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {result.judgment && result.judgment.succeeded > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                🧠 Deep Analysis: {result.judgment.succeeded}/{result.judgment.total}
              </span>
            )}
            {result.autoShortlisted != null && result.autoShortlisted > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                ⭐ Shortlisted: {result.autoShortlisted}
              </span>
            )}
            {result.autoInvited != null && result.autoInvited > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                📨 Auto-Invited: {result.autoInvited}
              </span>
            )}
          </div>

          {/* Error reporting */}
          {(result.extract?.failed || 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 w-fit">
              ❌ {result.extract?.failed} extraction failures
            </span>
          )}
          {(result.rank?.failed || 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 w-fit">
              ❌ {result.rank?.failed} ranking failures
            </span>
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
