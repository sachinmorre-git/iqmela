"use client";

import React, { useState } from "react";
import Link from "next/link";
import { InterviewStatus, InterviewMode } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/locale-utils";

type InterviewData = {
  id: string;
  title: string;
  status: InterviewStatus;
  interviewMode: InterviewMode;
  scheduledAt: Date;
  durationMinutes: number;
  roomName: string | null;
  candidate: { id: string; name: string | null; email: string } | null;
  candidateEmail?: string | null;
  candidateName?: string | null;
  interviewer: { id: string; name: string | null; email: string } | null;
  position: { id: string; title: string } | null;
};

export function InterviewsTable({ interviews }: { interviews: InterviewData[] }) {
  const [filter, setFilter] = useState<"ALL" | InterviewStatus>("ALL");
  const [search, setSearch] = useState("");

  const filtered = interviews.filter((i) => {
    // Status filter
    if (filter !== "ALL" && i.status !== filter) return false;
    
    // Search filter
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      const candName = (i.candidate?.name || i.candidateName || "").toLowerCase();
      const candEmail = (i.candidate?.email || i.candidateEmail || "").toLowerCase();
      const posTitle = i.position?.title.toLowerCase() || "";
      
      if (!candName.includes(q) && !candEmail.includes(q) && !posTitle.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      
      {/* Toolbar */}
      <div className="border-b border-gray-100 dark:border-zinc-800 p-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Status Filters */}
        <div className="flex items-center p-1 bg-gray-100/50 dark:bg-zinc-800/50 rounded-xl border border-gray-200/60 dark:border-zinc-700/60 overflow-x-auto hide-scrollbar w-full sm:w-auto">
          {["ALL", "SCHEDULED", "COMPLETED", "CANCELED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === status
                  ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-zinc-800"
              }`}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search candidate or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-transparent border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-shadow dark:text-white"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No interviews found</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            {search ? "No candidates matched your search." : "No interviews match this filter criteria."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/50 dark:bg-zinc-800/30 border-b border-gray-100 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Interviewer / Mode</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80">
              {filtered.map((interview) => (
                <tr 
                  key={interview.id} 
                  className={`group transition-colors hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 relative ${interview.position ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col relative z-10">
                      <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                        {interview.candidate?.name || interview.candidateName || "Unknown"}
                      </span>
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">
                        {interview.candidate?.email || interview.candidateEmail || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {interview.position ? (
                      <Link 
                        href={`/org-admin/positions/${interview.position.id}?tab=interviews`}
                        className="text-rose-600 dark:text-rose-400 font-semibold hover:underline after:absolute after:inset-0"
                        title={interview.position.title}
                      >
                        <span className="truncate block max-w-[150px]">
                          {interview.position.title}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-gray-400 dark:text-zinc-500 relative z-10">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {interview.interviewMode === "AI_AVATAR" ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                        🤖 AI Avatar
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">
                          {interview.interviewer?.name || "Human"}
                        </span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                          {interview.interviewer?.email || "—"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-gray-900 dark:text-gray-200 font-medium">
                        {formatDate(interview.scheduledAt)}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {formatTime(interview.scheduledAt, { showTimezone: false })} ({interview.durationMinutes}m)
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {interview.status === "SCHEDULED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">Scheduled</span>}
                    {interview.status === "COMPLETED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">Completed</span>}
                    {interview.status === "CANCELED" && <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wider">Canceled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
