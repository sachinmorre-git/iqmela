import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/locale-utils"
import { notFound, redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import Link from "next/link"
import { ResumeUploadZone } from "@/app/org-admin/positions/[id]/ResumeUploadZone"
import { ArrowLeft, FileText, Building2, MapPin, Clock } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ positionId: string }>
}) {
  const { positionId } = await params
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { title: true },
  })
  return {
    title: position
      ? `${position.title} | Vendor Portal`
      : "Position Detail | Vendor Portal",
  }
}

// ── Stage pipeline ───────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  "SUBMITTED",
  "SCREENING",
  "ROUND_1",
  "ROUND_2",
  "ROUND_3",
  "ROUND_4",
  "ROUND_5",
  "OFFERED",
  "HIRED",
] as const

const STAGE_LABELS: Record<string, string> = {
  SUBMITTED: "Sent",
  SCREENING: "Screen",
  ROUND_1: "R1",
  ROUND_2: "R2",
  ROUND_3: "R3",
  ROUND_4: "R4",
  ROUND_5: "R5",
  OFFERED: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
}

function StageTracker({ currentStage }: { currentStage: string | null }) {
  if (!currentStage) return null

  if (currentStage === "REJECTED") {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          ✕ Rejected
        </span>
      </div>
    )
  }

  const currentIdx = PIPELINE_STAGES.indexOf(currentStage as typeof PIPELINE_STAGES[number])

  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STAGES.map((stage, idx) => {
        const isPast = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture = idx > currentIdx

        return (
          <div key={stage} className="flex items-center gap-0.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                isPast
                  ? "bg-emerald-500 text-white"
                  : isCurrent
                  ? "bg-rose-600 text-white ring-2 ring-rose-300 dark:ring-rose-800 shadow-sm"
                  : "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-600"
              }`}
              title={STAGE_LABELS[stage]}
            >
              {isPast ? "✓" : STAGE_LABELS[stage]}
            </div>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div
                className={`w-2 h-0.5 ${
                  isPast ? "bg-emerald-500" : "bg-gray-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function VendorPositionDetailPage({
  params,
}: {
  params: Promise<{ positionId: string }>
}) {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")

  const { positionId } = await params
  const orgId = perms.orgId

  // Verify this position is dispatched to our vendor org
  const dispatch = await prisma.positionVendor.findFirst({
    where: {
      positionId,
      vendorOrgId: orgId,
      status: "ACTIVE",
    },
    include: {
      position: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          employmentType: true,
          jdText: true,
          description: true,
          status: true,
          organizationId: true,
        },
      },
    },
  })

  if (!dispatch) notFound()

  const { position } = dispatch

  // Get client org name
  const clientOrg = position.organizationId
    ? await prisma.organization.findUnique({
        where: { id: position.organizationId },
        select: { name: true },
      })
    : null

  // Fetch resumes submitted by this vendor org for this position
  const resumes = await prisma.resume.findMany({
    where: {
      positionId,
      vendorOrgId: orgId,
    },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      originalFileName: true,
      vendorStage: true,
      vendorStageUpdatedAt: true,
      vendorStageNotes: true,
      uploadedAt: true,
      isDuplicate: true,
    },
  })

  // Stage stats
  const stageStats = new Map<string, number>()
  for (const r of resumes) {
    const s = r.vendorStage || "SUBMITTED"
    stageStats.set(s, (stageStats.get(s) || 0) + 1)
  }

  return (
    <div className="flex-1 space-y-6 max-w-5xl mx-auto p-4 md:p-8 w-full">
      {/* Back Link */}
      <Link
        href="/org-admin/vendor-portal"
        className="text-sm font-medium text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 flex items-center transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Vendor Portal
      </Link>

      {/* Position Header */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 lg:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            {clientOrg && (
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">
                  {clientOrg.name}
                </span>
              </div>
            )}
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              {position.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
              {position.department && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {position.department}
                </span>
              )}
              {position.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {position.location}
                </span>
              )}
              {position.employmentType && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {position.employmentType.replace("_", " ")}
                </span>
              )}
            </div>
          </div>

          {/* Resume Count */}
          <div className="hidden sm:flex flex-col items-end gap-1 text-right shrink-0">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-400 leading-none">
              {resumes.length}
            </span>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              submitted
            </span>
          </div>
        </div>

        {/* JD Expandable */}
        {(position.description || position.jdText) && (
          <details className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <summary className="text-sm font-semibold text-rose-600 dark:text-rose-400 cursor-pointer hover:underline">
              View Job Description
            </summary>
            <div className="mt-3 text-sm text-gray-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {position.jdText || position.description}
            </div>
          </details>
        )}
      </div>

      {/* Stage Summary Bar */}
      {resumes.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {Array.from(stageStats.entries()).map(([stage, count]) => (
            <span
              key={stage}
              className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold ${
                stage === "REJECTED"
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                  : stage === "HIRED"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : stage === "OFFERED"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {STAGE_LABELS[stage] || stage}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Upload Zone */}
      {position.status === "OPEN" && (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            Upload Candidates
          </h3>
          <div className="max-w-lg">
            <ResumeUploadZone positionId={position.id} uploadEndpoint="/api/vendor/resumes/upload" />
          </div>
        </div>
      )}

      {/* Submitted Resumes Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            My Submissions ({resumes.length})
          </h3>
        </div>

        {resumes.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-zinc-500">
            No resumes submitted yet. Upload candidates above to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors"
              >
                {/* Candidate Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {resume.candidateName || resume.originalFileName}
                    </p>
                    {resume.isDuplicate && (
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50">
                        Duplicate
                      </span>
                    )}
                  </div>
                  {resume.candidateEmail && (
                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                      {resume.candidateEmail}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">
                    Uploaded {formatDate(resume.uploadedAt)}
                  </p>
                </div>

                {/* Stage Notes */}
                {resume.vendorStageNotes && (
                  <div className="hidden lg:block max-w-[200px]">
                    <p className="text-[10px] text-gray-400 dark:text-zinc-600 italic truncate" title={resume.vendorStageNotes}>
                      &ldquo;{resume.vendorStageNotes}&rdquo;
                    </p>
                  </div>
                )}

                {/* Pipeline Tracker */}
                <div className="shrink-0">
                  <StageTracker currentStage={resume.vendorStage} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
