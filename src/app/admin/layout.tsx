import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SidebarNavItem, SidebarSection } from '@/components/SidebarNavItem'

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
  const canSeeAudit = isSuperAdmin || isSupport || isDeveloper

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-black text-white selection:bg-rose-500/30">
      {/* Sidebar: Ultra-slick, dark mode forced for God Mode */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-rose-900/30 bg-zinc-950 px-6 py-8 flex flex-col gap-8 shadow-2xl z-10">
        
        {/* IQMela System Watermark */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/icon/iq-icon.svg"
              alt="IQMela"
              className="w-8 h-8 rounded-lg shadow-xl shadow-pink-500/20 drop-shadow-[0_0_6px_rgba(255,0,87,0.35)]"
            />
            <h2 className="text-xl font-black tracking-tighter text-white">IQMela <span className="font-light text-rose-400 text-sm tracking-wide ml-1 uppercase">Platform</span></h2>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 ml-12">System Control</p>
        </div>

        <nav className="flex flex-col gap-1.5 h-full">
          {canSeeDashboard && (
            <SidebarNavItem href="/admin/dashboard" label="Global Overview" variant="dark" darkAccent="default" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>} />
          )}

          {canSeeFinance && (
            <SidebarNavItem href="/admin/finance" label="Economics & Billing" variant="dark" darkAccent="emerald" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
          )}

          {/* ── Configuration Section ── */}
          {canSeeDashboard && (
            <>
              <SidebarSection title="Configuration" className="!text-zinc-600" />

              <SidebarNavItem href="/admin/config" label="Platform Config" variant="dark" darkAccent="amber" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>} />

              <SidebarNavItem href="/admin/ai-config" label="AI Configuration" variant="dark" darkAccent="indigo" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="14" r="2"/></svg>} />

              <SidebarNavItem href="/admin/compliance" label="Compliance Engine" variant="dark" darkAccent="teal" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />

              <SidebarNavItem href="/admin/geo-compliance" label="Geo-Compliance" variant="dark" darkAccent="sky" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} />
            </>
          )}

          {canSeeSupport && (
            <>
              <SidebarNavItem href="/admin/support" label="Client Support" variant="dark" darkAccent="blue" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
              
              <SidebarNavItem href="/admin/clients" label="Deploy Sandboxes" variant="dark" darkAccent="purple" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>} />
            </>
          )}

          {canSeeDev && (
            <>
            <SidebarNavItem href="/admin/health" label="Health Monitor" variant="dark" darkAccent="emerald" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />

            <SidebarNavItem href="/admin/security" label="Security & Blocks" variant="dark" darkAccent="amber" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />

            <SidebarNavItem href="/admin/security-scan" label="Security Scanner" variant="dark" darkAccent="blue" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>} />

            <SidebarNavItem href="/admin/developer" label="Dev Ops" variant="dark" darkAccent="rose" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>} />

            <SidebarNavItem href="/admin/risk-analysis" label="Risk Analysis" variant="dark" darkAccent="red" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
            </>
          )}

          {canSeeAudit && (
            <>
            <SidebarSection title="Compliance" className="!text-zinc-600" />
            <SidebarNavItem href="/admin/audit-log" label="Audit Trail" variant="dark" darkAccent="violet" icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>} />
            </>
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
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-rose-900/10 via-transparent to-transparent pointer-events-none -z-10"></div>
        {children}
      </main>
    </div>
  )
}
