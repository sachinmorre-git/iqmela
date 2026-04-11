import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

// Ensure this page is completely dynamically rendered so we always test the live DB cluster
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Dev Console | Database'
}

export default async function DevDataDashboard() {
  let dbStatus = "Connecting..."
  let users: any[] = []
  let errorMsg = null

  try {
    // Attempting a raw findMany to verify the connection payload
    users = await prisma.user.findMany({ take: 5 })
    dbStatus = "Connected"
  } catch (err: any) {
    dbStatus = "Connection Failed"
    // Extracting a clean error surface for the UI 
    errorMsg = err.message || JSON.stringify(err)
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto py-10 px-6">
      <div className="mb-2">
         <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Database Test Module</h1>
         <div className="flex items-center gap-3 mt-4">
           <span className="text-gray-500 font-medium">Postgres Status:</span>
           <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase shadow-sm ${
             dbStatus === 'Connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
           }`}>
             {dbStatus}
           </span>
         </div>
      </div>

      <Card className="shadow-xl shadow-gray-200/40 dark:shadow-none border-gray-200 dark:border-zinc-800 overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5 bg-gray-50/50 dark:bg-zinc-900/20">
           <CardTitle className="text-xl font-bold flex items-center justify-between text-gray-900 dark:text-white">
              Users Payload (Raw)
              <span className="bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-400 text-xs px-2.5 py-1 rounded-md tracking-wider font-bold">LIMIT 5</span>
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
           {errorMsg ? (
             <div className="p-8 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-mono text-[13px] overflow-x-auto leading-relaxed border-t border-red-100 dark:border-red-900/30">
                <p className="font-black mb-3 text-red-800 dark:text-red-300">RUNTIME ERROR:</p>
                <pre>{errorMsg}</pre>
             </div>
           ) : (
             <div className="p-6 bg-white dark:bg-zinc-950">
               {users.length === 0 ? (
                 <p className="text-gray-500 italic p-4 text-center">No users found in database.</p>
               ) : (
                 <pre className="bg-gray-50 dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs overflow-x-auto text-gray-800 dark:text-gray-300 shadow-inner">
                   {JSON.stringify(users, null, 2)}
                 </pre>
               )}
             </div>
           )}
        </CardContent>
      </Card>
      
      <div className="text-sm text-gray-400 font-medium text-center border-t border-gray-100 dark:border-zinc-800 pt-8 mt-4">
        Note: This is a /dev staging route indicating raw data output. It must be blocked in production environments.
      </div>
    </div>
  )
}
