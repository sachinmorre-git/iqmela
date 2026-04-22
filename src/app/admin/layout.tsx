import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function GlobalAdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth()
  
  if (!userId) redirect('/sign-in')

  const publicMeta = sessionClaims?.publicMetadata as Record<string, any>;
  const sysRole = publicMeta?.sysRole?.toString()

  if (!sysRole?.startsWith('sys:')) {
    redirect('/select-role')
  }

  // IQMela Global RBAC Array
  const isSuperAdmin = sysRole === 'sys:superadmin'
  const isFinance = sysRole === 'sys:finance'
  const isSupport = sysRole === 'sys:support'
  const isDeveloper = sysRole === 'sys:qa' || sysRole === 'sys:developer'

  // Module Logic
  const canSeeDashboard = isSuperAdmin || isFinance || isDeveloper
  const canSeeFinance = isSuperAdmin || isFinance
  const canSeeSupport = isSuperAdmin || isSupport
  const canSeeDev = isSuperAdmin || isDeveloper

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-black text-white selection:bg-indigo-500/30">
      {/* Sidebar: Ultra-slick, dark mode forced for God Mode */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-indigo-900/30 bg-zinc-950 px-6 py-8 flex flex-col gap-8 shadow-2xl z-10">
        
        {/* IQMela System Watermark */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </div>
            <h2 className="text-xl font-black tracking-tighter text-white">IQMela <span className="font-light text-indigo-400 text-sm tracking-wide ml-1 uppercase">Platform</span></h2>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-12">System Control</p>
        </div>

        <nav className="flex flex-col gap-1.5 h-full">
          {canSeeDashboard && (
            <Link href="/admin/dashboard" className="px-4 py-2.5 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
              Global Overview
            </Link>
          )}

          {canSeeFinance && (
            <Link href="/admin/finance" className="px-4 py-2.5 rounded-lg text-zinc-400 hover:bg-emerald-900/30 hover:text-emerald-400 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Economics & Billing
            </Link>
          )}

          {canSeeSupport && (
            <>
              <Link href="/admin/support" className="px-4 py-2.5 rounded-lg text-zinc-400 hover:bg-blue-900/30 hover:text-blue-400 font-medium transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Client Support
              </Link>
              
              <Link href="/admin/clients" className="px-4 py-2.5 rounded-lg text-zinc-400 hover:bg-purple-900/30 hover:text-purple-400 font-medium transition-colors flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                Deploy Sandboxes
              </Link>
            </>
          )}

          {canSeeDev && (
            <Link href="/admin/developer" className="px-4 py-2.5 rounded-lg text-zinc-400 hover:bg-rose-900/30 hover:text-rose-400 font-medium transition-colors flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              Dev Ops & Health
            </Link>
          )}

          <div className="mt-auto pt-6 border-t border-zinc-900">
             <div className="flex items-center gap-3 px-3">
               <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center font-bold text-xs uppercase text-zinc-300">
                  {sysRole.replace('sys:', '').slice(0, 2)}
               </div>
               <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">{sysRole.replace('sys:', '')}</p>
                  <p className="text-[10px] text-zinc-500">Authenticated Proxy</p>
               </div>
             </div>
          </div>
        </nav>
      </aside>

      {/* Main Global Content Area */}
      <main className="flex-1 flex flex-col bg-[#050505] overflow-y-auto relative z-0">
        {/* Subtle background glow effect globally */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-indigo-900/10 via-transparent to-transparent pointer-events-none -z-10"></div>
        {children}
      </main>
    </div>
  )
}
