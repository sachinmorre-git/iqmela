"use client";

import { PanelistScorecardForm } from "@/app/interviewer/interviews/PanelistScorecardForm";
import Link from "next/link";

/**
 * Post-interview evaluation shown inside the live room after the session ends.
 * Now powered by the premium PanelistScorecardForm (4-dimension).
 */
export function FeedbackForm({ interviewId, resumeId, positionId, stageIndex, candidateName, positionTitle }: {
  interviewId: string;
  resumeId?: string;
  positionId?: string;
  stageIndex?: number;
  candidateName?: string;
  positionTitle?: string;
}) {
  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-zinc-950 py-12 px-4 flex flex-col items-center">
      {/* Back link */}
      <div className="w-full max-w-2xl mb-6">
        <Link href="/interviewer/interviews" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 font-medium flex items-center gap-1.5 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Interviews
        </Link>
      </div>

      {/* Inline scorecard — no backdrop overlay since this isn't a modal */}
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {/* Header strip */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-8 py-8">
          <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-1">Post-Interview Evaluation</p>
          <h1 className="text-2xl font-black text-white">Lock in your scorecard</h1>
          <p className="text-indigo-200 text-sm mt-1">Your evaluation is securely stored and shared only with the hiring team.</p>
        </div>

        {/* Mount the scorecard form in "inline" mode — no modal backdrop */}
        <InlineScorecardWrapper
          interviewId={interviewId}
          resumeId={resumeId}
          positionId={positionId}
          stageIndex={stageIndex}
          candidateName={candidateName || "Candidate"}
          positionTitle={positionTitle}
        />
      </div>
    </div>
  );
}

// Wrapper to strip the modal overlay behaviour and render inline
function InlineScorecardWrapper(props: {
  interviewId: string;
  resumeId?: string;
  positionId?: string;
  stageIndex?: number;
  candidateName: string;
  positionTitle?: string;
}) {
  // We render the scorecard content directly — no fixed overlay
  return (
    <PanelistScorecardForm
      interviewId={props.interviewId}
      resumeId={props.resumeId}
      positionId={props.positionId}
      stageIndex={props.stageIndex}
      candidateName={props.candidateName}
      positionTitle={props.positionTitle}
      stageLabel="Live Interview"
      onClose={() => { window.location.href = "/interviewer/interviews"; }}
    />
  );
}
