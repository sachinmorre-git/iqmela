import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCallerPermissions } from '@/lib/rbac'
import Link from 'next/link'
import { FileStack, Briefcase, Building2 } from 'lucide-react'

export const metadata = {
  title: "Vendor Hub | IQMela",
}

export default async function VendorDashboard() {
  const perms = await getCallerPermissions();
  if (!perms || !perms.isVendor) redirect('/select-role');

  const { userId, orgId } = perms;

  const activeInvites = await prisma.positionVendor.findMany({
    where: {
      vendorOrgId: orgId,
      status: "ACTIVE",
      position: {
        status: "OPEN",
        isDeleted: false
      }
    },
    include: {
      position: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="flex-1 space-y-8 max-w-6xl mx-auto p-4 md:p-8 w-full">
      <div className="flex items-start justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-600 dark:text-indigo-500" />
            Vendor Hub
          </h2>
          <p className="text-muted-foreground mt-2 text-zinc-500 dark:text-zinc-400">
            Welcome to your sourcing dashboard. Select a dispatched position below to upload and lock-in your candidates. You can only view active, open positions mapped specifically to your agency.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {activeInvites.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
            <Briefcase className="w-12 h-12 text-gray-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No Active Positions</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm">
              You haven't been dispatched to any open positions yet. When a recruiter requests your agency, the dropzone links will appear here.
            </p>
          </div>
        ) : (
          activeInvites.map(({ position }) => (
            <Link 
              key={position.id} 
              href={`/vendor/positions/${position.id}`}
              className="group block"
            >
              <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 h-full transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-900/50">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <FileStack className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Accepting Uploads
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                  {position.title}
                </h3>
                
                {position.department && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium mb-4">
                    {position.department} {position.location ? `· ${position.location}` : ""}
                  </p>
                )}
                
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">
                  Open Dropzone 
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-1 transition-all"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
