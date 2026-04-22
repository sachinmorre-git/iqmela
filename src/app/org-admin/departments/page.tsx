import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { DepartmentManager } from "./DepartmentManager";

export const metadata = {
  title: "Departments | Org Admin",
};

export default async function DepartmentsPage() {
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");

  // Only ORG_ADMIN can access this page
  if (!perms.canManageDepartments) {
    redirect("/org-admin/dashboard");
  }

  const departments = await prisma.department.findMany({
    where: { organizationId: perms.orgId },
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const serializedDepartments = departments.map((d) => ({
    id: d.id,
    name: d.name,
    createdAt: d.createdAt.toISOString(),
    _count: d._count,
  }));

  return (
    <div className="flex-1 space-y-8 max-w-4xl mx-auto p-4 md:p-8 w-full">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Departments
        </h2>
        <p className="text-muted-foreground mt-1 text-zinc-400">
          Create and manage organizational departments. You can assign members to departments from the Team Settings page.
        </p>
      </div>

      <DepartmentManager initialDepartments={serializedDepartments} />
    </div>
  );
}
