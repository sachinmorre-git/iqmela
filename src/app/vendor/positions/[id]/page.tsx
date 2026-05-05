import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import Link from "next/link"
import { ResumeUploadZone } from "@/app/org-admin/positions/[id]/ResumeUploadZone"
import { ShieldCheck, ArrowLeft, Users } from "lucide-react"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const position = await prisma.position.findUnique({
    where: { id },
    select: { title: true },
  })
  return {
    title: position
      ? `Upload Candidates: ${position.title} | Vendor Hub`
      : "Upload Candidates",
  }
}

export default async function VendorPositionDropzonePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const perms = await getCallerPermissions()
  if (!perms || !perms.isVendor) redirect("/select-role")

  const { id } = await params

  // Strict check: Vendor org must have an ACTIVE dispatch mapping to an OPEN position
  const invite = await prisma.positionVendor.findFirst({
    where: {
      positionId: id,
      vendorOrgId: perms.orgId,
      status: "ACTIVE",
      position: {
        status: "OPEN",
        isDeleted: false
      }
    },
    include: {
      position: {
        include: {
          resumes: {
            where: { vendorOrgId: perms.orgId } // ONLY see their own org's uploaded resumes
          }
        }
      }
    }
  });

  if (!invite) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
          This position may have been closed by the organization administrator, or you do not have active sourcing rights for it.
        </p>
        <Link href="/vendor/dashboard" className="text-rose-600 font-semibold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { position } = invite;

  return (
    <div className="flex-1 space-y-8 max-w-4xl mx-auto p-4 md:p-8 w-full">
      <Link
        href="/vendor/dashboard"
        className="text-sm font-medium text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 flex items-center mb-6 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
      </Link>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 lg:p-10 shadow-sm">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-zinc-800 pb-8 mb-8">
          <div>
            <div className="inline-flex items-center px-3 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              Secure Upload Zone
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
              {position.title}
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 text-lg">
              {position.department} {position.location && `· ${position.location}`}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <Users className="w-4 h-4 text-gray-400" /> You've Submitted
            </div>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none">
              {position.resumes.length}
            </span>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">candidates</span>
          </div>
        </div>

        {/* The reusable ResumeUploadZone handles the POST logic back to the master route! */}
        <div className="max-w-2xl mx-auto py-4">
           <ResumeUploadZone positionId={position.id} uploadEndpoint="/api/vendor/resumes/upload" />
        </div>
      </div>
    </div>
  );
}
