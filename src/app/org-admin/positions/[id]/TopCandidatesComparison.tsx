"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function TopCandidatesComparison({ resumes }: { resumes: any[] }) {
  const [isOpen, setIsOpen] = useState(false)

  // Top candidates: Shortlisted OR top 3 by score
  const topCandidates = resumes.filter(r => r.isShortlisted).length > 0 
    ? resumes.filter(r => r.isShortlisted)
    : resumes.filter(r => r.matchScore !== null).slice(0, 3)

  if (topCandidates.length < 2) return null

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-100 hover:text-teal-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8"/><path d="m3 3 7.53 7.53"/><path d="m21 3-7.53 7.53"/></svg>
        Compare Top Candidates ({topCandidates.length})
      </Button>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-teal-200 dark:border-teal-800/40 bg-teal-50/30 dark:bg-zinc-900/40 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-teal-100 dark:border-teal-900/40 bg-white/50 dark:bg-zinc-900/80">
        <h3 className="font-bold text-teal-900 dark:text-teal-100 flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8"/><path d="m3 3 7.53 7.53"/><path d="m21 3-7.53 7.53"/></svg>
           Top Candidates Comparison
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-8 w-8 p-0 rounded-full">
           <span className="sr-only">Close</span>
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </Button>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {topCandidates.map(resume => {
            const strengths = Array.isArray(resume.notableStrengthsJson) ? resume.notableStrengthsJson : []
            const gaps = Array.isArray(resume.possibleGapsJson) ? resume.possibleGapsJson : []
            return (
              <div key={resume.id} className="w-80 shrink-0 bg-white dark:bg-zinc-900 border border-teal-100 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
                 <div className="flex justify-between items-start">
                   <div>
                     <h4 className="font-bold text-gray-900 dark:text-white text-base truncate w-48" title={resume.candidateName || resume.originalFileName}>
                       {resume.overrideName || resume.candidateName || resume.originalFileName}
                     </h4>
                     <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                       {resume.aiRecommendationLabel?.replace("_", " ") || "No Recommendation"}
                     </span>
                   </div>
                   <span className="text-xl font-black text-teal-600 dark:text-teal-500">{resume.matchScore ?? "-"}%</span>
                 </div>
                 
                 <div>
                   <h5 className="text-[10px] uppercase tracking-wider font-bold text-teal-600 dark:text-teal-500 mb-1.5 border-b border-teal-100 dark:border-teal-900/40 pb-1">Top Strengths</h5>
                   <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                     {strengths.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">✓ {s}</li>)}
                     {strengths.length === 0 && <span className="italic">None identified</span>}
                   </ul>
                 </div>

                 <div>
                   <h5 className="text-[10px] uppercase tracking-wider font-bold text-red-500 mb-1.5 border-b border-red-100 dark:border-red-900/40 pb-1">Key Gaps</h5>
                   <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                     {gaps.slice(0, 3).map((s: string, i: number) => <li key={i} className="truncate">✗ {s}</li>)}
                     {gaps.length === 0 && <span className="italic">None identified</span>}
                   </ul>
                 </div>

                 {resume.recruiterNotes && (
                   <div className="mt-auto bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-800/30">
                     <h5 className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-500 mb-1">Recruiter Note</h5>
                     <p className="text-xs text-amber-900 dark:text-amber-400/80 italic">{resume.recruiterNotes}</p>
                   </div>
                 )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
