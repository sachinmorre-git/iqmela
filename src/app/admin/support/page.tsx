import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Search, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const metadata = {
  title: "Client Support | IQMela Admin"
}

export default async function SupportDashboard() {
  const usersCount = await prisma.user.count();

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-blue-400">Client Support</h1>
           <p className="text-zinc-400 mt-2">Global user lookup, emulation, and bug report tracking.</p>
        </div>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm max-w-2xl">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2"><Search className="w-5 h-5 text-blue-500" /> Global User Lookup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600" placeholder="Search by email, name, or userId..." />
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Search Database</Button>
          </div>
          <p className="text-xs text-zinc-500">Currently searching across {usersCount} registered users globally.</p>
        </CardContent>
      </Card>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mt-8 max-w-4xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Bug className="w-5 h-5 text-blue-500" /> Active Bug Reports</h2>
        </div>
        <div className="p-12 text-center text-zinc-500">The support ticketing queue is currently empty.</div>
      </div>
    </div>
  )
}
