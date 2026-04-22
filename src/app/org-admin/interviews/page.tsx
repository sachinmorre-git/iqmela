import React from "react";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { InterviewsTable } from "./InterviewsTable";
import { InterviewsStatsBanner } from "./InterviewsStatsBanner";

export const metadata = { title: "Interviews | IQMela" };

export default async function OrgAdminInterviewsDashboard() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");
  
  // They must have at least view positions capability to view org interviews
  if (!perms.canViewPositions) redirect("/org-admin/dashboard");

  // Fetch all interviews for the organization
  // Scope by department if the user is a DEPT_ADMIN (which sets scopedDeptIds)
  const interviews = await prisma.interview.findMany({
    where: {
      organizationId: perms.orgId,
      ...(perms.scopedDeptIds && {
        position: {
          departmentId: { in: perms.scopedDeptIds }
        }
      })
    },
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      interviewer: { select: { id: true, name: true, email: true } },
      position: { select: { id: true, title: true } }
    },
    orderBy: { scheduledAt: 'desc' }
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      <div className="border-b border-gray-100 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Interviews Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor all scheduled, active, and completed interviews across your organization.
        </p>
      </div>

      {/* Stats Hero Section */}
      <InterviewsStatsBanner interviews={interviews as any} />

      {/* Datatable */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[400px]">
        <InterviewsTable interviews={interviews as any} />
      </div>
    </div>
  );
}
