import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PositionStatus } from "@prisma/client"
import Link from "next/link"
import { ResumeUploadZone } from "./ResumeUploadZone"
import { BulkExtractTextButton } from "./BulkExtractTextButton"
import { BulkExtractButton } from "./BulkExtractButton"
import { BulkRankButton } from "./BulkRankButton"
import { BulkAdvancedJudgmentButton } from "./BulkAdvancedJudgmentButton"
import { BulkProcessButton } from "./BulkProcessButton"
import { ShortlistAction } from "./ShortlistAction"
import { OverrideCandidateAction } from "./OverrideCandidateAction"
import { BulkInviteForm } from "./BulkInviteForm"
import { BatchActivityPanel } from "./BatchActivityPanel"
import { SelectAllCheckbox } from "./SelectAllCheckbox"
import { AnalyzeJdButton } from "./AnalyzeJdButton"
import { JdDrawer } from "./JdDrawer"
import { Fragment } from "react"
import { TopCandidatesComparison } from "./TopCandidatesComparison"
import { CandidateFitCard } from "./CandidateFitCard"
import { AiInterviewConfigPanel } from "./AiInterviewConfigPanel"
import { AiInterviewInviteButton } from "./AiInterviewInviteButton"
import { AiQuestionBankPanel } from "./AiQuestionBankPanel"

// ── Status badge colour map ──────────────────────────────────────────────────
const STATUS_STYLES: Record<PositionStatus, string> = {
  DRAFT:    "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  OPEN:     "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  PAUSED:   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  CLOSED:   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-500",
  ARCHIVED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
}

// ── Per-page metadata (dynamic) ──────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const position = await prisma.position.findUnique({
    where: { id },
    select: { title: true },
  })
  return {
    title: position
      ? `${position.title} | Positions | IQMela`
      : "Position | IQMela",
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const position = await prisma.position.findUnique({
    where: { id },
    include: {
      resumes: {
        orderBy: { uploadedAt: "desc" },
        include: { invite: true }
      },
      batchRuns: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  // 404 if the record doesn't exist, or if it belongs to a different admin
  if (!position || position.createdById !== userId) notFound()

  // Fetch position-level AI interview config (Step 179)
  const aiInterviewConfig = await prisma.aiInterviewConfig.findFirst({
    where: { positionId: id, interviewId: null },
  })

  // Fetch existing AI sessions for resumes (Step 178 — show button state)
  const aiSessions = await prisma.aiInterviewSession.findMany({
    where: { positionId: id },
    select: { id: true, resumeId: true, status: true },
  })

  const questionBank = await prisma.aiInterviewQuestion.findMany({
    where: { positionId: id },
    orderBy: { sortOrder: 'asc' }
  })

  // Sort resumes by matchScore (descending), keeping nulls at the bottom
  position.resumes.sort((a, b) => {
    if (a.matchScore !== null && b.matchScore !== null) {
      if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore
    }
    if (a.matchScore !== null && b.matchScore === null) return -1
    if (a.matchScore === null && b.matchScore !== null) return 1
    return 0 // Keep original uploadedAt desc order for ties/nulls
  })

  return (
    <div className="flex flex-col gap-8 w-full">

      <div className="flex items-start justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        {/* Left: title block */}
        <div className="min-w-0 flex-1">
          <Link
            href="/org-admin/positions"
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline mb-2 inline-block"
          >
            ← Back to Positions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight whitespace-nowrap truncate">
              {position.title}
            </h1>
            <span
              className={`inline-flex shrink-0 items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[position.status]}`}
            >
              {position.status}
            </span>
          </div>
          {position.department && (
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm whitespace-nowrap">
              {position.department}
              {position.location ? ` · ${position.location}` : ""}
              {position.employmentType
                ? ` · ${position.employmentType.replace("_", " ")}`
                : ""}
            </p>
          )}
          {/* Edit Position — lives under the title on the left */}
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl hover:-translate-y-0.5 transition-transform text-sm"
              asChild
            >
              <Link href={`/org-admin/positions/${position.id}/edit`}>
                ✎ Edit Position
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Upload Candidates + AI Pipeline side by side */}
        <div className="flex items-start gap-4 shrink-0">
          <ResumeUploadZone positionId={position.id} compact />

          {/* AI Pipeline & Activity card */}
          <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden min-w-[360px]">
            {/* Card header: title + stats + Run button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
                <span className="text-sm font-bold text-gray-900 dark:text-white">AI Pipeline & Activity</span>
              </div>
              <div className="flex items-center gap-2">
                {position.resumes.length > 0 && (() => {
                  const extracted = position.resumes.filter(r => r.parsingStatus === "EXTRACTED" || r.parsingStatus === "RANKED").length
                  const ranked    = position.resumes.filter(r => r.parsingStatus === "RANKED").length
                  const rankedDates = position.resumes.filter(r => r.rankedAt).map(r => r.rankedAt!.getTime())
                  const lastRankedDate = rankedDates.length > 0 ? new Date(Math.max(...rankedDates)) : null
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                        <span className="w-1 h-1 rounded-full bg-gray-400" />{position.resumes.length} total
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                        <span className="w-1 h-1 rounded-full bg-teal-500" />{extracted} extracted
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                        <span className="w-1 h-1 rounded-full bg-indigo-500" />{ranked} ranked
                      </span>
                      {lastRankedDate && (
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 hidden lg:inline">
                          · {lastRankedDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  )
                })()}
                <BulkProcessButton positionId={position.id} totalResumes={position.resumes.length} hasJd={!!position.jdText && position.jdText.trim() !== ""} compact />
              </div>
            </div>

            {/* Batch history grid */}
            <div className="p-3">
              {position.batchRuns && position.batchRuns.length > 0 ? (
                <BatchActivityPanel batchRuns={position.batchRuns} inline />
              ) : (
                <div className="flex items-center gap-2 py-4 text-gray-400 dark:text-zinc-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <p className="text-xs">No runs yet — click <strong>Run AI Pipeline</strong> to start.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Details grid — JD card first, then metadata cards ────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* 1st card — Job Description drawer trigger (clearly clickable) */}
        <div className="col-span-1">
          <JdDrawer
            positionId={position.id}
            description={position.description}
            jdText={position.jdText}
            jdKeywords={Array.isArray(position.jdKeywordsJson) ? position.jdKeywordsJson as string[] : []}
            jdRequiredSkills={Array.isArray(position.jdRequiredSkillsJson) ? position.jdRequiredSkillsJson as string[] : []}
            hasJdAnalysis={!!position.jdKeywordsJson}
          />
        </div>
        {/* Remaining metadata cards */}
        {[
          { label: "Department", value: position.department     ?? "—" },
          { label: "Location",   value: position.location       ?? "—" },
          { label: "Type",       value: position.employmentType
              ? position.employmentType.replace("_", " ")
              : "—" },
          { label: "Status",     value: position.status },
        ].map(({ label, value }) => (
          <Card key={label} className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* ── AI Interview Config Panel (Step 179) ─────────────────── */}
      <AiInterviewConfigPanel positionId={position.id} initial={aiInterviewConfig} />

      {/* ── AI Question Bank ─────────────────────────────────────────── */}
      <AiQuestionBankPanel positionId={position.id} questions={questionBank} />

      {/* ── Upload + Resumes Table ────────────────────────────────── */}
      <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
        <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-4 flex flex-row items-start justify-between gap-4">
          <div className="w-full">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Uploaded Resumes</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Click a resume to view details or run individual actions.
            </p>
            <TopCandidatesComparison resumes={position.resumes} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-6 flex flex-col gap-6">
          {position.resumes.length > 0 ? (
            <BulkInviteForm positionId={position.id}>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-center w-10">
                        <SelectAllCheckbox />
                      </th>
                      <th className="px-4 py-3 font-semibold text-center w-14">Rank</th>
                    <th className="px-5 py-3 font-semibold">Candidate</th>
                    <th className="px-5 py-3 font-semibold">Match</th>
                    <th className="px-5 py-3 font-semibold">Skill Analysis</th>
                    <th className="px-5 py-3 font-semibold hidden xl:table-cell">Email</th>
                    <th className="px-5 py-3 font-semibold">AI Interview</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {position.resumes.map((resume, index) => {
                    const skills   = Array.isArray(resume.skillsJson)             ? (resume.skillsJson as string[]) : []
                    const matchedSkills = Array.isArray(resume.matchedSkillsJson) ? (resume.matchedSkillsJson as string[]) : []
                    const missingSkills = Array.isArray(resume.missingSkillsJson) ? (resume.missingSkillsJson as string[]) : []
                    const warnings = Array.isArray(resume.validationWarningsJson) ? (resume.validationWarningsJson as string[]) : []
                    const isFailed = resume.parsingStatus === "FAILED"
                    
                    const finalName = resume.overrideName || resume.candidateName || resume.originalFileName
                    const hasNameOverride = !!resume.overrideName
                    const finalEmail = resume.overrideEmail || resume.candidateEmail
                    const hasEmailOverride = !!resume.overrideEmail

                    const inviteStatus = resume.invite?.status
                    
                    const hasAnalysis = resume.matchScore !== null || resume.aiInterviewFocusJson || resume.aiRedFlagsJson

                    return (
                      <Fragment key={resume.id}>
                      <tr
                        className={`transition-colors ${
                          isFailed
                            ? "bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/70"
                            : resume.isShortlisted
                            ? "bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50/70 dark:hover:bg-amber-900/20"
                            : "bg-white dark:bg-zinc-900/10 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        <td className="px-4 py-3 text-center vertical-align-middle">
                          {resume.isShortlisted ? (
                            <input
                              type="checkbox"
                              name="resumeIds"
                              value={resume.id}
                              className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-600 dark:bg-zinc-800 cursor-pointer shadow-sm"
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {resume.matchScore !== null ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-extrabold text-xs">
                              #{index + 1}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-zinc-600 font-bold">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isFailed             ? "bg-red-100 dark:bg-red-900/30 text-red-400" :
                              resume.candidateName ? "bg-teal-50 dark:bg-teal-900/30 text-teal-500" :
                                                     "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <Link href={`/org-admin/resumes/${resume.id}`} className="font-semibold text-sm text-gray-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 truncate block max-w-[160px]" title={hasNameOverride ? `Original AI Value: ${resume.candidateName || "none"}` : undefined}>
                                  {finalName}
                                  {hasNameOverride && <span className="text-teal-500 ml-1" title="Overridden by recruiter">*</span>}
                                </Link>
                                <OverrideCandidateAction 
                                  resumeId={resume.id}
                                  aiName={resume.candidateName} aiEmail={resume.candidateEmail} aiPhone={resume.phoneNumber} aiLinkedin={resume.linkedinUrl}
                                  overrideName={resume.overrideName} overrideEmail={resume.overrideEmail} overridePhone={resume.overridePhone} overrideLinkedin={resume.overrideLinkedinUrl}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate max-w-[180px]">
                                  {resume.candidateName ? resume.originalFileName : `${(resume.fileSize / 1024).toFixed(1)} KB`}
                                </p>
                                {resume.phoneNumber && (
                                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700 px-1 rounded truncate max-w-[100px]" title={resume.phoneNumber}>
                                    {resume.phoneNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {resume.matchScore !== null ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1 font-bold text-sm ${
                                resume.matchScore >= 80 ? 'text-teal-600 dark:text-teal-400' :
                                resume.matchScore >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                'text-red-500 dark:text-red-400'
                              }`}>
                                {resume.matchScore}%
                              </span>
                              <span className="text-[9px] uppercase text-gray-500 dark:text-gray-400 font-bold tracking-wider">
                                {resume.matchLabel?.replace('_', ' ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {resume.matchScore !== null ? (
                            <div className="flex flex-col gap-1.5">
                              {/* Matched */}
                              <div className="flex items-center gap-1 flex-wrap">
                                {matchedSkills.length > 0 ? matchedSkills.slice(0, 3).map((s: string) => (
                                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 border border-teal-100 dark:border-teal-800/40 truncate max-w-[120px]">
                                    ✓ {s}
                                  </span>
                                )) : <span className="text-[10px] text-gray-400 dark:text-zinc-500 italic">— No matches</span>}
                                {matchedSkills.length > 3 && <span className="text-[10px] font-bold text-teal-600 dark:text-teal-500">+{matchedSkills.length - 3}</span>}
                              </div>
                              {/* Missing */}
                              <div className="flex items-center gap-1 flex-wrap">
                                {missingSkills.length > 0 ? missingSkills.slice(0, 2).map((s: string) => (
                                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/40 opacity-90 truncate max-w-[100px]">
                                    ✗ {s}
                                  </span>
                                )) : <span className="text-[10px] text-gray-400 dark:text-zinc-500 italic">— No missing skills</span>}
                                {missingSkills.length > 2 && <span className="text-[10px] font-bold text-red-500 dark:text-red-500">+{missingSkills.length - 2}</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {skills.length > 0 ? (
                                <>
                                  {skills.slice(0, 3).map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                                      {s}
                                    </span>
                                  ))}
                                  {skills.length > 3 && <span className="text-[10px] text-gray-400 dark:text-zinc-500">+{skills.length - 3}</span>}
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden xl:table-cell">
                          {finalEmail
                            ? <a href={`mailto:${finalEmail}`} className="text-xs text-teal-600 dark:text-teal-400 hover:underline truncate block max-w-[160px]" title={hasEmailOverride ? `Original AI Value: ${resume.candidateEmail || "none"}` : undefined}>
                                {finalEmail}
                                {hasEmailOverride && <span className="text-teal-500 ml-1" title="Overridden by recruiter">*</span>}
                              </a>
                            : <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {(() => {
                            const session = aiSessions.find(s => s.resumeId === resume.id)
                            if (!session) return <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                            
                            if (session.status === "COMPLETED") {
                              return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Completed</span>
                            }
                            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Pending</span>
                          })()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              resume.parsingStatus === "EXTRACTED" || resume.parsingStatus === "RANKED"   ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400" :
                              resume.parsingStatus === "EXTRACTING" || resume.parsingStatus === "RANKING" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                              resume.parsingStatus === "QUEUED_FOR_AI"  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" :
                              resume.parsingStatus === "FAILED"         ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                              "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {resume.parsingStatus.replace(/_/g, " ")}
                            </span>
                            {warnings.length > 0 && (
                              <span
                                title={`${warnings.length} validation warning(s) — click resume for details`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 cursor-help"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                {warnings.length}
                              </span>
                            )}
                            {resume.extractionConfidence && (
                              <span
                                title={`AI Confidence: ${(resume.extractionConfidence * 100).toFixed(0)}%`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700"
                              >
                                {(resume.extractionConfidence * 100).toFixed(0)}%
                              </span>
                            )}
                            {inviteStatus && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/40 dark:text-indigo-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/></svg>
                                INV {inviteStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-right">
                            <ShortlistAction resumeId={resume.id} isShortlisted={resume.isShortlisted} initialNotes={resume.recruiterNotes} />
                            {resume.isShortlisted && (
                              <AiInterviewInviteButton
                                resumeId={resume.id}
                                positionId={position.id}
                                existingSessionId={aiSessions.find(s => s.resumeId === resume.id)?.id ?? null}
                              />
                            )}
                            <Link href={`/org-admin/resumes/${resume.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all border border-transparent hover:border-teal-200 dark:hover:border-teal-800">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {hasAnalysis && (
                          <tr className="border-x border-b border-gray-100 dark:border-zinc-800 bg-gray-50/20 dark:bg-zinc-900/20">
                            <td colSpan={8} className="p-0">
                               <details className="group">
                                 <summary className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer p-2 flex items-center justify-center gap-1 transition-colors select-none">
                                   <span>Expand Deep AI Intelligence</span>
                                   <svg className="w-3 h-3 opacity-60 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                 </summary>
                                 <div className="border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-inner rounded-b-xl overflow-hidden">
                                   <CandidateFitCard resume={resume} />
                                 </div>
                               </details>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </BulkInviteForm>
          ) : (
            <div className="mx-6 flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50/50 dark:bg-zinc-900/30">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No resumes uploaded yet</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Use the upload box above to drop candidate PDF/DOCX files</p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
