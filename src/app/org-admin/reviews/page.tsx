import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Candidate Reviews | Hiring Manager",
}

export default async function ReviewsDashboard() {
  const { userId, orgId } = await auth()
  
  if (!userId) redirect("/sign-in")
  if (!orgId) redirect("/select-org")

  // Fetch all completed AI interview sessions that are ready for review in this Org
  const sessions = await prisma.aiInterviewSession.findMany({
    where: {
      organizationId: orgId,
      status: "COMPLETED",
    },
    include: {
      position: { select: { title: true } },
      candidate: { select: { name: true, email: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 50,
  })

  // Filter out the ones that explicitly need a review vs those already reviewed
  const pendingReviews = sessions.filter(s => !s.reviewedAt && ["NEEDS_HUMAN_REVIEW", "MAYBE"].includes(s.recommendation || ""))
  const otherSessions = sessions.filter(s => !pendingReviews.includes(s))

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full p-4 md:p-8">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Final Reviews
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Review completed AI interviews and finalize hiring decisions.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 tracking-tight">Requires Attention</h3>
        {pendingReviews.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-gray-500 dark:text-zinc-500">You're all caught up! No pending AI reviews at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingReviews.map((session) => (
              <Card key={session.id} className="shadow-sm border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-bold dark:text-zinc-100">{session.candidate.name}</CardTitle>
                      <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 tracking-tight">{session.position?.title}</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-400">
                      Needs Review
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4 line-clamp-2">
                    AI flagged nuances that require a human hiring manager to review the transcript.
                  </p>
                  <Link href={`/org-admin/ai-interview/${session.id}/scorecard`}>
                    <button className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition">
                      Evaluate Candidate
                    </button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 tracking-tight">Recent Decisions</h3>
        {otherSessions.length === 0 ? (
          <p className="text-gray-500 dark:text-zinc-500 text-sm">No recent evaluated sessions to show.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherSessions.map((session) => (
              <Card key={session.id} className="shadow-sm border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-md font-bold dark:text-zinc-200">{session.candidate.name}</CardTitle>
                      <p className="text-xs font-medium text-gray-500 dark:text-zinc-500">{session.position?.title}</p>
                    </div>
                    <span className="text-lg font-black dark:text-white">{session.overallScore}/100</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link href={`/org-admin/ai-interview/${session.id}/scorecard`} className="text-teal-600 dark:text-teal-400 text-sm font-semibold hover:underline">
                    View Scorecard &rarr;
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
