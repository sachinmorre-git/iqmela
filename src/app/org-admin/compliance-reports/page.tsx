import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCallerPermissions } from "@/lib/rbac";
import { ComplianceReportsClient } from "./ComplianceReportsClient";

export const metadata = {
  title: "Compliance & Audits | IQMela",
  description: "Auto-generate compliance reports, track audit readiness, and manage regulatory filings.",
};

export default async function ComplianceReportsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");

  // RBAC: Only pipeline roles (OA, DA, Recruiter, HM) can access compliance reports
  if (!perms.canViewReviews && !perms.isOrgAdmin) {
    redirect("/org-admin/dashboard");
  }

  // Recruiters get read-only access
  const isRecruiter = perms.roles.includes("RECRUITER") && !perms.roles.includes("ORG_ADMIN") && !perms.roles.includes("ADMIN");

  // Fetch all reports for this org, newest first
  const reports = await prisma.complianceReport.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  // Serialize dates for the client component
  const serialized = reports.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    positionId: r.positionId,
    type: r.type,
    status: r.status,
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    reportData: r.reportData,
    requestedBy: r.requestedBy,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-zinc-800 pb-6 mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          🏛️ Compliance & Audits
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-2 max-w-2xl text-sm">
          Auto-generate regulatory compliance reports, monitor audit readiness scores, and maintain a permanent filing record for legal reviews.
          {isRecruiter && (
            <span className="block mt-1 text-xs text-amber-500 font-semibold">
              🔒 Read-only access. Contact your Org Admin to generate new reports.
            </span>
          )}
        </p>
      </div>

      <ComplianceReportsClient reports={serialized} isRecruiter={isRecruiter} />
    </div>
  );
}
