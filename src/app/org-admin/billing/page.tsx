import { getCallerPermissions } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, formatNumber } from "@/lib/locale-utils"

export const metadata = {
  title: "Billing & Subscriptions | Org Admin",
}

export default async function BillingDashboard() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canManageBilling) redirect("/org-admin/dashboard")

  // MOCK DATA for now until Stripe is fully integrated
  // TODO: Replace with real Stripe billing data
  const isDemo = true // Flag to show demo badge
  const tier = "PRO"
  const tokensUsed = 125000
  const maxTokens = 500000
  const billingCycleEnd = formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))

  const usagePercent = Math.min((tokensUsed / maxTokens) * 100, 100)

  return (
    <div className="flex-1 space-y-8 max-w-5xl mx-auto w-full p-4 md:p-8">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Billing & Usage
            </h2>
            {isDemo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 animate-pulse">
                ⚡ Demo Data
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Manage your subscription tier, billing portal, and monitor AI token usage.
          </p>
        </div>
        <form action="/api/billing/stripe/portal" method="POST">
          <Button variant="outline" className="shadow-sm border-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            Manage via Stripe &rarr;
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Plan */}
        <Card className="shadow-sm border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-xl font-bold dark:text-white flex justify-between">
              Current Plan
              <span className="bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                {tier}
              </span>
            </CardTitle>
            <CardDescription className="dark:text-zinc-400">
              Your billing cycle resets on {billingCycleEnd}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-black dark:text-white mt-2">$299<span className="text-lg text-zinc-500 font-medium">/mo</span></div>
            <p className="text-sm text-gray-600 dark:text-zinc-500">
              Includes 500k AI inference tokens, unlimited active positions, and 5 team member seats.
            </p>
            <Button className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold">
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>

        {/* Usage Analytics */}
        <Card className="shadow-sm border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <CardHeader>
            <CardTitle className="text-xl font-bold dark:text-white">AI Token Usage</CardTitle>
            <CardDescription className="dark:text-zinc-400">
              Tokens consumed across DeepSeek & Gemini APIs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-medium mb-2 dark:text-zinc-200">
                <span>{formatNumber(tokensUsed)} tokens</span>
                <span className="text-zinc-500">{formatNumber(maxTokens)} max</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${usagePercent > 85 ? 'bg-rose-500' : 'bg-rose-500'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {usagePercent > 85 && (
                <p className="text-xs text-rose-500 mt-2 font-medium">Approaching usage limits. Consider upgrading to prevent pipeline pausing.</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Top Usage Drivers</h4>
              <div className="flex justify-between text-sm dark:text-zinc-300">
                <span>Bulk Resume Scoring</span>
                <span className="font-semibold">85k tokens</span>
              </div>
              <div className="flex justify-between text-sm dark:text-zinc-300">
                <span>Live AI Interviews (Tavus)</span>
                <span className="font-semibold">25k tokens</span>
              </div>
              <div className="flex justify-between text-sm dark:text-zinc-300">
                <span>JD Keyword Analysis</span>
                <span className="font-semibold">15k tokens</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
