import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PositionStatus } from "@prisma/client"
import Link from "next/link"

export const metadata = {
  title: "Positions | Org Admin | IQMela",
  description: "Manage your organisation's open positions.",
}

// Status badge colours
const STATUS_STYLES: Record<PositionStatus, string> = {
  DRAFT:    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  OPEN:     "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  PAUSED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  CLOSED:   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-500",
  ARCHIVED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

export default async function PositionsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const positions = await prisma.position.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Positions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            {positions.length === 0
              ? "No positions yet. Post your first open role."
              : `${positions.length} position${positions.length !== 1 ? "s" : ""} in your pipeline.`}
          </p>
        </div>
        <Button
          className="shrink-0 rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform"
          asChild
        >
          {/* Link to future /org-admin/positions/new */}
          <Link href="/org-admin/positions/new">+ Post New Position</Link>
        </Button>
      </div>

      {positions.length === 0 ? (
        /* ── Empty State ─────────────────────────────────────── */
        <Card className="shadow-sm border-gray-100 dark:border-zinc-800">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No positions yet</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs">
                Create your first open position to start building your hiring pipeline.
              </p>
            </div>
            <Button
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white border-transparent shadow-md shadow-teal-600/20 hover:-translate-y-0.5 transition-transform"
              asChild
            >
              <Link href="/org-admin/positions/new">+ Post New Position</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── Positions Table ─────────────────────────────────── */
        <Card className="shadow-sm border-gray-100 dark:border-zinc-800 overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              All Positions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/30">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Department
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Location
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Type
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Created
                    </th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {positions.map((position) => (
                    <tr
                      key={position.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {position.title}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {position.department ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {position.location ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                        {position.employmentType
                          ? position.employmentType.replace("_", " ")
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[position.status]}`}
                        >
                          {position.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 dark:text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                        {position.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/org-admin/positions/${position.id}`}
                          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
