"use client";

import React, { useState } from "react";
import { PanelistScorecardForm } from "./PanelistScorecardForm";

type InterviewData = {
  id: string;
  status: string;
  durationMinutes: number;
  scheduledAt: Date;
  roomName: string | null;
  resumeId?: string | null;
  positionId?: string | null;
  stageIndex?: number | null;
  position: { title: string } | null;
  candidate: { name: string | null; email: string };
  feedback: any | null;
};

export function InterviewListCard({ interview, isPast }: { interview: InterviewData; isPast: boolean }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative ${isPast ? "opacity-80" : "border-t-4 border-t-teal-500"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
            {interview.position?.title || "General Interview"}
          </p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {interview.candidate.name || interview.candidate.email}
          </h3>
        </div>
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          interview.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
          interview.status === "CANCELED"  ? "bg-gray-200 text-gray-600" :
          "bg-amber-100 text-amber-700"
        }`}>
          {interview.status}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-sm text-gray-600 dark:text-zinc-400">
        <p><strong>Date:</strong> {interview.scheduledAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
        <p><strong>Time:</strong> {interview.scheduledAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} ({interview.durationMinutes} min)</p>
        {!isPast && interview.roomName && (
          <p className="mt-2">
            <a href={interview.roomName} target="_blank" rel="noreferrer" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
              Join Meeting →
            </a>
          </p>
        )}
      </div>

      <div className="mt-6">
        {interview.feedback ? (
          <div className="w-full py-2 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-semibold rounded-xl text-sm border border-emerald-100 dark:border-emerald-800/30 cursor-default">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Scorecard Submitted
          </div>
        ) : interview.status !== "CANCELED" ? (
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-violet-500/20 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Submit Scorecard
          </button>
        ) : null}
      </div>

      {showModal && (
        <PanelistScorecardForm
          interviewId={interview.id}
          candidateName={interview.candidate.name || interview.candidate.email}
          positionTitle={interview.position?.title}
          stageLabel="Interview Evaluation"
          resumeId={interview.resumeId ?? undefined}
          positionId={interview.positionId ?? undefined}
          stageIndex={interview.stageIndex ?? undefined}
          onClose={() => setShowModal(false)}
          onSubmitted={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
