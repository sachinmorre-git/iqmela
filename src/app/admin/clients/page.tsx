import { prisma } from "@/lib/prisma"
import { ClientSandboxDeployer } from "./DeployerForm"
import { Building2 } from "lucide-react"

export const metadata = {
  title: "Client Sandboxes | IQMela Admin"
}

export default async function ClientSandboxesPage() {
  const activeDepartments = await prisma.department.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      _count: {
        select: { positions: true }
      }
    }
  });

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-purple-400">Client Sandboxes</h1>
           <p className="text-zinc-400 mt-2">Programmatically onboard new B2B enterprises and monitor active tenant boundaries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <ClientSandboxDeployer />
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-purple-500" /> Monitored Tenants</h2>
          </div>
          
          <div className="p-0">
            {activeDepartments.length === 0 ? (
               <div className="p-12 text-center text-zinc-500">No organizations actively synced to the database.</div>
            ) : (
              <ul className="divide-y divide-zinc-800/60 text-sm">
                {activeDepartments.map(org => (
                  <li key={org.id} className="p-4 hover:bg-zinc-800/20 transition-colors flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white tracking-wide">{org.name}</p>
                      <p className="text-[10px] uppercase font-mono text-zinc-500 mt-0.5">{org.organizationId || 'unmapped-clerk-tenant'}</p>
                    </div>
                    <div className="text-right">
                       <span className="bg-purple-900/40 text-purple-300 font-bold px-2 py-1 rounded text-xs">
                          {org._count.positions} Positions
                       </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
