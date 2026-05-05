import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

/**
 * GET /api/integrations/indeed/callback
 *
 * Handles the OAuth callback from Indeed.
 */
export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=unauthorized`
    )
  }

  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  const state = req.nextUrl.searchParams.get("state")

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=indeed_denied`
    )
  }

  // Validate state
  try {
    const decoded = JSON.parse(Buffer.from(state || "", "base64url").toString())
    if (decoded.orgId !== orgId) throw new Error("State mismatch")
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=invalid_state`
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"
  const tokenResponse = await fetch("https://apis.indeed.com/oauth/v2/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/integrations/indeed/callback`,
      client_id: process.env.INDEED_CLIENT_ID || "",
      client_secret: process.env.INDEED_CLIENT_SECRET || "",
    }),
  })

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text()
    console.error("[Indeed OAuth] Token exchange failed:", errText)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=token_exchange_failed`
    )
  }

  const tokens = await tokenResponse.json()

  // Fetch employer info
  let externalOrgId: string | null = null
  let externalOrgName: string | null = null

  try {
    const empRes = await fetch("https://apis.indeed.com/v1/employer", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (empRes.ok) {
      const empData = await empRes.json()
      externalOrgId = empData.id || null
      externalOrgName = empData.name || null
    }
  } catch (e) {
    console.warn("[Indeed OAuth] Could not fetch employer details:", e)
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null

  await prisma.orgIntegration.upsert({
    where: { organizationId_platform: { organizationId: orgId, platform: "INDEED" } },
    create: {
      organizationId: orgId,
      platform: "INDEED",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: expiresAt,
      externalOrgId,
      externalOrgName,
      connectedBy: userId || null,
      status: "ACTIVE",
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: expiresAt,
      externalOrgId,
      externalOrgName,
      connectedBy: userId || null,
      status: "ACTIVE",
    },
  })

  console.log(`[Indeed OAuth] ✅ Connected for org ${orgId} → ${externalOrgName || "Unknown"}`)

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?success=indeed_connected`
  )
}
