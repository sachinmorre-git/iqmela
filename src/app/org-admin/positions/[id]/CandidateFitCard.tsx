import React from "react"

export function CandidateFitCard({ resume }: { resume: any }) {
  const recommendation = resume.aiRecommendationLabel || "UNRANKED"
  const rationale = resume.aiRecommendationRationale || resume.rankingExplanation
  
  const strengths = Array.isArray(resume.notableStrengthsJson) ? resume.notableStrengthsJson : []
  const gaps = Array.isArray(resume.possibleGapsJson) ? resume.possibleGapsJson : []
  
  const matchedSkills = Array.isArray(resume.matchedSkillsJson) ? (resume.matchedSkillsJson as string[]) : []
  const missingSkills = Array.isArray(resume.missingSkillsJson) ? (resume.missingSkillsJson as string[]) : []
  
  const focusAreas = Array.isArray(resume.aiInterviewFocusJson) ? resume.aiInterviewFocusJson : []
  const questions = Array.isArray(resume.aiInterviewQuestionsJson) ? resume.aiInterviewQuestionsJson : []
  const redFlags = Array.isArray(resume.aiRedFlagsJson) ? resume.aiRedFlagsJson : []
  const validationWarnings = Array.isArray(resume.validationWarningsJson) ? resume.validationWarningsJson : []

  const isDuplicate = !!resume.isNearDuplicate

  const getRecColor = (rec: string) => {
    switch (rec) {
      case "STRONG_HIRE": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
      case "HIRE": return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800"
      case "MAYBE": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      case "NO_HIRE": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
      default: return "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-400 border-gray-200 dark:border-zinc-700"
    }
  }

  return (
    <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
      {!resume.advancedJudgmentAt && (
        <div className="col-span-1 md:col-span-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <span className="font-bold text-amber-800 dark:text-amber-400">DeepSeek Reasoner Not Run</span>
            <p className="text-amber-700 dark:text-amber-500 text-xs">Run the Advanced AI Judgment action to generate in-depth interview questions, red flags, and risk analysis for this candidate.</p>
          </div>
        </div>
      )}

      {/* ── Column 1: Fit & Overview ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Skill Match Analysis */}
        {(matchedSkills.length > 0 || missingSkills.length > 0) && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Skill Match</h4>
            {matchedSkills.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {matchedSkills.map((s: string) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 border border-teal-100 dark:border-teal-800/40">
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}
            {missingSkills.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {missingSkills.map((s: string) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 opacity-90">
                    ✗ {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommendation Badge */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Shortlist Suggestion</h4>
          <div className={`inline-flex w-fit px-3 py-1.5 rounded-lg border font-bold text-xs tracking-wide ${getRecColor(recommendation)}`}>
            {recommendation.replace("_", " ")}
          </div>
          {rationale && <p className="text-gray-600 dark:text-zinc-400 text-xs leading-relaxed italic">{rationale}</p>}
        </div>

        {/* Strengths & Gaps */}
        <div className="flex flex-col gap-3 mt-2">
          {strengths.length > 0 && (
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-500 mb-1.5">Notable Strengths</h5>
              <ul className="flex flex-col gap-1">
                {strengths.map((str: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-zinc-300">
                    <span className="text-teal-500 mt-0.5">•</span> {str}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {gaps.length > 0 && (
            <div className="mt-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400 mb-1.5">Possible Gaps</h5>
              <ul className="flex flex-col gap-1">
                {gaps.map((gap: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-zinc-300">
                    <span className="text-red-400 mt-0.5">•</span> {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Column 2: Interview Intelligence ──────────────────────────────── */}
      <div className="flex flex-col gap-5 border-l border-gray-100 dark:border-zinc-800/80 pl-6">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-3">AI Interview Focus Areas</h4>
          {focusAreas.length > 0 ? (
            <div className="flex flex-col gap-3">
              {focusAreas.map((fa: any, i: number) => (
                <div key={i} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/30 p-2.5 rounded-lg">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 text-xs">{fa.topic}</span>
                  <p className="text-gray-600 dark:text-zinc-400 text-xs mt-0.5">{fa.focus}</p>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">No specific focus areas generated.</span>
          )}
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-3">Suggested Questions</h4>
          {questions.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {questions.map((q: any, i: number) => (
                <li key={i} className="flex flex-col gap-1">
                  <span className="inline-flex w-fit px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-gray-100 dark:bg-zinc-800 text-gray-500">
                    {q.category}
                  </span>
                  <p className="text-gray-800 dark:text-zinc-200 font-medium text-xs leading-snug">"{q.question}"</p>
                  <p className="text-gray-500 dark:text-zinc-500 text-[10px] leading-tight mt-0.5">Rationale: {q.rationale}</p>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-gray-400 italic">No questions generated.</span>
          )}
        </div>
      </div>

      {/* ── Column 3: Red Flags & Warnings ────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-l border-gray-100 dark:border-zinc-800/80 pl-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">Forensic Analysis</h4>
        
        {isDuplicate && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 p-3 rounded-lg flex gap-2 items-start mt-1">
            <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <div>
              <span className="font-bold text-orange-700 dark:text-orange-400 text-xs block">Near-Duplicate Detected</span>
              <p className="text-orange-600 dark:text-orange-500 text-xs mt-0.5">{resume.duplicateReason}</p>
            </div>
          </div>
        )}

        {redFlags.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">AI Red Flags</span>
            {redFlags.map((flag: any, i: number) => (
              <div key={i} className="flex gap-2 items-start bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100/50 dark:border-rose-900/30 p-2.5 rounded-lg">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                  flag.severity === "HIGH" ? "bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200" :
                  flag.severity === "MEDIUM" ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200" :
                  "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}>
                  {flag.severity || "FLAG"}
                </span>
                <p className="text-xs text-rose-700 dark:text-rose-300/80 leading-tight pt-0.5">{flag.description}</p>
              </div>
            ))}
          </div>
        )}

        {validationWarnings.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Validation Warnings</span>
            <ul className="flex flex-col gap-1.5 list-disc pl-4 text-xs text-amber-600 dark:text-amber-400/80">
              {validationWarnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {!isDuplicate && redFlags.length === 0 && validationWarnings.length === 0 && (
           <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4 text-center mt-2 flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-zinc-700">
             <svg className="w-5 h-5 text-gray-400 mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
             <span className="text-xs text-gray-500 font-semibold">No Red Flags</span>
           </div>
        )}

      </div>
    </div>
  )
}
