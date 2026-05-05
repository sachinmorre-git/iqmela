import { getCallerPermissions } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDateTime } from "@/lib/locale-utils"

export const metadata = {
  title: "Audit Logs | Org Admin",
}

export default async function ActivityDashboard() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canViewActivity) redirect("/org-admin/dashboard")

  // Fetch the latest 50 audit logs chronologically
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: perms.orgId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  // Extract all distinct userIds from logs to attempt to fetch their names
  const uniqueUserIds = Array.from(new Set(logs.map(log => log.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, name: true, email: true }
  });

  const userMap = new Map(users.map(u => [u.id, u.name || u.email || "Unknown User"]));

  const getActionTheme = (action: string) => {
    switch(action) {
      case "CREATED": case "STARTED": return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400";
      case "DELETED": return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400";
      case "UPDATED": case "EVALUATED": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "INVITED": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  }

  return (
    <div className="flex-1 space-y-8 max-w-6xl mx-auto w-full p-4 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            Audit Logs
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Immutable chronological record of administrative and data mutations.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">No activity logged in this workspace yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">Timestamp</th>
                  <th className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">Actor</th>
                  <th className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">Action</th>
                  <th className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">Resource</th>
                  <th className="px-6 py-4 font-bold text-gray-900 dark:text-zinc-100">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4 text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDateTime(new Date(log.createdAt), { showTimezone: false })}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-zinc-200 whitespace-nowrap">
                      {userMap.get(log.userId) || <span className="font-mono text-xs text-zinc-500">{log.userId.slice(0,10)}...</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded uppercase tracking-wider ${getActionTheme(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-900 dark:text-zinc-300">{log.resourceType.replace(/_/g, " ")}</span>
                        <span className="text-gray-400 dark:text-zinc-600 font-mono text-[10px] truncate max-w-[80px]" title={log.resourceId}>{log.resourceId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-zinc-400 max-w-xs truncate">
                      {log.metadata ? (() => {
                        const meta = typeof log.metadata === "object" ? log.metadata as Record<string, unknown> : {};
                        // Filter out PII-sensitive keys from display
                        const PII_KEYS = ["email", "phone", "candidateEmail", "phoneNumber", "linkedinUrl", "address"];
                        const safeEntries = Object.entries(meta).filter(
                          ([k]) => !PII_KEYS.some(pii => k.toLowerCase().includes(pii.toLowerCase()))
                        );
                        if (safeEntries.length === 0) return <span className="text-gray-300 dark:text-zinc-600">—</span>;
                        return safeEntries.map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 mr-2">
                            <span className="font-semibold text-gray-600 dark:text-zinc-300">{k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}:</span>{" "}
                            <span className="font-mono">{String(v).slice(0, 50)}</span>
                          </span>
                        ));
                      })() : "—"}
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
