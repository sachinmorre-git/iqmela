import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

/**
 * GET /api/integrations/linkedin/callback
 *
 * Handles the OAuth callback from LinkedIn.
 * Exchanges the authorization code for access/refresh tokens.
 * Stores them in the OrgIntegration table.
 */
export async function GET(req: NextRequest) {
  const { orgId, userId } = await auth()
  if (!orgId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=unauthorized`
    )
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const error = req.nextUrl.searchParams.get("error")

  if (error || !code) {
    console.error("[LinkedIn OAuth] Error or no code:", error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=linkedin_denied`
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

  // Exchange code for tokens
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"
  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/integrations/linkedin/callback`,
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    }),
  })

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text()
    console.error("[LinkedIn OAuth] Token exchange failed:", errText)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?error=token_exchange_failed`
    )
  }

  const tokens = await tokenResponse.json()

  // Fetch organization details
  let externalOrgId: string | null = null
  let externalOrgName: string | null = null

  try {
    const profileRes = await fetch(
      "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&projection=(elements*(organizationalTarget))",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    if (profileRes.ok) {
      const profileData = await profileRes.json()
      const firstOrg = profileData.elements?.[0]?.organizationalTarget
      if (firstOrg) {
        externalOrgId = firstOrg.replace("urn:li:organization:", "")
        // Fetch org name
        const orgRes = await fetch(
          `https://api.linkedin.com/v2/organizations/${externalOrgId}`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        )
        if (orgRes.ok) {
          const orgData = await orgRes.json()
          externalOrgName = orgData.localizedName || null
        }
      }
    }
  } catch (e) {
    console.warn("[LinkedIn OAuth] Could not fetch org details:", e)
  }

  // Store in database
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null

  await prisma.orgIntegration.upsert({
    where: { organizationId_platform: { organizationId: orgId, platform: "LINKEDIN" } },
    create: {
      organizationId: orgId,
      platform: "LINKEDIN",
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

  console.log(`[LinkedIn OAuth] ✅ Connected for org ${orgId} → ${externalOrgName || "Unknown"}`)

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/org-admin/settings?success=linkedin_connected`
  )
}
