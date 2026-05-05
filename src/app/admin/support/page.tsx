import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Search, TicketIcon, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SupportDashboardClient } from "./SupportDashboardClient"

export const metadata = {
  title: "Client Support | IQMela Admin"
}

export default async function SupportDashboard() {
  const usersCount = await prisma.user.count();
  
  const tickets = await prisma.supportTicket.findMany({
    orderBy: [
      { status: 'asc' }, // Open/InProgress first typically depending on enum alphabetical, but let's just sort by created.
      { createdAt: 'desc' }
    ],
    include: {
      organization: { select: { name: true, domain: true } },
      createdBy: { select: { name: true, email: true } },
      _count: { select: { messages: true } }
    }
  });

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-white">Client Support Command Center</h1>
           <p className="text-zinc-400 mt-2">Manage client tickets, SLAs, and provide resolution communication.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm md:col-span-2">
          <CardHeader className="pb-3 border-b border-zinc-800/60">
            <CardTitle className="text-white text-base flex items-center gap-2"><TicketIcon className="w-5 h-5 text-blue-500" /> Active Support Tickets</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <SupportDashboardClient initialTickets={tickets as any} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-zinc-800/60">
              <CardTitle className="text-white text-base flex items-center gap-2"><Search className="w-5 h-5 text-indigo-500" /> Global User Lookup</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col gap-3">
                <Input className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600" placeholder="Search by email, name, or userId..." />
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Search Database</Button>
              </div>
              <p className="text-xs text-zinc-500 text-center">Searching across {usersCount} registered users globally.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
