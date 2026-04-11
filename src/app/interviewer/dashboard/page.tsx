import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InterviewCard } from "@/components/interview-card"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export const metadata = {
  title: 'Interviewer Dashboard | Interview Platform',
  description: 'Manage candidates and technical assessments.',
}

export default async function InterviewerDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Fetch real interviewer data AND their hosted interviews
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });

  const upcomingInterviews = await prisma.interview.findMany({
    where: { 
      interviewerId: userId,
      status: "SCHEDULED" 
    },
    orderBy: { scheduledAt: 'asc' },
    include: {
      candidate: {
        select: { name: true, email: true }
      }
    }
  });

  // Basic localized stat calculation
  const interviewsTodayCount = upcomingInterviews.filter(interview => {
    const today = new Date();
    const intDate = interview.scheduledAt;
    return intDate.getDate() === today.getDate() && intDate.getMonth() === today.getMonth() && intDate.getFullYear() === today.getFullYear();
  }).length;

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Hello, {user?.name?.split(' ')[0] || 'Interviewer'}. You have {interviewsTodayCount} interviews scheduled today.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto shrink-0 rounded-xl shadow-sm hover:-translate-y-0.5 transition-transform">
             Draft Assessment
          </Button>
          <Link href="/interviewer/schedule">
            <Button className="w-full sm:w-auto shrink-0 rounded-xl shadow-md shadow-purple-600/20 bg-purple-600 hover:bg-purple-700 text-white border-transparent hover:-translate-y-0.5 transition-transform">
              Schedule Interview
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-purple-600 dark:bg-purple-600 border-none text-white shadow-lg shadow-purple-600/20">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-purple-100">Interviews Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black mt-2">{interviewsTodayCount}</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">{upcomingInterviews.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mt-3 pb-1 border-b-2 border-purple-500 border-dashed inline-block">N/A</div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Schedule Wrapper */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {upcomingInterviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-gray-500 dark:text-gray-400 font-medium">No candidates are currently scheduled.</p>
                <Link href="/interviewer/schedule" className="mt-4 text-purple-600 dark:text-purple-400 font-semibold text-sm hover:underline">
                  Schedule one now &rarr;
                </Link>
              </div>
            ) : (
              upcomingInterviews.map((interview) => (
                <InterviewCard 
                  key={interview.id}
                  topBadge={interview.scheduledAt.toLocaleString('default', { month: 'short' })}
                  bottomBadge={interview.scheduledAt.getDate().toString()}
                  title={interview.title}
                  subtitle={interview.candidate.name ? `Candidate: ${interview.candidate.name}` : `Candidate: ${interview.candidate.email}`}
                  actionText="Launch Room"
                  href={`/interview/${interview.id}`}
                  duration={`${interview.durationMinutes}m duration`}
                  theme="purple"
                />
              ))
            )}

          </CardContent>
        </Card>

        {/* Needs Review (Placeholder for future feature) */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Needs Review</CardTitle>
            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold px-2.5 py-1 rounded-md tracking-wider">0 PENDING</span>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex flex-col items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400 font-medium text-center">You are all caught up on evaluations!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
