import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

/**
 * POST /api/integrations/indeed/disconnect
 */
export async function POST() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.orgIntegration.update({
      where: { organizationId_platform: { organizationId: orgId, platform: "INDEED" } },
      data: { status: "REVOKED", accessToken: "REVOKED", refreshToken: null },
    })

    console.log(`[Indeed] Disconnected for org ${orgId}`)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "No Indeed integration found" }, { status: 404 })
  }
}
