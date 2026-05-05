import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TicketChatClient } from "./TicketChatClient"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Ticket Details | IQMela Admin"
}

export default async function SupportTicketPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    include: {
      organization: { select: { name: true, domain: true, planTier: true } },
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, name: true, email: true, roles: true } }
        }
      }
    }
  });

  if (!ticket) {
    notFound();
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-7xl mx-auto space-y-6 z-10 relative">
      <div className="mt-4 flex items-center gap-4">
        <Link 
          href="/admin/support"
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
           <h1 className="text-2xl font-extrabold tracking-tight text-white">Ticket Resolution</h1>
           <p className="text-sm text-zinc-400">View details and communicate with the client.</p>
        </div>
      </div>

      <TicketChatClient ticket={ticket as any} />
    </div>
  )
}
