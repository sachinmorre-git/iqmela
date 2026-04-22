import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";

/**
 * GET /api/behavior-report/[interviewId]
 *
 * Returns the AI behavioral analysis report for a completed interview.
 * RBAC: ORG_ADMIN | DEPT_ADMIN | HIRING_MANAGER | assigned INTERVIEWER
 *
 * Responses:
 *  200 — report ready, returns full JSON
 *  202 — report not yet generated (still processing)
 *  403 — unauthorized
 *  404 — interview not found
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { interviewId } = await params;

    // ── RBAC: verify caller has access to this interview ─────────────────────
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        organizationId: true,
        interviewerId: true,
        panelists: { select: { interviewerId: true } },
        behaviorReport: true,
      },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Org scope check
    const isOrgMatch = interview.organizationId === perms.orgId;
    if (!isOrgMatch && !perms.roles.includes("superadmin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Role gate: only authorized staff can view behavioral reports
    const allowedRoles = ["org-admin", "dept-admin", "hiring-manager", "interviewer", "superadmin"];
    if (!perms.roles.some(r => allowedRoles.includes(r))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Scoped dept admins — verify position is in their dept
    if (perms.roles.includes("dept-admin") && perms.scopedDeptIds) {
      const fullInterview = await prisma.interview.findUnique({
        where: { id: interviewId },
        select: { position: { select: { departmentId: true } } },
      });
      const deptId = fullInterview?.position?.departmentId;
      if (deptId && !perms.scopedDeptIds.includes(deptId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // ── Return report or 202 pending ─────────────────────────────────────────
    if (!interview.behaviorReport) {
      return NextResponse.json(
        { status: "pending", message: "Behavioral analysis is still being generated. Check back in a few minutes." },
        { status: 202 }
      );
    }

    return NextResponse.json({
      status: "ready",
      report: interview.behaviorReport,
    });

  } catch (error: any) {
    console.error("[BehaviorReport API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
