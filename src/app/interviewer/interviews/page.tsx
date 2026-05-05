import React from "react";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InterviewStatus, InterviewMode } from "@prisma/client";
import { InterviewListCard } from "./InterviewListCard";

export default async function InterviewerDashboard() {
  const perms = await getCallerPermissions();
  
  if (!perms) {
    redirect("/select-role");
  }

  // Interviewers or Managers can open this page
  // We use perms.userId to fetch their corresponding interviews
  const interviews = await prisma.interview.findMany({
    where: { interviewerId: perms.userId },
    include: {
      candidate: { select: { name: true, email: true } },
      position: { select: { title: true } },
      feedback: { select: { id: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const upcoming = interviews.filter(i => i.status === "SCHEDULED" && i.scheduledAt > new Date());
  const past = interviews.filter(i => i.status !== "SCHEDULED" || i.scheduledAt <= new Date());

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-4">
          My Interviews
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          View your upcoming interview schedule and submit candidate feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* UPCOMING */}
        <div className="flex flex-col gap-4">
           <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
             <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
             Upcoming
           </h2>
           {upcoming.length === 0 ? (
             <div className="border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-zinc-900/30">
               <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">No upcoming interviews.</p>
             </div>
           ) : (
             <div className="space-y-4">
                {upcoming.map(interview => (
                  <InterviewListCard key={interview.id} interview={interview} isPast={false} />
                ))}
             </div>
           )}
        </div>

        {/* PAST */}
        <div className="flex flex-col gap-4">
           <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-400">
             Past & Completed
           </h2>
           {past.length === 0 ? (
             <div className="border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-zinc-900/30">
               <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">No past interviews.</p>
             </div>
           ) : (
             <div className="space-y-4">
               {past.map(interview => (
                  <InterviewListCard key={interview.id} interview={interview} isPast={true} />
                ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
