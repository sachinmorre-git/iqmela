import React from "react";
import { InterviewStatus } from "@prisma/client";

type InterviewBannerData = {
  id: string;
  status: InterviewStatus;
  scheduledAt: Date;
};

export function InterviewsStatsBanner({ interviews }: { interviews: InterviewBannerData[] }) {
  const total = interviews.length;
  const scheduled = interviews.filter(i => i.status === "SCHEDULED").length;
  const completed = interviews.filter(i => i.status === "COMPLETED").length;
  const canceled = interviews.filter(i => i.status === "CANCELED").length;
  
  // Upcoming are scheduled interviews that haven't happened yet (date > now)
  const upcoming = interviews.filter(i => i.status === "SCHEDULED" && i.scheduledAt > new Date()).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm transition-transform hover:-translate-y-0.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          Total Interviews
        </p>
        <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
          {total}
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-5 shadow-sm transition-transform hover:-translate-y-0.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-1 relative z-10">
          Scheduled
        </p>
        <div className="flex items-baseline gap-2 relative z-10">
           <p className="text-3xl font-extrabold text-amber-900 dark:text-amber-400">
             {scheduled}
           </p>
           {upcoming > 0 && (
             <span className="text-sm font-semibold text-amber-600 dark:text-amber-500">
               ({upcoming} upcoming)
             </span>
           )}
        </div>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-5 shadow-sm transition-transform hover:-translate-y-0.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-500 uppercase tracking-wider mb-1 relative z-10">
          Completed
        </p>
        <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-400 relative z-10">
          {completed}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm transition-transform hover:-translate-y-0.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">
          Canceled
        </p>
        <p className="text-3xl font-extrabold text-gray-700 dark:text-zinc-300">
          {canceled}
        </p>
      </div>
    </div>
  );
}
