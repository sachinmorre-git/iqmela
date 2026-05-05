import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

/**
 * GET /api/integrations/linkedin/authorize
 *
 * Redirects the user to LinkedIn's OAuth consent page.
 * After consent, LinkedIn redirects back to our callback URL.
 */
export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "LinkedIn integration is not configured. Missing LINKEDIN_CLIENT_ID." },
      { status: 503 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"
  const redirectUri = `${baseUrl}/api/integrations/linkedin/callback`

  // State parameter encodes orgId for CSRF protection
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString("base64url")

  const scopes = [
    "r_liteprofile",
    "w_member_social",
    "rw_organization_admin",
    "w_organization_social",
    // Talent Solutions scopes (requires partnership)
    "r_organization_social",
  ].join(" ")

  const authorizeUrl = new URL("https://www.linkedin.com/oauth/v2/authorization")
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", clientId)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("scope", scopes)

  return NextResponse.redirect(authorizeUrl.toString())
}
