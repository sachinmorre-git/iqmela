import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default function InterviewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ── Role Guard ──────────────────────────────────────────────────────────
  // Always verify the user's ACTUAL role from the DB — the only source of truth
  // that cannot be stale, cached, or spoofed by a lingering cookie/JWT.
  const { userId } = await auth()
  if (!userId) redirect('/select-role')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) redirect('/select-role')

  if (user.role !== 'INTERVIEWER') {
    // Sync the cookie to match and kick them to the correct dashboard
    const cookieStore = await cookies()
    const roleMap: Record<string, string> = { ADMIN: 'org-admin', CANDIDATE: 'candidate', INTERVIEWER: 'interviewer' }
    const correctSegment = roleMap[user.role] ?? 'select-role'
    cookieStore.set('user_role', correctSegment, { path: '/' })
    redirect(`/${correctSegment}/dashboard`)
  }
  // ── End Role Guard ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row min-h-[85vh] w-full max-w-7xl mx-auto rounded-[2rem] overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-purple-500/5 mt-6 mb-16">
      {/* Sidebar */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/20 p-6 flex flex-col gap-8">
        <div className="px-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Interviewer Portal</h2>
          </div>
          
          <nav className="flex flex-col gap-2.5">
            <Link href="/interviewer/dashboard" className="px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold transition-colors flex items-center gap-3 shadow-sm border border-purple-100 dark:border-purple-800/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              Overview
            </Link>
            <Link href="/interviewer/candidates" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              Candidates
            </Link>
            <Link href="#" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Assessments
            </Link>
            <Link href="#" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Question Bank
            </Link>
            <Link href="/interviewer/profile" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              My Profile
            </Link>
          </nav>
        </div>
        <div className="mt-auto px-2">
          <nav className="flex flex-col gap-2">
            <Link href="#" className="px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 flex flex-col bg-white dark:bg-zinc-950 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
