import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import PositionForm from "../components/PositionForm"
import { createPosition } from "./actions"

export const metadata = {
  title: "Post New Position | IQMela",
  description: "Create a new open position for your organization.",
}

export default async function NewPositionPage() {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canManagePositions) redirect("/org-admin/dashboard")

  // Fetch departments scoped by caller's permissions
  const departments = await prisma.department.findMany({
    where: {
      organizationId: perms.orgId,
      ...(perms.scopedDeptIds ? { id: { in: perms.scopedDeptIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <PositionForm
      mode="create"
      departments={departments}
      serverAction={createPosition}
    />
  )
}
