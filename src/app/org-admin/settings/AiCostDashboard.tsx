import { prisma } from "@/lib/prisma"

export async function AiCostDashboard() {
  const logs = await prisma.aiUsageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  // Aggregate totals
  let totalCost = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  
  const providerStats: Record<string, { cost: number, runs: number }> = {}
  const taskStats: Record<string, { cost: number, runs: number }> = {}
  
  logs.forEach(log => {
    totalCost += log.estimatedCost
    totalInputTokens += log.inputTokens
    totalOutputTokens += log.outputTokens
    
    if (!providerStats[log.provider]) providerStats[log.provider] = { cost: 0, runs: 0 }
    providerStats[log.provider].cost += log.estimatedCost
    providerStats[log.provider].runs += 1

    if (!taskStats[log.taskType]) taskStats[log.taskType] = { cost: 0, runs: 0 }
    taskStats[log.taskType].cost += log.estimatedCost
    taskStats[log.taskType].runs += 1
  })

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm mt-8">
      <div className="border-b border-gray-200 dark:border-zinc-800 px-6 py-5 bg-emerald-50/50 dark:bg-emerald-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Cost & Usage Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Real-time token consumption and estimated cost tracking.</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Estimated Cost</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">${totalCost.toFixed(4)}</div>
          </div>
          <div className="p-5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Input Tokens</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{(totalInputTokens / 1000).toFixed(1)}k</div>
          </div>
          <div className="p-5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Output Tokens</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{(totalOutputTokens / 1000).toFixed(1)}k</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Usage by Provider</h4>
            <div className="space-y-3">
              {Object.entries(providerStats).map(([provider, stat]) => (
                <div key={provider} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize text-sm">{provider}</span>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">${stat.cost.toFixed(4)}</div>
                    <div className="text-xs text-gray-500">{stat.runs} runs</div>
                  </div>
                </div>
              ))}
              {Object.keys(providerStats).length === 0 && <p className="text-sm text-gray-500 italic">No usage recorded yet.</p>}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Usage by Task Type</h4>
            <div className="space-y-3">
              {Object.entries(taskStats).map(([task, stat]) => (
                <div key={task} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                  <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize text-sm">{task.replace(/_/g, " ")}</span>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">${stat.cost.toFixed(4)}</div>
                    <div className="text-xs text-gray-500">{stat.runs} runs</div>
                  </div>
                </div>
              ))}
              {Object.keys(taskStats).length === 0 && <p className="text-sm text-gray-500 italic">No usage recorded yet.</p>}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Recent AI Operations (Top 10)</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3 text-right">Tokens (In / Out)</th>
                  <th className="px-4 py-3 text-right">Estimated Cost</th>
                  <th className="px-4 py-3 text-right">Prompt Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200 text-xs">{log.taskType}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize text-xs">
                       {log.provider} 
                       <span className="block text-[10px] text-gray-400">{log.model}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 font-mono text-xs">{log.inputTokens} / {log.outputTokens}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400 font-mono text-xs">${log.estimatedCost.toFixed(5)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono text-xs">{log.promptVersion ?? "v1.0"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 justify-center text-center text-gray-500 object-center">No AI logs available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
