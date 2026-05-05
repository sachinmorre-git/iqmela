"use server"

import { prisma } from "@/lib/prisma"
import { getCallerPermissions } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export interface PositionSettingsInput {
  intakeWindowDays: number
  atsPreScreenSize: number
  aiShortlistSize: number
  autoProcessOnClose: boolean
  autoInviteAiScreen: boolean
  resumePurgeDays: number
}

export async function updatePositionSettingsAction(
  positionId: string,
  data: PositionSettingsInput
): Promise<{ success: boolean; error?: string }> {
  const perms = await getCallerPermissions()
  if (!perms?.canManagePositions) return { success: false, error: "Unauthorized" }

  try {
    await prisma.position.update({
      where: { id: positionId },
      data: {
        intakeWindowDays: Math.max(1, Math.min(90, data.intakeWindowDays)),
        atsPreScreenSize: Math.max(10, Math.min(1000, data.atsPreScreenSize)),
        aiShortlistSize: Math.max(1, Math.min(100, data.aiShortlistSize)),
        autoProcessOnClose: data.autoProcessOnClose,
        autoInviteAiScreen: data.autoInviteAiScreen,
        resumePurgeDays: Math.max(7, Math.min(365, data.resumePurgeDays)),
      },
    })
    revalidatePath(`/org-admin/positions/${positionId}`)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
