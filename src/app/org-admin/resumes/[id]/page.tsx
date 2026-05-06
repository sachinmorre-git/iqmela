import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ExtractTextButton } from "./ExtractTextButton"
import { RunAiExtractionButton } from "./RunAiExtractionButton"
import { RawAiOutputDebug } from "./RawAiOutputDebug"
import { CandidateFitCard } from "../../positions/[id]/CandidateFitCard"
import { AiReviewPanel } from "../../positions/[id]/AiReviewPanel"
import { getCallerPermissions } from "@/lib/rbac"
import { canSeePII } from "@/lib/pii-redact"
import { UnifiedProfileClient } from "./UnifiedProfileClient"
import { ScoreDial } from "@/components/ui/ScoreDial"
import { CandidateJourneyTracker, JourneyStage, JourneyStageState } from "@/components/ui/CandidateJourneyTracker"
import { CandidateDecisionBar } from "@/components/ui/CandidateDecisionBar"
import { CandidateDecisionHistoryModal } from "./CandidateDecisionHistoryModal"
import { DeepAiDrawer } from "./DeepAiDrawer"
import { InteractiveJourneyTracker } from "./InteractiveJourneyTracker"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const resume = await prisma.resume.findUnique({
    where: { id },
    select: { originalFileName: true },
  })
  return {
    title: resume ? `${resume.originalFileName} | Resume | IQMela` : "Resume | IQMela",
  }
}

// ── Status badge helper ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "EXTRACTED" || status === "RANKED"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
      : status === "EXTRACTING" || status === "RANKING"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
      : status === "QUEUED_FOR_AI"
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
      : status === "FAILED"
      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${styles}`}>
      {status.replace(/_/g, " ")}
    </span>
  )
}

// ── Small label+value row ─────────────────────────────────────────────────────
function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  )
}

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canViewPositions) redirect("/org-admin/dashboard")

  const showPII = canSeePII(perms.roles);

  const { id } = await params

  const resume = await prisma.resume.findUnique({
    where: { id, isDeleted: false },
    include: {
      position: {
        include: {
          interviewPlan: { include: { stages: { orderBy: { stageIndex: "asc" } } } },
        },
      },
      interviews: {
        orderBy: { stageIndex: "asc" },
        include: {
          panelists:        { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          panelistFeedbacks: { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          feedback:   true,
          aiAnalysis: true,
          behaviorReport: true,
        },
      },
      aiInterviewSessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { 
          candidate: { select: { name: true, email: true } },
          turns: { orderBy: { turnIndex: "asc" }, select: {
            turnIndex: true, category: true, question: true,
            candidateAnswer: true, scoreRaw: true, scoreFeedback: true,
            answerDurationMs: true, suspiciousFlags: true, transcriptWarnings: true,
          }}
        },
      },
      panelistFeedbacks: {
        include: { interviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { submittedAt: "asc" },
      },
      hiringDecisions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { decidedBy: { select: { name: true, email: true } } },
      },
      bgvChecks: {
        orderBy: { createdAt: "desc" },
      },
      jobOffers: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!resume || resume.position?.organizationId !== perms.orgId) notFound()
  if (perms.scopedDeptIds && resume.position?.departmentId && !perms.scopedDeptIds.includes(resume.position.departmentId)) notFound()

  // Extract aiSession for legacy components
  const aiSession = resume.aiInterviewSessions?.[0] || null;

  const skills        = Array.isArray(resume.skillsJson)          ? (resume.skillsJson as string[]) : []
  const companies     = Array.isArray(resume.companiesJson)        ? (resume.companiesJson as Array<{ company: string; role: string; duration?: string | null }>) : []
  const education     = Array.isArray(resume.educationJson)        ? (resume.educationJson as Array<{ degree: string; institution: string; year?: string | null }>) : []
  const warnings      = Array.isArray(resume.validationWarningsJson) ? (resume.validationWarningsJson as string[]) : []
  const hasAiData     = !!(resume.candidateName || resume.candidateEmail || skills.length)

  // ── Compute Pipeline Stages ──────────────────────────────────────────────────
  const journeyStages: JourneyStage[] = [];

  const planStages = resume.position?.interviewPlan?.stages || [];
  
  planStages.forEach((planStage: any) => {
    // 1. AI Screening Stage
    if (planStage.roundType === "AI_SCREEN") {
      const aiScreenState: JourneyStageState = aiSession ? (aiSession.status === "COMPLETED" ? "COMPLETED" : "PENDING") : "PENDING";
      journeyStages.push({
        id: `stage-${planStage.id}`,
        title: planStage.roundLabel || "AI Screening",
        icon: "🤖",
        state: aiScreenState,
        score: aiSession?.overallScore || undefined,
        label: aiSession?.recommendation?.replace(/_/g, " ") || undefined,
        reportLink: aiSession ? `/org-admin/candidates/${resume.id}/intelligence?focus=ai-screen` : undefined,
      });
      return;
    }

    // Note: BGV_CHECK is now handled universally outside this loop

    // 3. Regular Interview Stage
    const actualInterview = resume.interviews?.find((i: any) => i.stageIndex === planStage.stageIndex);
    let state: JourneyStageState = "PENDING";
    let score;
    let label;

    if (actualInterview) {
      const feedbacks = actualInterview.panelistFeedbacks || [];
      if (actualInterview.status === "COMPLETED" || feedbacks.length > 0) {
        state = "COMPLETED";
        if (feedbacks.length > 0) {
          score = Math.round(feedbacks.reduce((s: number, f: any) => s + f.overallScore, 0) / feedbacks.length);
        }
      } else {
        state = "ACTIVE";
      }
    }

    journeyStages.push({
      id: `stage-${planStage.id}`,
      title: planStage.roundLabel || `Round ${planStage.stageIndex + 1}`,
      icon: "👥",
      state,
      score,
      label,
      reportLink: actualInterview && (actualInterview.status === "COMPLETED" || (actualInterview.panelistFeedbacks && actualInterview.panelistFeedbacks.length > 0))
        ? `/org-admin/candidates/${resume.id}/intelligence?focus=${actualInterview.id}`
        : undefined,
    });
  });

  // 3. Universal Background Check (BGV)
  const bgv = resume.bgvChecks?.[0];
  let bgvState: JourneyStageState = "PENDING";
  if (bgv) {
    if (bgv.status === "CLEAR" || bgv.status === "COMPLETED") bgvState = "COMPLETED";
    else if (bgv.status === "FAILED" || bgv.status === "ADVERSE_CONFIRMED" || bgv.status === "CONSIDER") bgvState = "FAILED";
    else bgvState = "ACTIVE";
  }
  journeyStages.push({
    id: "bgv",
    title: "Background Check",
    icon: "🔍",
    state: bgvState,
    label: bgv?.status,
    reportLink: bgv?.reportUrl || undefined,
  });

  // 4. Job Offer (Always append to end)
  const offer = resume.jobOffers?.[0];
  let offerState: JourneyStageState = "PENDING";
  if (offer) {
    if (offer.status === "ACCEPTED") offerState = "COMPLETED";
    else if (offer.status === "DECLINED" || offer.status === "REVOKED") offerState = "FAILED";
    else offerState = "ACTIVE";
  }
  journeyStages.push({
    id: "offer",
    title: "Job Offer",
    icon: "📜",
    state: offerState,
    label: offer?.status,
  });

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Back Link */}
        <div>
          <Link
            href={`/org-admin/positions/${resume.positionId}`}
            className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline flex items-center gap-1.5 transition-colors"
          >
            ← Back to Position ({resume.position.title})
          </Link>
        </div>

        <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-xl relative overflow-hidden">
          {/* Decorative subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          {/* Left Content */}
          <div className="relative z-10 flex flex-col items-start">
          
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight uppercase drop-shadow-md">
              {resume.candidateName || resume.originalFileName.split('.')[0].replace(/_/g, " ")}
            </h1>
            <DeepAiDrawer resume={resume} userRoles={perms.roles ?? []} />
          </div>
          
          <div className="text-white/90 text-sm md:text-base font-medium space-y-1 drop-shadow-sm">
             <p>{resume.position.title} <span className="opacity-50 mx-1.5">·</span> Stage {resume.pipelineStageIdx + 1} of {planStages.length}</p>
             {showPII && <p>{resume.candidateEmail || "No email available"}</p>}
          </div>

          {/* Mini Pipeline Progress */}
          <div className="flex items-start gap-1.5 sm:gap-2 mt-6 w-full max-w-2xl">
            {journeyStages.map((stage, idx) => (
              <div key={stage.id || idx} className="flex-1 flex flex-col gap-1.5">
                <div 
                  className={`h-1.5 shrink-0 rounded-full w-full ${
                    stage.state === 'COMPLETED' ? 'bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.4)]' :
                    stage.state === 'ACTIVE' ? 'bg-white/60 animate-pulse' :
                    'bg-white/20'
                  }`}
                />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 leading-tight drop-shadow-sm line-clamp-2">
                  {stage.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Content (The 3 retained elements) */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          {resume.matchScore != null && (
            <div className="shrink-0 flex items-center justify-center">
              <ScoreDial 
                score={resume.matchScore} 
                size={80} 
                label="AI Match" 
                labelClassName="text-xs font-extrabold uppercase tracking-widest text-white/90 drop-shadow-sm text-center"
              />
            </div>
          )}
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <RunAiExtractionButton
              resumeId={resume.id}
              disabled={!resume.extractedText || resume.parsingStatus === "EXTRACTING"}
            />
            <CandidateDecisionHistoryModal decisions={resume.hiringDecisions || []} />
            <Button size="sm" variant="outline" className="w-full justify-center bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white rounded-lg transition-all shadow-sm whitespace-nowrap">
              <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download
            </Button>
          </div>
        </div>
      </div>
      </div>
      <InteractiveJourneyTracker 
        stages={journeyStages} 
        resume={resume}
        userRoles={perms.roles ?? []}
      />
      
      {/* ── Decision Bar — pipeline roles only ── */}
      {perms.canManagePositions && (
        <CandidateDecisionBar
          resume={resume}
          status={resume.pipelineStatus}
          totalStages={planStages.length}
          canAdvance={!["REJECTED", "HIRED", "WITHDRAWN"].includes(resume.pipelineStatus) && resume.pipelineStatus !== "OFFER_PENDING"}
          canHold={!["REJECTED", "HIRED", "WITHDRAWN"].includes(resume.pipelineStatus)}
          canReject={(perms.roles ?? []).some((r) => ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r))}
          canOffer={(perms.roles ?? []).some((r) => ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r))}
          canHire={(perms.roles ?? []).some((r) => ["ORG_ADMIN", "DEPT_ADMIN"].includes(r))}
        />
      )}

      <UnifiedProfileClient
        resume={resume}
        aiSession={aiSession}
        userRoles={perms.roles ?? []}
        rawResumeNode={
          <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-5">

          {/* 1. Contact Card */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 flex flex-col gap-4">
              <InfoRow label="Name">
                {resume.candidateName
                  ? <p className="text-sm font-semibold text-gray-900 dark:text-white">{resume.candidateName}</p>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
              {showPII && (
                <InfoRow label="Email">
                  {resume.candidateEmail
                    ? <a href={`mailto:${resume.candidateEmail}`} className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline break-all">{resume.candidateEmail}</a>
                    : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
                </InfoRow>
              )}
              {showPII && (
                <InfoRow label="Phone">
                  {resume.phoneNumber
                    ? <p className="text-sm font-medium text-gray-900 dark:text-white">{resume.phoneNumber}</p>
                    : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
                </InfoRow>
              )}
              <InfoRow label="Location">
                {resume.location
                  ? <p className="text-sm font-medium text-gray-900 dark:text-white">{resume.location}</p>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
              {showPII && (
                <InfoRow label="LinkedIn">
                  {resume.linkedinUrl
                    ? <a href={resume.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline break-all">{resume.linkedinUrl}</a>
                    : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
                </InfoRow>
              )}
            </CardContent>
          </Card>

          {/* 2. Experience Card */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Experience
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-4 flex flex-col gap-4">
              <InfoRow label="Total Years">
                {resume.experienceYears != null
                  ? <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{resume.experienceYears} <span className="text-sm font-normal text-gray-400">yrs</span></p>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>

              {companies.length > 0 && (
                <InfoRow label="Companies">
                  <div className="flex flex-col gap-3 mt-1">
                    {companies.map((c, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{c.company}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">{c.role}{c.duration ? ` · ${c.duration}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </InfoRow>
              )}
            </CardContent>
          </Card>

          {/* 3. AI Ranking placeholder */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm bg-gradient-to-br from-white to-gray-50/50 dark:from-zinc-900/30 dark:to-zinc-900/10">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                AI Match Score
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-rose-500 mb-2">
                  {resume.matchScore != null ? `${resume.matchScore} / 100` : "— / 100"}
                </span>
                {resume.matchLabel
                  ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">{resume.matchLabel}</span>
                  : <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-[160px] leading-relaxed">Ranking against "{resume.position.title}" will appear after AI ranking is run.</p>
                }
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Skills */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Skills
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-4">
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-100 dark:border-pink-800/40"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400 dark:text-zinc-500">No skills extracted yet. Run AI Extraction to populate.</p>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Education
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-4">
              {education.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {education.map((e, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{e.degree}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-400">{e.institution}{e.year ? ` · ${e.year}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-gray-400 dark:text-zinc-500">No education data extracted yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Extracted Text */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <CardHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                  Extracted Raw Text
                </CardTitle>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Source document parsed text</p>
              </div>
              <ExtractTextButton
                resumeId={resume.id}
                disabled={resume.parsingStatus === "EXTRACTING"}
              />
            </CardHeader>
            <CardContent className="px-6 py-4">
              {resume.extractedText ? (
                <div className="bg-gray-50/50 dark:bg-zinc-900/30 rounded-xl p-4 border border-gray-100 dark:border-zinc-800 max-h-[500px] overflow-y-auto">
                  <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {resume.extractedText}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">No text extracted</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 max-w-[220px]">Click "Extract Resume Text" to parse the uploaded document.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Extraction Meta + Debug */}
          {hasAiData && (
            <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
              <CardHeader className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800/60">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                  Extraction Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <InfoRow label="AI Status">
                    <StatusBadge status={resume.parsingStatus} />
                  </InfoRow>
                  <InfoRow label="Provider">
                    {resume.extractionProvider
                      ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-100 dark:border-pink-800/40 capitalize">{resume.extractionProvider}</span>
                      : <p className="text-sm italic text-gray-400">—</p>}
                  </InfoRow>
                  <InfoRow label="Confidence">
                    {resume.extractionConfidence != null
                      ? <p className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(resume.extractionConfidence * 100)}%</p>
                      : <p className="text-sm italic text-gray-400">—</p>}
                  </InfoRow>
                </div>
                {warnings.length > 0 && (
                  <InfoRow label={`Validation Warnings (${warnings.length})`}>
                    <ul className="flex flex-col gap-1.5 mt-1">
                      {warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-800/30">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </InfoRow>
                )}
                {resume.aiRawOutputJson && (
                  <RawAiOutputDebug data={resume.aiRawOutputJson} />
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

          </>
        }
      />
    </div>
  )
}
