import { getCallerPermissions } from "@/lib/rbac"
import { redirect } from "next/navigation"
import { AiTestButton } from "./AiTestButton"
import { AiCostDashboard } from "./AiCostDashboard"
import IntegrationsPanel from "./IntegrationsPanel"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

export const metadata = {
  title: "System Settings | Org Admin",
}

export default async function OrgAdminSettingsPage() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canManageSettings) redirect("/org-admin/dashboard")

  const { orgId } = await auth()

  // Fetch connected integrations
  const integrations = orgId
    ? await prisma.orgIntegration.findMany({
        where: { organizationId: orgId },
        select: {
          platform: true,
          status: true,
          externalOrgName: true,
          connectedBy: true,
          createdAt: true,
        },
      })
    : []

  const serializedIntegrations = integrations.map((i) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
  }))

  // Read environment variables directly (Server Component, secure)
  const providerType = process.env.EMAIL_PROVIDER?.toLowerCase() || "mock"
  const hasResendKey = !!process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM || "Not Configured"
  const emailReplyTo = process.env.EMAIL_REPLY_TO || "Not Configured"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "Not Configured"

  // Readiness evaluation
  const isReady = providerType === "resend" && hasResendKey
  let statusBadge = null

  if (providerType === "mock") {
    statusBadge = (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        Development (Mock Provider)
      </span>
    )
  } else if (isReady) {
    statusBadge = (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        Live & Ready
      </span>
    )
  } else {
    statusBadge = (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        Configuration Missing
      </span>
    )
  }

  const aiProvider = process.env.AI_PROVIDER || "mock"
  const aiFallback = process.env.AI_FALLBACK_PROVIDER || "mock"
  const deepseekPresent = !!process.env.DEEPSEEK_API_KEY
  const geminiPresent = !!process.env.GEMINI_API_KEY

  return (
    <div className="flex-1 space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            System Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage global platform configurations and review infrastructure status.
          </p>
        </div>
      </div>

      {/* Job Board Integrations */}
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm p-6">
        <IntegrationsPanel integrations={serializedIntegrations} />
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 dark:border-zinc-800 px-6 py-5 bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Infrastructure</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review your email delivery service and sender details.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            
            {/* Status overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Active Provider</div>
                <div className="text-base font-semibold text-gray-900 dark:text-white capitalize">{providerType}</div>
              </div>
              
              <div className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">System Status</div>
                <div className="mt-1">{statusBadge}</div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 pt-6">
              <dl className="divide-y divide-gray-100 dark:divide-zinc-800">
                <div className="py-4 grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">API Key Status</dt>
                  <dd className="text-sm text-gray-900 dark:text-white col-span-2 flex items-center gap-2">
                    {hasResendKey ? (
                      <><span className="w-2h h-2 rounded-full bg-emerald-500"></span> Secret Token Configured (Hidden)</>
                    ) : (
                      <><span className="w-2 h-2 rounded-full bg-rose-500"></span> Missing / Not required for Mock</>
                    )}
                  </dd>
                </div>
                
                <div className="py-4 grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Standard 'From' Address</dt>
                  <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block w-max">
                    {emailFrom}
                  </dd>
                </div>

                <div className="py-4 grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Standard 'Reply-To'</dt>
                  <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block w-max">
                    {emailReplyTo}
                  </dd>
                </div>

                <div className="py-4 grid grid-cols-3 gap-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Application Base URL</dt>
                  <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                    <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{appUrl}</span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 p-4 border border-orange-100 dark:border-orange-900/30">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">Security Notice</h3>
                  <div className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                    <p>These settings are strictly read-only within the platform. To modify them, you must update the platform environment variables through your hosting provider (e.g., Vercel Dashboard) and trigger a redeployment.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* AI Configuration Section */}
        <div className="border-t border-gray-200 dark:border-zinc-800 px-6 py-5 bg-rose-50/50 dark:bg-rose-900/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2a2 2 0 0 1-2-2c0-1.1.9-2 2-2"/><path d="M4 8h16"/><path d="M4 14h16"/><path d="M4 20h16"/><path d="M6 8v12"/><path d="M18 8v12"/></svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Intelligence Infrastructure</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review your default AI providers, fallbacks, and keys.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Primary Provider</div>
              <div className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{aiProvider}</div>
            </div>
            
            <div className="p-4 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Fallback Provider</div>
              <div className="text-base font-semibold text-gray-900 dark:text-white uppercase tracking-wider">{aiFallback}</div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 mt-6">
            <dl className="divide-y divide-gray-100 dark:divide-zinc-800">
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">DeepSeek Key Configured</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 flex items-center gap-2">
                  {deepseekPresent ? <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Yes</> : <><span className="w-2 h-2 rounded-full bg-rose-500"></span> No</>}
                </dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Gemini Key Configured</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 flex items-center gap-2">
                  {geminiPresent ? <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Yes</> : <><span className="w-2 h-2 rounded-full bg-rose-500"></span> No</>}
                </dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Extraction Model</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono">{process.env.DEEPSEEK_CHAT_MODEL || process.env.GEMINI_MODEL}</dd>
              </div>
              <div className="py-4 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Reasoner Model</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono">{process.env.DEEPSEEK_REASONER_MODEL || process.env.GEMINI_MODEL}</dd>
              </div>
            </dl>
          </div>

          <AiTestButton />
        </div>

      </div>

      <AiCostDashboard orgId={perms.orgId} />
    </div>
  )
}
