import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Activity, Server, Cpu, AlertTriangle } from "lucide-react"

export const metadata = {
  title: "Developer Ops | IQMela Admin"
}

export default async function DeveloperDashboard() {
  const usageLogs = await prisma.aiUsageLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      provider: true,
      model: true,
      taskType: true,
      totalTokens: true,
      createdAt: true
    }
  });

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-rose-400">Developer Ops</h1>
           <p className="text-zinc-400 mt-2">AI infrastructure health, token latency logs, and real-time provider failover switches.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-zinc-900/50 border-rose-900/40 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2"><Server className="w-5 h-5 text-rose-500" /> Active AI Provider Routers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
               <div>
                 <p className="text-sm font-bold text-white uppercase flex items-center gap-2">DeepSeek API <span className="w-2 h-2 rounded-full bg-emerald-500"></span></p>
                 <p className="text-xs text-zinc-500 mt-1">Status: Healthy &bull; Endpoint: deepseek-chat</p>
               </div>
               <span className="text-xs font-bold bg-zinc-800 text-zinc-400 px-3 py-1 rounded">Primary LLM</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
               <div>
                 <p className="text-sm font-bold text-white uppercase flex items-center gap-2">Gemini Pro API <span className="w-2 h-2 rounded-full bg-emerald-500"></span></p>
                 <p className="text-xs text-zinc-500 mt-1">Status: Healthy &bull; Endpoint: gemini-1.5-pro</p>
               </div>
               <span className="text-xs font-bold bg-zinc-800 text-zinc-400 px-3 py-1 rounded">Resume Extractor</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-rose-950/20 border border-rose-900/50 rounded-xl">
               <div>
                 <p className="text-sm font-bold text-rose-100 uppercase flex items-center gap-2">Tavus Conversation Engine <span className="w-2 h-2 rounded-full bg-amber-500"></span></p>
                 <p className="text-xs text-rose-400/70 mt-1">Status: Warning &bull; Avg Latency: 1200ms</p>
               </div>
               <span className="text-xs font-bold bg-rose-900 text-rose-300 px-3 py-1 rounded">Avatar Stream</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-rose-500" /> Real-time Compute Stream</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
             {usageLogs.length === 0 ? (
               <p className="text-sm text-zinc-500">No compute logs recorded.</p>
             ) : (
               <ul className="space-y-3">
                 {usageLogs.map((log, i) => (
                   <li key={i} className="flex justify-between items-center text-sm border-b border-zinc-800/60 pb-3 last:border-0">
                     <div>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.provider === 'DEEPSEEK' ? 'bg-blue-900/40 text-blue-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                         {log.provider}
                       </span>
                       <span className="text-zinc-300 ml-2 font-mono text-xs">{log.taskType}</span>
                     </div>
                     <span className="font-mono text-xs text-zinc-500">{log.totalTokens} tks</span>
                   </li>
                 ))}
               </ul>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
