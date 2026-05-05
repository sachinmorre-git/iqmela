import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

/**
 * GET /api/integrations/indeed/authorize
 *
 * Redirects the user to Indeed's OAuth consent page.
 */
export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = process.env.INDEED_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Indeed integration is not configured. Missing INDEED_CLIENT_ID." },
      { status: 503 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"
  const redirectUri = `${baseUrl}/api/integrations/indeed/callback`
  const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString("base64url")

  const scopes = "employer_access offline_access"

  const authorizeUrl = new URL("https://secure.indeed.com/oauth/v2/authorize")
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", clientId)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("scope", scopes)

  return NextResponse.redirect(authorizeUrl.toString())
}
