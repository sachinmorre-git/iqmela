import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { getCallerPermissions } from "@/lib/rbac"
import PositionForm from "../../components/PositionForm"
import { updatePosition } from "./actions"

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
    title: position ? `Edit: ${position.title} | IQMela` : "Edit Position | IQMela",
  }
}

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const perms = await getCallerPermissions()
  if (!perms) redirect("/select-role")
  if (!perms.canManagePositions) redirect("/org-admin/dashboard")

  const { id } = await params

  const position = await prisma.position.findUnique({ 
    where: { id },
    include: {
      aiInterviewConfigs: { take: 1 },
    }
  })

  // 404 if missing or wrong org
  if (!position || position.organizationId !== perms.orgId) notFound()
  if (perms.scopedDeptIds && position.departmentId && !perms.scopedDeptIds.includes(position.departmentId)) notFound()

  // Fetch departments scoped by caller's permissions
  const departments = await prisma.department.findMany({
    where: {
      organizationId: perms.orgId,
      ...(perms.scopedDeptIds ? { id: { in: perms.scopedDeptIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  // Fetch existing interview plan
  const interviewPlan = await prisma.interviewPlan.findUnique({
    where: { positionId: id },
    include: { stages: { orderBy: { stageIndex: "asc" } } },
  })

  // Fetch org default strategy
  const org = await prisma.organization.findUnique({
    where: { id: perms.orgId },
    select: { defaultAiGenerationStrategy: true },
  })

  return (
    <PositionForm
      mode="edit"
      departments={departments}
      defaultGenerationStrategy={org?.defaultAiGenerationStrategy}
      position={position}
      existingStages={interviewPlan?.stages ?? []}
      hasPlan={!!interviewPlan}
      serverAction={updatePosition}
    />
  )
}
