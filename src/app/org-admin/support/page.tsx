import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ClientSupportDashboard } from "./ClientSupportDashboard"
import { LifeBuoy } from "lucide-react"
import { getCallerPermissions } from "@/lib/rbac"

export const metadata = {
  title: "Support | IQMela"
}

export default async function OrgSupportPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");

  const tickets = await prisma.supportTicket.findMany({
    where: { organizationId: perms.orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { messages: true } }
    }
  });

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-5xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <LifeBuoy className="w-6 h-6 text-white" />
        </div>
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Help & Support</h1>
           <p className="text-gray-500 dark:text-zinc-400 mt-1">Manage your support cases and track resolution progress.</p>
        </div>
      </div>

      <ClientSupportDashboard initialTickets={tickets as any} />
    </div>
  )
}
