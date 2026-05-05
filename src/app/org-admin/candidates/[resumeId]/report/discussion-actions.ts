"use server"

import { prisma } from "@/lib/prisma"
import { getCallerPermissions } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function postDiscussionAction(
  resumeId: string,
  positionId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions()
    if (!perms || !perms.userId) return { success: false, error: "Unauthorized" }

    // Org-scope check
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { organizationId: true },
    })
    if (!resume || resume.organizationId !== perms.orgId) {
      return { success: false, error: "Forbidden" }
    }

    if (!message.trim()) return { success: false, error: "Message cannot be empty" }

    await prisma.panelDiscussion.create({
      data: {
        resumeId,
        positionId,
        authorId: perms.userId,
        message: message.trim(),
      },
    })

    revalidatePath(`/org-admin/candidates/${resumeId}/report`)
    return { success: true }
  } catch (error) {
    console.error("[postDiscussion] Error:", error)
    return { success: false, error: "Failed to post message" }
  }
}

export async function fetchDiscussionsAction(
  resumeId: string,
  positionId: string
): Promise<{
  success: boolean
  data?: { id: string; authorName: string; message: string; createdAt: string }[]
  error?: string
}> {
  try {
    const perms = await getCallerPermissions()
    if (!perms) return { success: false, error: "Unauthorized" }

    const discussions = await prisma.panelDiscussion.findMany({
      where: { resumeId, positionId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })

    return {
      success: true,
      data: discussions.map((d) => ({
        id: d.id,
        authorName: d.author?.name || d.author?.email || "Team Member",
        message: d.message,
        createdAt: d.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    console.error("[fetchDiscussions] Error:", error)
    return { success: false, error: "Failed to load discussions" }
  }
}
