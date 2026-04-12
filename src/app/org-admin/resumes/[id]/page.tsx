import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ExtractTextButton } from "./ExtractTextButton"
import { RunAiExtractionButton } from "./RunAiExtractionButton"
import { RawAiOutputDebug } from "./RawAiOutputDebug"

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
      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400"
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
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const resume = await prisma.resume.findUnique({
    where: { id },
    include: { position: true },
  })

  if (!resume || resume.position.createdById !== userId) notFound()

  const skills        = Array.isArray(resume.skillsJson)          ? (resume.skillsJson as string[]) : []
  const companies     = Array.isArray(resume.companiesJson)        ? (resume.companiesJson as Array<{ company: string; role: string; duration?: string | null }>) : []
  const education     = Array.isArray(resume.educationJson)        ? (resume.educationJson as Array<{ degree: string; institution: string; year?: string | null }>) : []
  const warnings      = Array.isArray(resume.validationWarningsJson) ? (resume.validationWarningsJson as string[]) : []
  const hasAiData     = !!(resume.candidateName || resume.candidateEmail || skills.length)

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <Link
            href={`/org-admin/positions/${resume.positionId}`}
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline mb-2 inline-block"
          >
            ← Back to Position ({resume.position.title})
          </Link>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {resume.originalFileName}
            </h1>
            <StatusBadge status={resume.parsingStatus} />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            Uploaded {resume.uploadedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {resume.fileSize < 1024 * 1024
              ? `${(resume.fileSize / 1024).toFixed(1)} KB`
              : `${(resume.fileSize / (1024 * 1024)).toFixed(1)} MB`}
            {resume.mimeType && <span className="ml-2 uppercase text-xs font-mono opacity-50">{resume.mimeType.split("/")[1]}</span>}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <RunAiExtractionButton
            resumeId={resume.id}
            disabled={!resume.extractedText || resume.parsingStatus === "EXTRACTING"}
          />
          <Button variant="outline" className="shrink-0 rounded-xl hover:-translate-y-0.5 transition-transform">
            <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Download
          </Button>
        </div>
      </div>

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
              <InfoRow label="Email">
                {resume.candidateEmail
                  ? <a href={`mailto:${resume.candidateEmail}`} className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline break-all">{resume.candidateEmail}</a>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
              <InfoRow label="Phone">
                {resume.phoneNumber
                  ? <p className="text-sm font-medium text-gray-900 dark:text-white">{resume.phoneNumber}</p>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
              <InfoRow label="Location">
                {resume.location
                  ? <p className="text-sm font-medium text-gray-900 dark:text-white">{resume.location}</p>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
              <InfoRow label="LinkedIn">
                {resume.linkedinUrl
                  ? <a href={resume.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline break-all">{resume.linkedinUrl}</a>
                  : <p className="text-sm italic text-gray-400 dark:text-zinc-500">—</p>}
              </InfoRow>
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
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
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
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-indigo-500 mb-2">
                  {resume.matchScore != null ? `${resume.matchScore} / 100` : "— / 100"}
                </span>
                {resume.matchLabel
                  ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{resume.matchLabel}</span>
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
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-100 dark:border-violet-800/40"
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
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
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
                      ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-100 dark:border-violet-800/40 capitalize">{resume.extractionProvider}</span>
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

    </div>
  )
}
