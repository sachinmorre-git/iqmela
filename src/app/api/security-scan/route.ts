/**
 * GET /api/security-scan
 *
 * Runs the 12-check security scanner and returns the results.
 *
 * Two modes:
 *   1. Cron: Vercel cron hits this daily. Persists result to DB + notifies admins on failures.
 *   2. On-demand: Admin triggers from /admin/security-scan dashboard.
 *
 * Auth: CRON_SECRET for cron, or authenticated sys: staff.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runSecurityScan } from "@/lib/security-scanner";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  // Auth: either CRON_SECRET or sys: staff
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const { sessionClaims } = await auth();
    const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
    if (!sysRole?.startsWith("sys:")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runSecurityScan();

    // Persist scan result to DB
    await prisma.securityScanResult.create({
      data: {
        overallScore: result.overallScore,
        grade: result.grade,
        totalChecks: result.totalChecks,
        passed: result.passed,
        warnings: result.warnings,
        failed: result.failed,
        checks: result.checks as any,
        scanDurationMs: result.scanDurationMs,
        triggeredBy: isCron ? "cron" : "manual",
      },
    }).catch((e) => {
      console.error("[SecurityScan] Failed to persist result:", e);
    });

    // If score is below threshold, notify super admins
    if (result.overallScore < 70) {
      notifyLowScore(result).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SecurityScan] Scan failed:", error);
    return NextResponse.json(
      { error: "Security scan failed" },
      { status: 500 }
    );
  }
}

async function notifyLowScore(result: { overallScore: number; grade: string; failed: number }) {
  try {
    const superAdmins = await prisma.user.findMany({
      where: { roles: { has: "INTERNAL_GOD_MODE" } },
      select: { id: true, organizationId: true },
    });

    if (superAdmins.length === 0) return;

    const { createBulkNotifications } = await import("@/lib/notification-service");
    await createBulkNotifications(
      superAdmins.map((admin) => ({
        organizationId: admin.organizationId ?? "GLOBAL",
        userId: admin.id,
        type: "PLATFORM_INCIDENT" as const,
        title: `Security Score: ${result.overallScore}/100 (${result.grade})`,
        body: `${result.failed} check(s) failed. Review security dashboard immediately.`,
        link: "/admin/security-scan",
      }))
    );
  } catch {
    // Non-critical
  }
}
