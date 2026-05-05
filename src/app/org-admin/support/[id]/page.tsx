import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { ClientTicketChat } from "./ClientTicketChat"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@clerk/nextjs/server"

export const metadata = {
  title: "Support Ticket | IQMela"
}

export default async function OrgSupportTicketPage(props: { params: Promise<{ id: string }> }) {
  const { orgId } = await auth();
  if (!orgId) redirect("/select-org");

  const params = await props.params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, name: true, email: true, roles: true } }
        }
      }
    }
  });

  if (!ticket || ticket.organizationId !== orgId) {
    notFound();
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-5xl mx-auto space-y-6 z-10 relative">
      <div className="mt-4 flex items-center gap-4">
        <Link 
          href="/org-admin/support"
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
           <h1 className="text-2xl font-extrabold tracking-tight text-white">Support Case</h1>
           <p className="text-sm text-zinc-400">View updates and reply to our support team.</p>
        </div>
      </div>

      <ClientTicketChat ticket={ticket as any} />
    </div>
  )
}
