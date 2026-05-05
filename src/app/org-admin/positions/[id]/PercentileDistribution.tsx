"use client"

import { useMemo } from "react"

import { useRouter } from "next/navigation"

/**
 * Candidate Score Distribution
 *
 * Tesla-inspired premium visualization of AI match scores.
 * Uses a continuous glowing spectrum track with clustered candidate nodes,
 * displaying rank map-pins permanently, with hover tooltips for details.
 */

interface ScoreDistributionProps {
  candidates: { id: string; name: string; score: number }[]
}

export function PercentileDistribution({ candidates }: ScoreDistributionProps) {
  const router = useRouter()

  const scores = candidates.map(c => c.score)
  const avg = candidates.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const highest = candidates.length > 0 ? Math.max(...scores) : 0
  
  // Group candidates by exact scores and determine rank
  const scoreData = useMemo(() => {
    if (candidates.length === 0) return {}
    const sortedUniqueScores = [...new Set(scores)].sort((a, b) => b - a)
    const data: Record<number, { rank: number; candidates: { id: string; name: string }[] }> = {}
    
    sortedUniqueScores.forEach((s, i) => {
      data[s] = {
        rank: i + 1,
        candidates: candidates.filter(c => c.score === s)
      }
    })
    return data
  }, [candidates, scores])

  if (candidates.length === 0) return null

  return (
    <div className="relative bg-white dark:bg-zinc-950 rounded-2xl border border-gray-200 dark:border-zinc-800/50 shadow-sm px-6 pt-5 pb-8">
      {/* Subtle Background Glow (contained) */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Header */}
        <div className="relative flex items-end justify-between mb-10">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Talent Spectrum</h3>
          <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">
            AI analysis of {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-end">
            <span className="text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-bold text-[9px] mb-0.5">Avg Score</span>
            <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">{avg}%</span>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-zinc-800" />
          <div className="flex flex-col items-end">
            <span className="text-gray-400 dark:text-zinc-500 uppercase tracking-widest font-bold text-[9px] mb-0.5">Top Score</span>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-br from-rose-500 to-indigo-600 tabular-nums leading-none">{highest}%</span>
          </div>
        </div>
      </div>

      {/* The Spectrum Track */}
      <div className="relative w-full mt-8">
        {/* Background Track */}
        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-zinc-900 shadow-inner overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-20 dark:opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-80" />
        </div>

        {/* Nodes (Candidates) */}
        {Object.entries(scoreData).map(([scoreStr, data]) => {
          const score = parseInt(scoreStr)
          const color = score >= 90 ? '#10b981' : score >= 75 ? '#06b6d4' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#f43f5e'
          const zIndex = data.rank === 1 ? 30 : 20 - data.rank
          
          return (
            <div
              key={score}
              onClick={() => router.push(`/org-admin/resumes/${data.candidates[0].id}`)}
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
              style={{ left: `${100 - score}%`, zIndex }}
            >
              {/* Map Pin (Permanent) */}
              <div className="absolute bottom-full mb-1.5 flex flex-col items-center group-hover:-translate-y-1 transition-transform duration-200">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md text-white border-[2px] border-white dark:border-zinc-950 relative" style={{ backgroundColor: color }}>
                   <span className="text-xs font-black tracking-tighter">#{data.rank}</span>
                   {/* Hover Tooltip (expands out of the pin) */}
                   <div className="absolute bottom-[110%] mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                     <div className="bg-gray-900 dark:bg-white px-3 py-2 rounded-xl shadow-2xl border border-gray-800 dark:border-gray-200 flex flex-col min-w-[130px]">
                       {/* Tooltip Header: % Match */}
                       <div className="flex items-center justify-between border-b border-gray-800 dark:border-gray-100 pb-1.5 mb-1.5">
                         <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Match</span>
                         <span className="text-sm font-black" style={{ color }}>{score}%</span>
                       </div>
                       {/* Tooltip Body: Candidate Names */}
                       <div className="flex flex-col gap-1">
                         {data.candidates.map(c => (
                           <div key={c.id} className="text-gray-100 dark:text-gray-800 text-xs font-semibold truncate max-w-[160px]">
                             {c.name}
                           </div>
                         ))}
                       </div>
                     </div>
                     <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-900 dark:border-t-white mx-auto" />
                   </div>
                </div>
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-transparent -mt-[1px]" style={{ borderTopColor: color }} />
              </div>

              {/* The Dot on the track */}
              <div 
                className="w-4 h-4 rounded-full bg-white border-[2.5px] transition-transform duration-200 group-hover:scale-125 shadow-sm"
                style={{ borderColor: color }}
              />
            </div>
          )
        })}

        {/* Zone Markers (Ticks) */}
        <div className="absolute top-full left-0 w-full flex justify-between mt-2.5 px-0.5 text-[9px] font-bold text-gray-400 dark:text-zinc-600 tabular-nums">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        </div>
      </div>
    </div>
  )
}
