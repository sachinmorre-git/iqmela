import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { CreateOrgForm } from "./CreateOrgForm"
import { Building2 } from "lucide-react"

export const metadata = {
  title: "Create Your Workspace | IQMela",
  description: "Set up your company's hiring workspace on IQMela in seconds.",
}

export default async function CreateOrgPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect("/sign-in")

  // If user already has an active org session, send them to dashboard
  if (orgId) redirect("/org-admin/dashboard")

  // Check rate limit server-side too (max 2 admin orgs)
  const client = await clerkClient()
  const membershipList = await client.users.getOrganizationMembershipList({ userId })
  const memberships = membershipList.data || []
  const adminOrgs = memberships.filter(m => m.role === "org:admin")

  if (adminOrgs.length >= 2) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center backdrop-blur-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <Building2 className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Organization Limit Reached</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            You already manage {adminOrgs.length} organizations, which is the maximum for your account.
            Please contact support if you need additional workspaces.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-emerald-500/20 border border-rose-500/20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-500/10">
            <Building2 className="w-7 h-7 text-rose-400" />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Create Your Workspace
          </h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-xs mx-auto leading-relaxed">
            Set up your company&apos;s hiring workspace in seconds.
            Start with our free Starter plan — upgrade anytime.
          </p>
        </div>

        {/* Form */}
        <CreateOrgForm />

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-zinc-600">
            By creating a workspace, you agree to IQMela&apos;s Terms of Service.
          </p>
        </div>
      </div>
    </div>
  )
}
