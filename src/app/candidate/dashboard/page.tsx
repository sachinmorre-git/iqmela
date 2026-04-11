import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InterviewCard } from "@/components/interview-card"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

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

  const upcomingInterviews = await prisma.interview.findMany({
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
  });

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
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assessments Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">0</div>
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

        {/* Recommended Practice */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Recommended Practice</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800/50 transition duration-200">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Algorithm Challenge #{i * 14}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${i % 2 === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {i % 2 === 0 ? 'Medium' : 'Hard'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium tracking-wide">ARRAYS & HASHING</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">Solve</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
