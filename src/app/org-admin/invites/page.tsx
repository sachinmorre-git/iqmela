import { prisma } from "@/lib/prisma"
import { getCallerPermissions } from "@/lib/rbac"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Mail, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import { formatTime } from "@/lib/locale-utils"

export const metadata = {
  title: "Outbound Email Activity | IQMela",
}

export const dynamic = "force-dynamic"

function getRelativeTime(date: Date) {
  const diffInSeconds = Math.round((date.getTime() - new Date().getTime()) / 1000)
  const diffInMinutes = Math.round(diffInSeconds / 60)
  const diffInHours = Math.round(diffInMinutes / 60)
  const diffInDays = Math.round(diffInHours / 24)

  if (Math.abs(diffInDays) > 0) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffInDays, 'day')
  if (Math.abs(diffInHours) > 0) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffInHours, 'hour')
  if (Math.abs(diffInMinutes) > 0) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffInMinutes, 'minute')
  return "just now"
}

export default async function OrgAdminInvitesPage() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canManageInvites) redirect("/org-admin/dashboard")

  // Fetch all invites associated with positions in this organization
  const invites = await prisma.interviewInvite.findMany({
    where: {
      position: { organizationId: perms.orgId }
    },
    include: {
      position: { select: { title: true, id: true } },
      resume: { select: { candidateName: true, overrideName: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 100
  })

  // Basic Metrics
  const totalSent = invites.filter(i => i.status !== "DRAFT").length
  const totalDelivered = invites.filter(i => i.lastDeliveryStatus === "DELIVERED").length
  const totalBounced = invites.filter(i => i.lastDeliveryStatus === "BOUNCED").length

  return (
    <div className="flex-1 space-y-8 max-w-6xl w-full mx-auto p-4 md:p-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Email Activity Hub</h2>
          <p className="text-muted-foreground mt-1">Real-time delivery tracking and outbound invite logs.</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm border-gray-100 dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden relative">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Total Dispatched</h3>
            <Mail className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">{totalSent}</div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm border-gray-100 dark:border-zinc-800 dark:bg-zinc-900 border-l-4 border-l-emerald-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Confirmed Deliveries</h3>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalDelivered}</div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm border-gray-100 dark:border-zinc-800 dark:bg-zinc-900 border-l-4 border-l-rose-500">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Bounces / Failures</h3>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{totalBounced}</div>
        </div>
        
        <div className="rounded-xl border bg-card p-6 shadow-sm border-gray-100 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-gray-500">Drafts Pending</h3>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{invites.filter(i => i.status === "DRAFT").length}</div>
        </div>
      </div>

      {/* Main Tracking Ledger */}
      <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        {invites.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Mail className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No outbound tracking data</h3>
            <p className="text-gray-500 max-w-sm mt-2">Generate and send interview invites to candidates from the Position dashboard to view historical audit logs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Candidate Link</th>
                  <th className="px-6 py-4">Delivery Status</th>
                  <th className="px-6 py-4">Target Email</th>
                  <th className="px-6 py-4">Position Source</th>
                  <th className="px-6 py-4 text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {invites.map((invite) => {
                  const candidateName = invite.resume.overrideName || invite.resume.candidateName || "Candidate";
                  
                  // Primary Logical Status parsing
                  const isDraft = invite.status === "DRAFT";
                  const isAccepted = invite.status === "ACCEPTED";
                  const isSent = invite.status === "SENT";

                  // Network Webhook Delivery status rendering
                  let networkBadge = null;
                  if (invite.lastDeliveryStatus === "DELIVERED") {
                    networkBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 tracking-wide"><CheckCircle2 className="w-3 h-3"/> DELIVERED</span>;
                  } else if (invite.lastDeliveryStatus === "BOUNCED" || invite.lastDeliveryStatus === "COMPLAINED") {
                    networkBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/30 tracking-wide"><XCircle className="w-3 h-3"/> BOUNCED</span>;
                  } else if (isSent && !invite.lastDeliveryStatus) {
                    networkBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30 tracking-wide"><CheckCircle2 className="w-3 h-3"/> SENT</span>;
                  } else if (isDraft) {
                    networkBadge = <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide border border-dashed border-gray-300 dark:border-zinc-700 rounded-full">Not Dispatched</span>;
                  }

                  return (
                    <tr key={invite.id} className="group relative hover:bg-gray-50/50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-xs ring-1 ring-rose-200 dark:ring-rose-800">
                            {candidateName.charAt(0)}
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {candidateName}
                            {isAccepted && (
                              <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded shadow-sm">ACCEPTED</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {networkBadge}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-zinc-950 px-2 py-1 rounded w-max border border-gray-100 dark:border-zinc-800 shadow-sm inline-block mt-2">
                        {invite.targetEmail}
                      </td>
                      <td className="px-6 py-4 relative z-10">
                        <Link href={`/org-admin/positions/${invite.position.id}`} className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 group-hover:underline group-hover:text-rose-700 font-medium after:absolute after:inset-0">
                          {invite.position.title}
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="text-gray-500 dark:text-gray-400 text-xs flex flex-col items-end">
                          <span className="font-semibold">{getRelativeTime(invite.updatedAt)}</span>
                          <span className="text-[10px] mt-0.5 opacity-60">{formatTime(invite.updatedAt, { showTimezone: false })}</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
