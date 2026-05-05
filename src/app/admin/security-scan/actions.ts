"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return { userId };
}

export async function fetchScanHistory() {
  await requireSysAdmin();
  const scans = await prisma.securityScanResult.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return scans.map((s) => ({
    id: s.id,
    overallScore: s.overallScore,
    grade: s.grade,
    totalChecks: s.totalChecks,
    passed: s.passed,
    warnings: s.warnings,
    failed: s.failed,
    checks: s.checks as any[],
    scanDurationMs: s.scanDurationMs,
    triggeredBy: s.triggeredBy,
    createdAt: s.createdAt.toISOString(),
  }));
}
