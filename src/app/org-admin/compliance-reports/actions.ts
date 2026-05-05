"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateReportData } from "@/lib/compliance/report-generator";

async function requireAuth() {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  const isSuperAdmin = sysRole?.startsWith("sys:");
  return { userId, orgId, isSuperAdmin };
}

export async function generateComplianceReport(formData: FormData) {
  const { userId, orgId, isSuperAdmin } = await requireAuth();

  const type = formData.get("type") as string;
  const periodStart = new Date(formData.get("periodStart") as string);
  const periodEnd = new Date(formData.get("periodEnd") as string);
  const scope = formData.get("scope") as string; // "org" or "platform"

  const reportOrgId = scope === "platform" && isSuperAdmin ? null : orgId;

  try {
    // Generate the report data from live DB
    const reportData = await generateReportData(type, reportOrgId, periodStart, periodEnd);

    // Persist to the ComplianceReport table
    await prisma.complianceReport.create({
      data: {
        type: type as any,
        status: "READY",
        orgId: reportOrgId,
        periodStart,
        periodEnd,
        reportData,
        requestedBy: userId,
      },
    });
  } catch (e) {
    // Even if generation fails, log the failure
    await prisma.complianceReport.create({
      data: {
        type: type as any,
        status: "FAILED",
        orgId: orgId,
        periodStart,
        periodEnd,
        requestedBy: userId,
        notes: `Generation error: ${(e as Error).message}`,
      },
    });
  }

  revalidatePath("/org-admin/compliance-reports");
}

export async function updateReportStatus(reportId: string, status: string, notes?: string) {
  const { userId } = await requireAuth();
  await prisma.complianceReport.update({
    where: { id: reportId },
    data: {
      status: status as any,
      ...(notes ? { notes } : {}),
    },
  });
  revalidatePath("/org-admin/compliance-reports");
}

export async function deleteReport(reportId: string) {
  const { userId, orgId, isSuperAdmin } = await requireAuth();

  // Only super admins can delete
  if (!isSuperAdmin) throw new Error("Only Super Admins can delete compliance reports");

  await prisma.complianceReport.delete({ where: { id: reportId } });
  revalidatePath("/org-admin/compliance-reports");
}
