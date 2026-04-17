function getRelativeTime(date: Date) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diffInSeconds = Math.round((date.getTime() - new Date().getTime()) / 1000)
  const diffInMinutes = Math.round(diffInSeconds / 60)
  const diffInHours = Math.round(diffInMinutes / 60)
  const diffInDays = Math.round(diffInHours / 24)

  if (Math.abs(diffInDays) > 0) return rtf.format(diffInDays, 'day')
  if (Math.abs(diffInHours) > 0) return rtf.format(diffInHours, 'hour')
  if (Math.abs(diffInMinutes) > 0) return rtf.format(diffInMinutes, 'minute')
  return "just now"
}

export function BatchActivityPanel({ batchRuns, inline = false }: { batchRuns: any[], inline?: boolean }) {
  if (!batchRuns || batchRuns.length === 0) return null

  const sortedRuns = [...batchRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const recentRuns = sortedRuns.slice(0, 4)

  const grid = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {recentRuns.map((run) => (
        <div key={run.id} className="flex flex-col p-4 rounded-xl border border-gray-100 dark:border-zinc-800/60 bg-gray-50/50 dark:bg-zinc-900/40 relative overflow-hidden group">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            run.status === "COMPLETED" ? "bg-teal-500" :
            run.status === "PARTIAL_SUCCESS" ? "bg-amber-500" :
            "bg-red-500"
          }`} />
          
          <div className="flex justify-between items-start pl-2">
            <div className="flex flex-col gap-1.5">
              <p className="font-bold text-[13px] text-gray-900 dark:text-gray-100 tracking-wide uppercase leading-tight">
                {run.actionType.replace(/_/g, " ")}
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none shrink-0 ${
                  run.status === "COMPLETED" ? "bg-teal-100/50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" :
                  run.status === "PARTIAL_SUCCESS" ? "bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  "bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  {run.status.replace("_", " ")}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                  {getRelativeTime(new Date(run.createdAt))}
                </span>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end pl-4 shrink-0">
              <span className="text-2xl font-black text-gray-300 dark:text-zinc-600 leading-none">
                {run.totalProcessed}
              </span>
              <span className="text-[9px] uppercase font-extrabold text-gray-400 tracking-widest mt-1">
                TOTAL
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6 pl-2 mt-4 pt-3 border-t border-gray-200 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Success</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-200 leading-none">{run.succeeded}</span>
            </div>
            {run.skipped > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Skipped</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-200 leading-none">{run.skipped}</span>
              </div>
            )}
            {run.failed > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Failed</span>
                <span className="text-sm font-bold text-red-500 leading-none">{run.failed}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // inline=true: just the grid, parent provides the card wrapper
  if (inline) return grid

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-zinc-500"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Batch Workflow Activity
        </h3>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          Recent Runs
        </span>
      </div>
      {grid}
    </div>
  )
}

