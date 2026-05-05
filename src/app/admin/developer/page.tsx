import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Activity, Server, Cpu, AlertTriangle, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react"
import { getAllCircuitBreakers } from "@/lib/ai"

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

  // Get circuit breaker statuses
  const breakers = getAllCircuitBreakers().map(b => b.getStats());

  return (
    <div className="flex-1 w-full p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4 flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-extrabold tracking-tight text-rose-400">Developer Ops</h1>
           <p className="text-zinc-400 mt-2">AI infrastructure health, circuit breaker status, and real-time provider failover switches.</p>
        </div>
      </div>

      {/* ── Circuit Breaker Status ── */}
      {breakers.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Circuit Breaker Status
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Auto-failover protection for AI providers</p>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {breakers.map((b) => {
              const stateColor =
                b.state === "CLOSED" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                b.state === "HALF_OPEN" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                "text-red-400 bg-red-500/10 border-red-500/20";
              const StateIcon = b.state === "CLOSED" ? ShieldCheck :
                               b.state === "HALF_OPEN" ? ShieldAlert : ShieldOff;
              return (
                <div key={b.provider} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <StateIcon className={`w-5 h-5 ${
                      b.state === "CLOSED" ? "text-emerald-400" :
                      b.state === "HALF_OPEN" ? "text-amber-400" : "text-red-400"
                    }`} />
                    <div>
                      <p className="text-sm font-bold text-white uppercase">{b.provider}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Failures: {b.consecutiveFailures}
                        {b.lastFailureTime && ` · Last: ${b.lastFailureTime}`}
                        {b.cooldownRemaining > 0 && ` · Cooldown: ${Math.ceil(b.cooldownRemaining / 1000)}s`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${stateColor}`}>
                    {b.state.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
