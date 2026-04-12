import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export const metadata = {
  title: 'Org Admin Dashboard | IQMela',
  description: 'Manage your organisation\'s hiring pipeline.',
}

export default async function OrgAdminDashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const stats = [
    {
      label: "Open Positions",
      value: 0,
      accent: true,
      suffix: null,
    },
    {
      label: "Uploaded Resumes",
      value: 0,
      accent: false,
      suffix: null,
    },
    {
      label: "Shortlisted Candidates",
      value: 0,
      accent: false,
      suffix: null,
    },
    {
      label: "Interview Invites Sent",
      value: 0,
      accent: false,
      suffix: null,
    },
  ];

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Overview
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'}. Here&apos;s your hiring pipeline.
          </p>
        </div>
        <Button className="shrink-0 rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform">
          + Post New Position
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Accent card — Open Positions */}
        <Card className="bg-teal-600 border-none text-white shadow-lg shadow-teal-600/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-teal-100">
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black mt-2">0</div>
          </CardContent>
        </Card>

        {/* Uploaded Resumes */}
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Uploaded Resumes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">0</div>
          </CardContent>
        </Card>

        {/* Shortlisted Candidates */}
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Shortlisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">0</div>
          </CardContent>
        </Card>

        {/* Interview Invites Sent */}
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Invites Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-gray-900 dark:text-white mt-2">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity + Pipeline Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Recent Activity */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[360px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mx-auto mb-4 text-teal-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                No activity yet. Start by posting an open position.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Status */}
        <Card className="col-span-1 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[360px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Hiring Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-6 space-y-4">
            {[
              { stage: "Applied", count: 0, color: "bg-gray-200 dark:bg-zinc-700" },
              { stage: "Screened", count: 0, color: "bg-teal-200 dark:bg-teal-800" },
              { stage: "Interviewed", count: 0, color: "bg-teal-400 dark:bg-teal-600" },
              { stage: "Offered", count: 0, color: "bg-teal-600" },
            ].map((row) => (
              <div key={row.stage} className="flex items-center gap-4">
                <span className="w-24 text-sm font-semibold text-gray-600 dark:text-gray-400 shrink-0">
                  {row.stage}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                  <div className={`h-full rounded-full w-0 ${row.color}`} />
                </div>
                <span className="w-6 text-right text-sm font-bold text-gray-900 dark:text-white">
                  {row.count}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
