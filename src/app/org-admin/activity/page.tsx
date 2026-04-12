import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

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

export const dynamic = "force-dynamic"

export default async function OrgAdminActivityLogPage() {
  const { userId } = await auth()
  if (!userId) redirect("/")

  const logs = await prisma.positionBatchRun.findMany({
    where: { position: { createdById: userId } },
    orderBy: { createdAt: "desc" },
    include: { position: true },
    take: 100
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Global Activity Log</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Audit trail of all automated workflows and bulk actions across your positions.</p>
        </div>
        <Link href="/org-admin" className="px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition shadow-sm text-gray-700 dark:text-gray-200">
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        {logs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">No activity recorded</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">When bulk actions are triggered, they will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3 font-semibold w-40">Timestamp</th>
                  <th className="px-5 py-3 font-semibold">Position</th>
                  <th className="px-5 py-3 font-semibold">Action Executed</th>
                  <th className="px-5 py-3 font-semibold text-center w-36">Status</th>
                  <th className="px-5 py-3 font-semibold text-right w-48">Throughput Metrics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="font-semibold text-[13px] text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{getRelativeTime(log.createdAt)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 uppercase font-bold tracking-wider">{log.createdAt.toLocaleDateString()} • {log.createdAt.toLocaleTimeString()}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/org-admin/positions/${log.positionId}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline inline-flex items-center gap-1.5 focus:outline-none">
                        {log.position.title}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-[10px] tracking-widest text-gray-700 dark:text-gray-300 uppercase px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                        {log.actionType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        log.status === "COMPLETED" ? "bg-teal-100/60 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/30" :
                        log.status === "PARTIAL_SUCCESS" ? "bg-amber-100/60 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30" :
                        "bg-red-100/60 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
                      }`}>
                        {log.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="font-black text-[15px] text-gray-900 dark:text-gray-100 leading-none">{log.totalProcessed} <span className="font-bold text-gray-400 text-[9px] tracking-wider uppercase ml-1">TOTAL</span></p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1.5 flex items-center justify-end gap-2.5">
                        <span className="text-teal-600 dark:text-teal-500 inline-flex items-center gap-0.5">{log.succeeded} ✓</span>
                        {log.skipped > 0 && <span className="text-amber-600 dark:text-amber-500 inline-flex items-center gap-0.5">{log.skipped} ⚠</span>}
                        {log.failed > 0 && <span className="text-red-600 dark:text-red-500 inline-flex items-center gap-0.5">{log.failed} ✗</span>}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
