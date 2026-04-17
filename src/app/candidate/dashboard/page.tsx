import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InterviewCard } from "@/components/interview-card"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Bot } from "lucide-react"

export const metadata = {
  title: 'Candidate Dashboard | Interview Platform',
  description: 'Your central hub for assessments and interviews.',
}

export default async function CandidateDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });

  const [upcomingInterviews, aiSessions] = await Promise.all([
    prisma.interview.findMany({
      where: { 
        candidateId: userId,
        status: "SCHEDULED"
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        interviewer: {
          select: { name: true, email: true }
        }
      }
    }),
    prisma.aiInterviewSession.findMany({
      where: { candidateId: userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        overallScore: true,
        recommendation: true,
        position: { select: { title: true } },
        createdAt: true,
      }
    })
  ]);

  const pendingAiSessions = aiSessions.filter(s => s.status === "IN_PROGRESS");

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">Welcome back, {user?.name?.split(' ')[0] || 'Candidate'}. Here&apos;s your schedule.</p>
        </div>
        <Button className="shrink-0 rounded-xl shadow-md">
           Browse Practice Problems
        </Button>
      </div>

      {/* Stats Grid placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-indigo-600 dark:bg-indigo-600 border-none text-white shadow-lg shadow-indigo-600/20">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-indigo-100">Upcoming Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black mt-2">{upcomingInterviews.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">{aiSessions.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Global Skill Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mt-3 pb-1 border-b-2 border-indigo-500 border-dashed inline-block">Unranked</div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Schedule Wrapper */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Your Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {upcomingInterviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-gray-500 dark:text-gray-400 font-medium">No upcoming interviews scheduled yet.</p>
              </div>
            ) : (
              upcomingInterviews.map((interview) => (
                <InterviewCard 
                  key={interview.id}
                  topBadge={interview.scheduledAt.toLocaleString('default', { month: 'short' })}
                  bottomBadge={interview.scheduledAt.getDate().toString()}
                  title={interview.title}
                  subtitle={`with ${interview.interviewer.name || interview.interviewer.email}`}
                  actionText="Join Room"
                  href={`/interview/${interview.id}`}
                  duration={`${interview.durationMinutes}m duration`}
                  theme="indigo"
                />
              ))
            )}

          </CardContent>
        </Card>

        {/* AI Interview Widget */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              AI Interview
            </CardTitle>
            <Link href="/candidate/ai-interview" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="flex-1 p-6 flex flex-col gap-4">
            {pendingAiSessions.length > 0 && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  You have {pendingAiSessions.length} in-progress session{pendingAiSessions.length > 1 ? "s" : ""}
                </p>
                <Link href={`/ai-interview/${pendingAiSessions[0].id}`} className="ml-auto text-xs text-amber-700 dark:text-amber-300 font-bold hover:underline shrink-0">
                  Resume →
                </Link>
              </div>
            )}

            {aiSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
                  <Bot className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  Practice with our AI interviewer — it asks real technical and behavioral questions and scores your answers.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiSessions.slice(0, 3).map((s) => (
                  <Link key={s.id} href={`/ai-interview/${s.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all group">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.position?.title ?? "General AI Interview"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {s.status === "COMPLETED" ? `Score: ${s.overallScore}/100` : "In progress"}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${s.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                      {s.status === "COMPLETED" ? "Done" : "Resume"}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <Link href="/candidate/ai-interview" className="mt-auto">
              <Button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md shadow-indigo-600/10">
                Start AI Interview
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

