import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: 'Admin Dashboard | Interview Platform',
  description: 'Platform management and unified overview.',
}

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">Platform metrics and administrative controls.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="shrink-0 rounded-xl shadow-sm hover:-translate-y-0.5 transition-transform">
             Export Data
          </Button>
          <Button className="shrink-0 rounded-xl shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent hover:-translate-y-0.5 transition-transform">
             Manage Users
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-emerald-600 border-none text-white shadow-lg shadow-emerald-600/20 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-emerald-100">Live Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black mt-2">14</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-gray-900 dark:text-white mt-2">1,204</div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-gray-900 dark:text-white mt-2">8,932</div>
          </CardContent>
        </Card>

        <Card className="border-gray-100 dark:border-zinc-800 shadow-sm transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3 pb-1 inline-block">100% UP</div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Dashboard Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Recent Activity Stream */}
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-gray-100 dark:border-zinc-800 flex flex-col min-h-[380px]">
          <CardHeader className="border-b border-gray-100 dark:border-zinc-800/60 pb-5">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center justify-between">
              Recent Activity
              <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-900/20">View All Logs</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {[
               { verb: "Account created", user: "system_admin", time: "2 mins ago", type: "system" },
               { verb: "Role updated", user: "jane_doe (Interviewer)", time: "18 mins ago", type: "user" },
               { verb: "Assessment DB sync", user: "system_cron", time: "1 hour ago", type: "system" },
               { verb: "Login brute-force attempt blocked", user: "IP: 192.168.1.1", time: "3 hours ago", type: "security" }
            ].map((log, i) => (
              <div key={i} className="flex gap-4 items-center border border-gray-100 dark:border-zinc-800 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${
                  log.type === 'system' ? 'bg-blue-500' : 
                  log.type === 'security' ? 'bg-red-500' : 'bg-emerald-500'
                }`}></div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{log.verb}</h4>
                  <p className="text-xs font-medium text-gray-500 mt-0.5">{log.user}</p>
                </div>
                <span className="text-xs text-gray-400 font-medium">{log.time}</span>
              </div>
            ))}

          </CardContent>
        </Card>
      </div>
    </div>
  )
}
