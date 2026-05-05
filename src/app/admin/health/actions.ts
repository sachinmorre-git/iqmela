"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return userId;
}

export async function resolveIncident(incidentId: string) {
  const userId = await requireSysAdmin();
  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  });
  revalidatePath("/admin/health");
}

export async function updateIncidentStatus(incidentId: string, status: string) {
  await requireSysAdmin();
  await prisma.incident.update({
    where: { id: incidentId },
    data: { status },
  });
  revalidatePath("/admin/health");
}

export async function createManualIncident(formData: FormData) {
  const userId = await requireSysAdmin();
  const title = formData.get("title") as string;
  const service = formData.get("service") as string;
  const severity = formData.get("severity") as string;
  const description = formData.get("description") as string;

  await prisma.incident.create({
    data: {
      title,
      service,
      severity,
      description: description || null,
      autoDetected: false,
    },
  });
  revalidatePath("/admin/health");
}

export async function purgeOldLogs(daysToKeep: number = 30) {
  await requireSysAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const deleted = await prisma.healthCheckLog.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  });

  revalidatePath("/admin/health");
  return deleted.count;
}
