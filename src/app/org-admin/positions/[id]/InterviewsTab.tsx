import React from "react";
import { InterviewScheduler } from "./InterviewScheduler";
import { Interview, User } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/locale-utils";

type InterviewData = Interview & {
  candidate: Pick<User, "name" | "email">;
  interviewer: Pick<User, "name" | "email">;
};

export function InterviewsTab({
  positionId,
  interviews,
  resumes,
  interviewers,
  showPII = true,
}: {
  positionId: string;
  interviews: InterviewData[];
  resumes: any[];
  interviewers: any[];
  showPII?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Interviews</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage scheduled interviews and review feedback.
          </p>
        </div>
        <InterviewScheduler positionId={positionId} resumes={resumes} interviewers={interviewers} />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {interviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-full flex items-center justify-center mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No interviews scheduled</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[250px]">
              Click "Schedule Interview" to assign a candidate to an interviewer or an AI Avatar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Interviewer / Mode</th>
                  <th className="px-5 py-3 font-semibold">Date & Time</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {interviews.map((interview) => (
                  <tr key={interview.id} className="transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {interview.title}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 dark:text-white">{interview.candidate?.name || (interview as any).candidateName || "Unknown"}</span>
                        {showPII && <span className="text-xs text-gray-500">{interview.candidate?.email || (interview as any).candidateEmail || ""}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {interview.interviewMode === "AI_AVATAR" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                          🤖 AI Avatar
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {interview.interviewer.name || "Human"}
                          </span>
                          <span className="text-xs text-gray-500 tracking-wide text-[10px]">
                            {interview.interviewer.email}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-gray-200">
                           {formatDate(interview.scheduledAt)}
                        </span>
                        <span className="text-xs text-gray-500">
                           {formatTime(interview.scheduledAt, { showTimezone: false })} ({interview.durationMinutes}m)
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {interview.status === "SCHEDULED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">Scheduled</span>}
                      {interview.status === "COMPLETED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">Completed</span>}
                      {interview.status === "CANCELED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wider">Canceled</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                       {/* Dropdown or buttons for actions could go here */}
                       {interview.roomName && interview.interviewMode === "HUMAN" && (
                         <a href={interview.roomName} target="_blank" rel="noreferrer" className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2">
                           Join Link
                         </a>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
