import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DollarSign, TrendingUp, KeySquare, Users } from "lucide-react"

export const metadata = {
  title: "Economics & Billing | IQMela Admin"
}

export default async function FinanceDashboard() {
  // Aggregate AI compute totals
  const computeCosts = await prisma.aiUsageLog.aggregate({
    _sum: { estimatedCost: true }
  })
  const totalCostRaw = computeCosts._sum.estimatedCost || 0
  const normalizedCost = totalCostRaw > 0 ? (totalCostRaw/1000).toFixed(2) : "0.00" // Simple scaling for UI

  // Mock global Stripe revenue
  const mockMRR = 45000.00

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">Economics & Billing</h1>
        <p className="text-zinc-400 mt-2">Monitor platform-wide Stripe MRR against aggregate API inference costs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-950/20 border-emerald-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Platform MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-emerald-100">${mockMRR.toLocaleString()}</div>
            <p className="text-xs text-emerald-700 mt-1">across all B2B workspaces</p>
          </CardContent>
        </Card>

        <Card className="bg-rose-950/20 border-rose-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Accumulated API Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-rose-100">${normalizedCost}</div>
            <p className="text-xs text-rose-700 mt-1">DeepSeek, Gemini, Tavus, Deepgram</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
