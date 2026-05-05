"use client"

import { useState, useMemo } from "react"
import { Search, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/locale-utils"
import { ShortlistAction } from "./ShortlistAction"
import { DeepAiDrawer } from "../../resumes/[id]/DeepAiDrawer"

interface ResumeRow {
  id: string
  candidateName: string | null
  overrideName: string | null
  candidateEmail: string | null
  overrideEmail: string | null
  originalFileName: string
  isShortlisted: boolean
  recruiterNotes: string | null
  parsingStatus: string
  createdAt: Date
  source: string | null
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const

export function AllCandidatesTab({
  resumes,
  canManage,
  showPII = true,
}: {
  resumes: ResumeRow[]
  canManage: boolean
  showPII?: boolean
}) {
  const [query, setQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(50)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const list = resumes.filter((r) => {
      if (!q) return true
      const name = (r.overrideName || r.candidateName || r.originalFileName).toLowerCase()
      const email = (r.overrideEmail || r.candidateEmail || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    // Sort: shortlisted first, then by date descending
    return list.sort((a, b) => {
      if (a.isShortlisted !== b.isShortlisted) return a.isShortlisted ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [resumes, query])

  // Reset to page 1 when search changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedResumes = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const shortlistedCount = resumes.filter((r) => r.isShortlisted).length

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleSearchChange = (val: string) => {
    setQuery(val)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-4">
      {/* ── Total Resumes Received Banner ──────────────────────────── */}
      <div className="flex items-center gap-6 p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-pink-50/50 to-white dark:from-rose-900/20 dark:via-pink-900/10 dark:to-zinc-900 border border-rose-100 dark:border-rose-800/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600 dark:text-rose-400">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              <path d="M10 12h4"/>
              <path d="M10 16h4"/>
              <path d="M10 8h1"/>
            </svg>
          </div>
          <div>
            <p className="text-2xl font-black text-rose-700 dark:text-rose-300 tabular-nums leading-none">
              {resumes.length.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-rose-500/70 dark:text-rose-400/60 uppercase tracking-wider mt-0.5">
              Total Resumes Received
            </p>
          </div>
        </div>

        <div className="w-px h-10 bg-rose-200/50 dark:bg-rose-800/30" />

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums leading-none">{shortlistedCount.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-amber-500/60 dark:text-amber-400/50 uppercase tracking-wider mt-0.5">Shortlisted</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{resumes.filter(r => r.parsingStatus === "RANKED" || r.parsingStatus === "EXTRACTED").length.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-emerald-500/60 dark:text-emerald-400/50 uppercase tracking-wider mt-0.5">Processed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-gray-500 dark:text-zinc-400 tabular-nums leading-none">{resumes.filter(r => r.parsingStatus === "PENDING" || r.parsingStatus === "UPLOADED").length.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-gray-400/60 dark:text-zinc-500/60 uppercase tracking-wider mt-0.5">Pending</p>
          </div>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={showPII ? "Search by name or email..." : "Search by name..."}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Counts + Page Size */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400 shrink-0">
          <span>
            Showing <span className="font-bold text-gray-700 dark:text-zinc-200">{((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filtered.length)}</span> of{" "}
            <span className="font-bold text-gray-700 dark:text-zinc-200">{filtered.length.toLocaleString()}</span>
          </span>
          <span className="w-px h-4 bg-gray-200 dark:bg-zinc-700" />
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 font-semibold text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
            <tr>
              <th className="px-5 py-3 font-semibold">Candidate</th>
              {showPII && <th className="px-5 py-3 font-semibold">Email</th>}
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Applied</th>
              <th className="px-4 py-3 font-semibold">AI Status</th>
              <th className="px-4 py-3 font-semibold text-right pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {paginatedResumes.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-5 py-10 text-center text-gray-400 dark:text-zinc-500">
                  {query ? (
                    <div className="flex flex-col items-center gap-1">
                      <Search className="w-5 h-5 opacity-40" />
                      <span className="text-sm">No candidates match &ldquo;{query}&rdquo;</span>
                    </div>
                  ) : (
                    <span className="text-sm">No candidates uploaded yet</span>
                  )}
                </td>
              </tr>
            ) : (
              paginatedResumes.map((resume) => {
                const name = resume.overrideName || resume.candidateName || resume.originalFileName
                const email = resume.overrideEmail || resume.candidateEmail

                return (
                  <tr
                    key={resume.id}
                    className={`transition-colors relative cursor-pointer ${
                      resume.isShortlisted
                        ? "bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50/70 dark:hover:bg-amber-900/20"
                        : "bg-white dark:bg-zinc-900/10 hover:bg-gray-50 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {resume.isShortlisted && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-amber-500 shrink-0"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        )}
                        <Link
                          href={`/org-admin/resumes/${resume.id}`}
                          className="font-extrabold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline underline-offset-4 decoration-rose-300 dark:decoration-rose-600 truncate max-w-[200px] transition-all duration-200 after:absolute after:inset-0"
                          title="View candidate details"
                        >
                          {name}
                        </Link>
                        <div className="relative z-10">
                          <DeepAiDrawer 
                            resume={resume} 
                            userRoles={canManage ? ["ORG_ADMIN"] : []}
                            compactMode={true}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Email — only visible if showPII */}
                    {showPII && (
                      <td className="px-5 py-3 text-gray-500 dark:text-zinc-400 truncate max-w-[200px]">
                        {email || <span className="text-gray-300 dark:text-zinc-600">—</span>}
                      </td>
                    )}

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 dark:text-zinc-500 capitalize">
                        {resume.source?.toLowerCase().replace(/_/g, " ") || "Upload"}
                      </span>
                    </td>

                    {/* Applied Date */}
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-zinc-500 tabular-nums whitespace-nowrap">
                      {formatDate(new Date(resume.createdAt))}
                    </td>

                    {/* AI Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          resume.parsingStatus === "EXTRACTED" || resume.parsingStatus === "RANKED"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                            : resume.parsingStatus === "EXTRACTING" || resume.parsingStatus === "RANKING"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                              : resume.parsingStatus === "QUEUED_FOR_AI"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                                : resume.parsingStatus === "FAILED"
                                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {resume.parsingStatus.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 text-right relative z-10">
                        {canManage && (
                          <ShortlistAction
                            resumeId={resume.id}
                            isShortlisted={resume.isShortlisted}
                            initialNotes={resume.recruiterNotes}
                          />
                        )}
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
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Controls ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Page <span className="font-bold text-gray-600 dark:text-zinc-300">{safePage}</span> of <span className="font-bold text-gray-600 dark:text-zinc-300">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={safePage === 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number buttons — show up to 7 pages */}
            {(() => {
              const pages: number[] = []
              let start = Math.max(1, safePage - 3)
              let end = Math.min(totalPages, safePage + 3)
              if (end - start < 6) {
                if (start === 1) end = Math.min(totalPages, start + 6)
                else start = Math.max(1, end - 6)
              }
              for (let i = start; i <= end; i++) pages.push(i)
              return pages.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    p === safePage
                      ? "bg-rose-600 text-white shadow-sm shadow-rose-500/30"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
                  }`}
                >
                  {p}
                </button>
              ))
            })()}

            <button
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={safePage === totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
