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
import { DeleteResumeButton } from "./DeleteResumeButton"
import { PipelineWrapper } from "./PipelineWrapper"
import type { StageState, PipelineStage } from "./CandidatePipelineBar"

import { Fragment } from "react"
import { TopCandidatesComparison } from "./TopCandidatesComparison"
import { CandidateFitCard } from "./CandidateFitCard"
import { AiInterviewConfigPanel } from "./AiInterviewConfigPanel"
import { AiQuestionBankPanel } from "./AiQuestionBankPanel"

import { BatchActivityPanel } from "./BatchActivityPanel"
import { SelectAllCheckbox } from "./SelectAllCheckbox"
import { AnalyzeJdButton } from "./AnalyzeJdButton"
import { AiInterviewInviteButton } from "./AiInterviewInviteButton"
import { DispatchVendorsModal } from "./DispatchVendorsModal"
import { PublishToBoardsButton } from "./PublishToBoardsButton"
import { getCallerPermissions } from "@/lib/rbac"
import { canSeePII } from "@/lib/pii-redact"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { InterviewsTab } from "./InterviewsTab"
import DistributionPanel from "./DistributionPanel"
import IntakeQueuePanel from "./IntakeQueuePanel"
import { AllCandidatesTab } from "./AllCandidatesTab"
import { Sparkles, ChevronRight } from "lucide-react"
import { PositionSettingsPanel } from "./PositionSettingsPanel"
import { PercentileDistribution } from "./PercentileDistribution"
import { EditPipelineButton } from "./EditPipelineButton"
import { SmartNudges, type NudgeItem } from "./SmartNudges"
import { DeepAiDrawer } from "../../resumes/[id]/DeepAiDrawer"

// ── Status badge colour map ──────────────────────────────────────────────────
const STATUS_STYLES: Record<PositionStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
  OPEN: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  CLOSED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-500",
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
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canViewPositions) redirect("/org-admin/dashboard")

  const canManage = perms.canManagePositions; // false for Vendor
  const showPII = canSeePII(perms.roles);

  const { id } = await params

  const position = await prisma.position.findUnique({
    where: { id },
    include: {
      resumes: {
        where: { isDeleted: false },
        orderBy: { uploadedAt: "desc" },
        include: { invite: true }
      },
      batchRuns: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      vendorInvites: true,
      distributions: {
        orderBy: { boardName: "asc" },
      },
    },
  })

  // 404 if position doesn't exist, wrong org, or not in scoped departments
  if (!position || position.organizationId !== perms.orgId) notFound()
  if (perms.scopedDeptIds && position.departmentId && !perms.scopedDeptIds.includes(position.departmentId)) notFound()

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

  // Fetch interviews for the new InterviewsTab
  const interviews = await prisma.interview.findMany({
    where: { positionId: id },
    include: {
      candidate: { select: { name: true, email: true } },
      interviewer: { select: { name: true, email: true } },
    },
    orderBy: { scheduledAt: 'asc' }
  })

  // Fetch interview plan + pipeline interviews for pipeline bar
  const interviewPlan = await prisma.interviewPlan.findUnique({
    where: { positionId: id },
    include: { stages: { orderBy: { stageIndex: "asc" } } },
  })

  // Fetch pipeline-tracked interviews (rounds scheduled per resume)
  const pipelineInterviews = await prisma.interview.findMany({
    where: { positionId: id, resumeId: { not: null }, stageIndex: { not: null } },
    select: { id: true, resumeId: true, stageIndex: true, status: true, scheduledAt: true, roundLabel: true },
    orderBy: { stageIndex: "asc" },
  })

  // Fetch available interviewers for the scheduler modal
  const interviewerUsers = await prisma.user.findMany({
    where: {
      organizationId: position.organizationId,
      roles: { hasSome: ["B2B_INTERVIEWER", "HIRING_MANAGER", "RECRUITER", "ORG_ADMIN", "ADMIN"] }
    },
    select: {
      id: true, name: true, email: true,
      interviewerProfile: {
        select: {
          title: true, department: true, expertise: true, skillsJson: true,
          source: true, hourlyRate: true, totalInterviews: true,
          avgRating: true, isVerified: true, avatarUrl: true, linkedinUrl: true,
          // Privacy fields
          displayName: true, industryTier: true, seniorityLabel: true,
          yearsOfExperience: true, bioPublic: true, pastCompaniesJson: true,
          disclosureLevel: true, showLinkedin: true, showFullName: true, showAvatar: true,
        },
      },
    },
  })

  // Flatten to enriched interviewer objects with privacy applied
  const { resolveInterviewerProfile } = await import("@/lib/interviewer-privacy")
  const interviewers = interviewerUsers.map((u) => {
    const p = u.interviewerProfile;

    // For MARKETPLACE interviewers, apply privacy resolver
    if (p?.source === "MARKETPLACE") {
      const resolved = resolveInterviewerProfile({
        userId: u.id,
        name: u.name,
        email: u.email,
        title: p.title,
        department: p.department,
        expertise: p.expertise,
        bio: null,
        skillsJson: p.skillsJson,
        source: "MARKETPLACE",
        hourlyRate: p.hourlyRate,
        totalInterviews: p.totalInterviews,
        avgRating: p.avgRating,
        isVerified: p.isVerified,
        avatarUrl: p.avatarUrl,
        linkedinUrl: p.linkedinUrl,
        displayName: p.displayName,
        industryTier: p.industryTier,
        seniorityLabel: p.seniorityLabel,
        yearsOfExperience: p.yearsOfExperience,
        bioPublic: p.bioPublic,
        pastCompaniesJson: p.pastCompaniesJson,
        currentEmployer: null, // Never sent to client
        disclosureLevel: p.disclosureLevel,
        showLinkedin: p.showLinkedin,
        showFullName: p.showFullName,
        showAvatar: p.showAvatar,
      }, "CLIENT");

      return {
        id: u.id,
        name: resolved.displayName,
        email: resolved.email || "via IQMela",
        title: resolved.seniorityLabel ? `${resolved.seniorityLabel} · ${resolved.industryTier || "Marketplace"}` : resolved.title,
        skills: resolved.skills,
        expertise: p.expertise,
        source: "MARKETPLACE" as const,
        hourlyRate: resolved.hourlyRate,
        totalInterviews: resolved.totalInterviews,
        avgRating: resolved.avgRating,
        isVerified: resolved.isVerified,
        avatarUrl: resolved.avatarUrl,
        department: null, // Never expose department for marketplace
        linkedinUrl: resolved.linkedinUrl,
      };
    }

    // INTERNAL: full transparency
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      title: p?.title || null,
      skills: Array.isArray(p?.skillsJson) ? (p.skillsJson as string[]) : [],
      expertise: p?.expertise || null,
      source: (p?.source || "INTERNAL") as "INTERNAL" | "MARKETPLACE",
      hourlyRate: p?.hourlyRate ?? null,
      totalInterviews: p?.totalInterviews ?? 0,
      avgRating: p?.avgRating ?? null,
      isVerified: p?.isVerified ?? false,
      avatarUrl: p?.avatarUrl ?? null,
      department: p?.department ?? null,
      linkedinUrl: p?.linkedinUrl ?? null,
    };
  });

  // Parse JD required skills for AI matching
  const jdRequiredSkills: string[] = Array.isArray(position.jdRequiredSkillsJson)
    ? (position.jdRequiredSkillsJson as string[])
    : [];

  // Fetch dispatched vendor orgs for this position (org-level)
  const { getPositionVendorDispatches, getClientPastVendors } = await import("@/lib/vendor-provisioning")
  const vendorDispatches = await getPositionVendorDispatches(position.id, perms.orgId)
  const pastVendors = await getClientPastVendors(perms.orgId)

  return (
    <div className="flex flex-col gap-4 w-full">

      <div className="flex items-start gap-3 border-b border-gray-100 dark:border-zinc-800 pb-4 mt-2">
        {/* Position Info */}
        <div className="min-w-0 flex-1">
          <Link
            href="/org-admin/positions"
            className="text-sm text-rose-600 dark:text-rose-400 hover:underline mb-2 inline-block"
          >
            ← Back to Positions
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight whitespace-nowrap truncate">
              {position.title}
            </h1>
            {canManage && (
              <Link
                href={`/org-admin/positions/${position.id}/edit`}
                className="text-gray-400 hover:text-rose-600 transition-colors bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-1.5 shadow-sm"
                title="Edit Position"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </Link>
            )}
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
          {canManage && (
            <div className="mt-3 inline-flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <PublishToBoardsButton positionId={position.id} initialIsPublished={position.isPublished} />
                <DispatchVendorsModal
                  positionId={position.id}
                  positionTitle={position.title}
                  dispatches={vendorDispatches}
                  pastVendors={pastVendors}
                />
              </div>
              <EditPipelineButton 
                positionId={position.id} 
                existingStages={interviewPlan?.stages || []} 
                hasPlan={!!interviewPlan} 
                variant="header" 
              />
            </div>
          )}
        </div>

        {/* Upload Zone — beside position */}
        <div className="shrink-0">
          <ResumeUploadZone positionId={position.id} compact />
        </div>

        {/* Pipeline Gauge — beside upload */}
        {canManage && (() => {
          const total = position.resumes.length;
          const processed = position.resumes.filter(r => r.parsingStatus === "EXTRACTED" || r.parsingStatus === "RANKED").length;
          const ranked = position.resumes.filter(r => r.parsingStatus === "RANKED").length;
          const R = 42; const C = Math.PI * 2 * R;
          const pctP = total > 0 ? processed / total : 0;
          const pctR = total > 0 ? ranked / total : 0;
          return (
            <div className="shrink-0 flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-sm p-4 min-w-[230px]">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0 w-[100px] h-[100px]">
                  <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-100 dark:text-zinc-800" />
                    <circle cx="50" cy="50" r={R} fill="none" stroke="#14b8a6" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${C * pctP} ${C * (1 - pctP)}`}
                      className="transition-all duration-700 ease-out drop-shadow-[0_0_4px_rgba(20,184,166,0.4)]"
                    />
                    <circle cx="50" cy="50" r={R} fill="none" stroke="#6366f1" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={`${C * pctR} ${C * (1 - pctR)}`}
                      className="transition-all duration-700 ease-out drop-shadow-[0_0_4px_rgba(99,102,241,0.4)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-gray-900 dark:text-white leading-none">{total}</span>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Total</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-teal-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-zinc-300">Processed</span>
                    <span className="ml-auto text-sm font-black text-teal-700 dark:text-teal-300 tabular-nums">{processed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-indigo-500 shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-zinc-300">Ranked</span>
                    <span className="ml-auto text-sm font-black text-indigo-700 dark:text-indigo-300 tabular-nums">{ranked}</span>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-300 dark:bg-zinc-600 shrink-0" />
                    <span className="text-sm text-gray-400 dark:text-zinc-500">Pending</span>
                    <span className="ml-auto text-sm font-black text-gray-500 dark:text-zinc-400 tabular-nums">{total - processed}</span>
                  </div>
                </div>
              </div>
              <BulkProcessButton positionId={position.id} totalResumes={total} hasJd={!!position.jdText && position.jdText.trim() !== ""} pendingCount={total - processed} compact />
            </div>
          );
        })()}


      </div>

      <Tabs defaultValue="candidates" className="mt-2">
        <TabsList>
          <TabsTrigger value="candidates">Shortlisted ({position.resumes.filter(r => r.isShortlisted).length})</TabsTrigger>
          <TabsTrigger value="all-candidates">All Candidates ({position.resumes.length})</TabsTrigger>
          {canManage && <TabsTrigger value="distribution">Distribution</TabsTrigger>}
          {canManage && <TabsTrigger value="interviews">Interviews ({interviews.length})</TabsTrigger>}
          {canManage && <TabsTrigger value="intake">Intake Queue</TabsTrigger>}
          {canManage && <TabsTrigger value="config">Settings</TabsTrigger>}
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* ── Distribution Tab ───────────────────────────────────────── */}
        <TabsContent value="distribution" className="space-y-6">
          <DistributionPanel
            positionId={position.id}
            isPublished={position.isPublished}
            channels={position.distributions.map(d => ({
              id: d.id,
              boardName: d.boardName,
              status: d.status,
              publishedAt: d.publishedAt?.toISOString() || null,
              viewCount: d.viewCount,
              clickCount: d.clickCount,
              applicationCount: d.applicationCount,
            }))}
          />
        </TabsContent>

        {/* ── Intake Queue Tab ──────────────────────────────────────── */}
        <TabsContent value="intake" className="space-y-6">
          <IntakeQueuePanel
            positionId={position.id}
            intakeTopN={position.intakeTopN}
            intakeAutoPromote={position.intakeAutoPromote}
            showPII={showPII}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Job Description — inline display */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📄 Job Description</h3>
              {position.description && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Short Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{position.description}</p>
                </div>
              )}
              {position.jdText ? (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Full Job Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{position.jdText}</p>
                  {!!position.jdKeywordsJson && (
                    <div className="mt-6 flex flex-col gap-4">
                      {Array.isArray(position.jdRequiredSkillsJson) && (position.jdRequiredSkillsJson as string[]).length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Required Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {(position.jdRequiredSkillsJson as string[]).map(s => (
                              <span key={s} className="px-2 py-1 rounded-md text-xs font-semibold bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border border-pink-100 dark:border-pink-800/30">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(position.jdKeywordsJson) && (position.jdKeywordsJson as string[]).length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Core Keywords</h4>
                          <div className="flex flex-wrap gap-2">
                            {(position.jdKeywordsJson as string[]).map(k => (
                              <span key={k} className="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-zinc-400">No job description added yet. Edit this position to add one.</p>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Pipeline Activity Logs</h3>
              {position.batchRuns && position.batchRuns.length > 0 ? (
                <BatchActivityPanel batchRuns={position.batchRuns} inline />
              ) : (
                <p className="text-sm text-gray-500 dark:text-zinc-400">No AI pipeline runs executed yet.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interviews" className="space-y-6">
          <InterviewsTab
            positionId={position.id}
            interviews={interviews as any}
            resumes={position.resumes.filter(r => r.isShortlisted)}
            interviewers={interviewers}
            showPII={showPII}
          />
        </TabsContent>

        <TabsContent value="all-candidates" className="space-y-4">
          <AllCandidatesTab
            resumes={
              // C-1: Vendor data isolation — vendors see only their own uploads
              (perms.isVendor && !canManage
                ? position.resumes.filter((r: any) => r.vendorOrgId === perms.orgId)
                : position.resumes
              ) as any
            }
            canManage={canManage}
            showPII={showPII}
          />
        </TabsContent>

        <TabsContent value="candidates" className="space-y-6">
          {/* ── Percentile Distribution ──────────────────────────────── */}
          <PercentileDistribution
            candidates={position.resumes
              .filter((r) => r.matchScore !== null)
              .map((r) => ({
                id: r.id,
                name: r.candidateName || 'Candidate',
                score: r.matchScore as number
              }))}
          />
          {/* ── Smart Nudges ── contextual action reminders ────────────── */}
          {(() => {
            const nudges: NudgeItem[] = [];
            const hasJd = !!position.jdText && position.jdText.trim() !== "";
            const unscoredCount = position.resumes.filter(r => r.matchScore === null && r.parsingStatus !== "RANKED").length;
            const shortlisted = position.resumes.filter(r => r.isShortlisted);
            const scheduledCount = interviews.filter(i => i.status === "SCHEDULED").length;

            // 1. No JD — blocks everything
            if (position.resumes.length > 0 && !hasJd) {
              nudges.push({
                id: "no-jd",
                title: `${position.resumes.length} resume${position.resumes.length !== 1 ? "s" : ""} uploaded but no Job Description`,
                subtitle: "AI pipeline needs a JD to rank and match candidates",
                accentFrom: "amber", accentTo: "orange",
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>,
                action: { type: "link", href: `/org-admin/positions/${position.id}/edit` },
                actionLabel: "Add Job Description",
              });
            }

            // 2. Run AI Pipeline — resumes uploaded, unscored
            if (unscoredCount > 0 && hasJd) {
              nudges.push({
                id: "run-pipeline",
                title: `${unscoredCount} resume${unscoredCount !== 1 ? "s" : ""} awaiting AI scoring`,
                subtitle: "Run the AI pipeline to extract, rank & match candidates",
                accentFrom: "rose", accentTo: "pink",
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
                action: { type: "run-pipeline", positionId: position.id },
                actionLabel: "Run AI Pipeline",
                badge: unscoredCount,
              });
            }

            // 3. Position in Draft
            if (position.status === "DRAFT") {
              nudges.push({
                id: "draft-position",
                title: "This position is still in Draft",
                subtitle: "Candidates can't discover or apply until you publish it",
                accentFrom: "amber", accentTo: "orange",
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
                action: { type: "link", href: `/org-admin/positions/${position.id}/edit` },
                actionLabel: "Publish Position",
              });
            }

            // 4. No Interview Pipeline
            if (!interviewPlan) {
              nudges.push({
                id: "no-pipeline",
                title: "No interview pipeline configured",
                subtitle: "Set up interview rounds to track candidate progress",
                accentFrom: "indigo", accentTo: "violet",
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>,
                action: { type: "link", href: `/org-admin/positions/${position.id}/edit` },
                actionLabel: "Create Pipeline",
              });
            }

            // 5. Shortlisted but no interviews scheduled
            if (shortlisted.length > 0 && scheduledCount === 0 && interviewPlan) {
              nudges.push({
                id: "no-interviews",
                title: `${shortlisted.length} shortlisted candidate${shortlisted.length !== 1 ? "s" : ""} — no interviews scheduled`,
                subtitle: "Schedule interviews or send AI interview invitations",
                accentFrom: "blue", accentTo: "cyan",
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
                action: { type: "link", href: `/org-admin/positions/${position.id}` },
                actionLabel: "Schedule Interviews",
              });
            }

            return nudges.length > 0 ? <SmartNudges nudges={nudges} /> : null;
          })()}

          {/* ── Upload + Resumes Table ────────────────────────────────── */}
          <Card className="border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="px-4 pt-1.5 pb-2">
              <TopCandidatesComparison resumes={position.resumes} />
            </div>
            <CardContent className="pt-0 pb-6 flex flex-col gap-6">
              {position.resumes.length > 0 ? (
                (() => {
                  const tableContent = (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
                      <table className="w-full text-sm text-left">
                        <thead className="text-sm text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
                          <tr>
                            {canManage && (
                              <th className="px-2 py-3 font-semibold text-center w-10">
                                <SelectAllCheckbox />
                              </th>
                            )}
                            <th className="px-2 py-3 font-semibold text-center w-14">Rank</th>
                            <th className="px-3 py-3 font-semibold">Candidate</th>
                            <th className="px-3 py-3 font-semibold">Match</th>
                            <th className="px-3 py-3 font-semibold">
                              <div className="flex items-center gap-2">
                                Pipeline
                                <EditPipelineButton
                                  positionId={position.id}
                                  existingStages={interviewPlan?.stages ?? []}
                                  hasPlan={!!interviewPlan}
                                />
                              </div>
                            </th>
                            <th className="px-2 py-3 text-right pr-5">Actions</th>
                          </tr>
                        </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {position.resumes.map((resume, index) => {
                          const skills = Array.isArray(resume.skillsJson) ? (resume.skillsJson as string[]) : []
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
                                className={`group relative transition-colors cursor-pointer ${isFailed
                                    ? "bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50/70"
                                    : resume.isShortlisted
                                      ? "bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50/70 dark:hover:bg-amber-900/20"
                                      : "bg-white dark:bg-zinc-900/10 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                                  }`}
                              >
                                {canManage && (
                                  <td className="px-2 py-3 text-center vertical-align-middle">
                                    {resume.isShortlisted ? (
                                      <input
                                        type="checkbox"
                                        name="resumeIds"
                                        value={resume.id}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-rose-600 focus:ring-rose-600 dark:bg-zinc-800 cursor-pointer shadow-sm relative z-10"
                                      />
                                    ) : null}
                                  </td>
                                )}
                                <td className="px-2 py-3 text-center">
                                  {resume.matchScore !== null ? (
                                    <Link href={`/org-admin/resumes/${resume.id}`} className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 font-extrabold text-xs hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors relative z-10" title="View candidate details">
                                      #{index + 1}
                                    </Link>
                                  ) : (
                                    <span className="text-gray-300 dark:text-zinc-600 font-bold">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <DeepAiDrawer 
                                      resume={resume} 
                                      userRoles={perms.roles ?? []}
                                      compactMode={true}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Link href={`/org-admin/resumes/${resume.id}`} className="font-extrabold text-sm text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300 group-hover:underline underline-offset-4 decoration-rose-300 dark:decoration-rose-600 truncate max-w-[200px] min-w-0 shrink transition-all duration-200 after:absolute after:inset-0" title={hasNameOverride ? `Original AI Value: ${resume.candidateName || "none"}` : undefined}>
                                            {finalName}
                                            {hasNameOverride && <span className="text-rose-500 ml-1" title="Overridden by recruiter">*</span>}
                                          </Link>
                                          {resume.isDuplicate && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30 px-1.5 py-0.5 border border-red-200 dark:border-red-900/50 rounded shadow-sm shrink-0 whitespace-nowrap" title="Another vendor or recruiter already submitted this candidate">
                                              ⚠️ DUPLICATE
                                            </span>
                                          )}
                                          {canManage && (
                                            <OverrideCandidateAction
                                              resumeId={resume.id}
                                              aiName={resume.candidateName} aiEmail={resume.candidateEmail} aiPhone={resume.phoneNumber} aiLinkedin={resume.linkedinUrl}
                                              overrideName={resume.overrideName} overrideEmail={resume.overrideEmail} overridePhone={resume.overridePhone} overrideLinkedin={resume.overrideLinkedinUrl}
                                            />
                                          )}
                                          {warnings.length > 0 && (
                                            <span
                                              title={`${warnings.length} validation warning(s) — click resume for details`}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 cursor-help"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                                              {warnings.length}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {showPII && finalEmail ? (
                                            <a href={`mailto:${finalEmail}`} className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 hover:underline truncate max-w-[200px] relative z-10" title={hasEmailOverride ? `Original: ${resume.candidateEmail || "none"}` : finalEmail}>
                                              {finalEmail}
                                              {hasEmailOverride && <span className="text-rose-500 ml-0.5">*</span>}
                                            </a>
                                          ) : !showPII ? (
                                            <span className="text-xs text-gray-300 dark:text-zinc-600 italic">PII hidden</span>
                                          ) : (
                                            <span className="text-xs text-gray-400 dark:text-zinc-500 italic">No email</span>
                                          )}

                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                          {/* ── Source Badge ─────────────────────── */}
                                          {resume.candidateSource && resume.candidateSource !== "MANUAL_UPLOAD" && (
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${resume.candidateSource === "INDEED" ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30" :
                                                resume.candidateSource === "GOOGLE_JOBS" ? "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-900/30" :
                                                  resume.candidateSource === "IQMELA_DIRECT" ? "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-900/30" :
                                                    "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800"
                                              }`}>
                                              {resume.candidateSource === "INDEED" && "🔵 Indeed"}
                                              {resume.candidateSource === "GOOGLE_JOBS" && "🔴 Google Jobs"}
                                              {resume.candidateSource === "IQMELA_DIRECT" && "✦ IQMela"}
                                              {!["INDEED", "GOOGLE_JOBS", "IQMELA_DIRECT"].includes(resume.candidateSource) && `📌 ${resume.candidateSource}`}
                                            </span>
                                          )}
                                          {resume.vendorOrgId && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-800/50">
                                              Vendor
                                            </span>
                                          )}

                                          {inviteStatus && (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-900/30 dark:border-rose-800/40 dark:text-rose-400">
                                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2z" /></svg>
                                              INV {inviteStatus}
                                            </span>
                                          )}

                                        </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  {resume.matchScore !== null ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`inline-flex items-center gap-1 font-bold text-sm ${resume.matchScore >= 80 ? 'text-rose-600 dark:text-rose-400' :
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

                                <td className="px-3 py-3 relative z-10">
                                  {(() => {
                                    // Build pipeline stage states for this resume
                                    if (!interviewPlan || interviewPlan.stages.length === 0) {
                                      // No plan: show simple AI session status like before
                                      const session = aiSessions.find(s => s.resumeId === resume.id)
                                      if (!session) return <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                                      if (session.status === "COMPLETED") {
                                        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">AI ✓</span>
                                      }
                                      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">AI ◌</span>
                                    }

                                    // Compute stage states
                                    const stageStates: StageState[] = interviewPlan.stages.map((stage, idx) => {
                                      const pStage: PipelineStage = {
                                        stageIndex: stage.stageIndex,
                                        roundLabel: stage.roundLabel,
                                        roundType: stage.roundType,
                                        durationMinutes: stage.durationMinutes,
                                        interviewMode: stage.interviewMode,
                                      }

                                      // Stage 0 (AI_SCREEN): check AiInterviewSession
                                      if (stage.roundType === "AI_SCREEN") {
                                        const aiSession = aiSessions.find(s => s.resumeId === resume.id)
                                        if (aiSession?.status === "COMPLETED") return { stage: pStage, status: "COMPLETED" as const }
                                        if (aiSession || (idx === 0 && inviteStatus === "SENT")) return { stage: pStage, status: "SCHEDULED" as const }
                                        return { stage: pStage, status: "AVAILABLE" as const }
                                      }

                                      // Other stages: check Interview records
                                      const interview = pipelineInterviews.find(
                                        (iv) => iv.resumeId === resume.id && iv.stageIndex === stage.stageIndex
                                      )

                                      if (interview?.status === "COMPLETED") return { stage: pStage, status: "COMPLETED" as const, interviewId: interview.id }
                                      if (interview?.status === "SCHEDULED") return { stage: pStage, status: "SCHEDULED" as const, interviewId: interview.id, scheduledAt: interview.scheduledAt?.toISOString() }
                                      if (interview?.status === "CANCELED") return { stage: pStage, status: "SKIPPED" as const }

                                      // If it's the first stage (human round) and an invite was sent, show it as scheduled
                                      if (idx === 0 && inviteStatus === "SENT") return { stage: pStage, status: "SCHEDULED" as const }



                                      // All unscheduled rounds are available — no gating
                                      return { stage: pStage, status: "AVAILABLE" as const }
                                    })

                                    // Parse top skills
                                    const topSkills: string[] = []
                                    try {
                                      const matched = resume.matchedSkillsJson as any[]
                                      if (Array.isArray(matched)) topSkills.push(...matched.slice(0, 5).map(s => typeof s === 'string' ? s : s.skill || s.name || ''))
                                    } catch { }

                                    const candidateSkills: string[] = []
                                    try {
                                      const skills = resume.skillsJson as any[]
                                      if (Array.isArray(skills)) candidateSkills.push(...skills.slice(0, 15).map((s: any) => typeof s === 'string' ? s : s.skill || s.name || ''))
                                    } catch { }

                                    return (
                                      <PipelineWrapper
                                        stages={stageStates}
                                        resumeId={resume.id}
                                        positionId={position.id}
                                        candidateName={finalName}
                                        matchScore={resume.matchScore}
                                        topSkills={topSkills}
                                        interviewers={interviewers}
                                        jdRequiredSkills={jdRequiredSkills}
                                        candidateSkills={candidateSkills}
                                        pipelineStatus={(resume as any).pipelineStatus as string}
                                      />
                                    )
                                  })()}
                                </td>
                                <td className="px-2 py-3 text-right relative z-10">
                                  <div className="flex items-center justify-end gap-2 text-right relative z-10">
                                    {canManage && <ShortlistAction resumeId={resume.id} isShortlisted={resume.isShortlisted} initialNotes={resume.recruiterNotes} />}
                                    {canManage && <DeleteResumeButton resumeId={resume.id} candidateName={finalName} />}

                                    <a href={`/api/org-admin/resumes/download?resumeId=${resume.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all border border-transparent hover:border-rose-200 dark:hover:border-rose-800" title="View Original Resume">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                                      </svg>
                                    </a>
                                    
                                    <Link 
                                      href={`/org-admin/resumes/${resume.id}`} 
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all border border-transparent cursor-pointer" 
                                      title="Go to candidate profile"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                              {hasAnalysis && (
                                <tr className="border-x border-b border-gray-100 dark:border-zinc-800 bg-gray-50/20 dark:bg-zinc-900/20">
                                  <td colSpan={8} className="p-0">
                                    <details className="group">
                                      <summary className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer p-2 flex items-center justify-center gap-1 transition-colors select-none">
                                        <span>Expand Deep AI Intelligence</span>
                                        <svg className="w-3 h-3 opacity-60 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
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
                );
                  return canManage ? (
                    <BulkInviteForm positionId={position.id}>{tableContent}</BulkInviteForm>
                  ) : tableContent;
                })()
              ) : (
                <div className="mx-6 py-8">
                  <ResumeUploadZone positionId={position.id} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="config" className="space-y-8">
          <PositionSettingsPanel
            positionId={position.id}
            initial={{
              intakeWindowDays: position.intakeWindowDays ?? 10,
              atsPreScreenSize: position.atsPreScreenSize ?? 100,
              aiShortlistSize: position.aiShortlistSize ?? 10,
              autoProcessOnClose: position.autoProcessOnClose ?? true,
              autoInviteAiScreen: position.autoInviteAiScreen ?? false,
              resumePurgeDays: position.resumePurgeDays ?? 90,
            }}
          />
          <AiInterviewConfigPanel positionId={position.id} initial={aiInterviewConfig} />
          <AiQuestionBankPanel positionId={position.id} questions={questionBank} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
