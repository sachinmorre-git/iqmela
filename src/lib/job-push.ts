"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

/**
 * Job Push Service
 *
 * Handles pushing and closing jobs on external platforms.
 * Supports both Direct Connect (client OAuth) and IQMela Network (master account).
 */

interface PushResult {
  success: boolean
  externalJobId?: string
  error?: string
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

export async function pushJobToLinkedIn(
  positionId: string,
  accessToken: string,
  externalOrgId: string
): Promise<PushResult> {
  try {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: {
        title: true,
        description: true,
        jdText: true,
        location: true,
        employmentType: true,
        remotePolicy: true,
        createdAt: true,
        intakeWindowDays: true,
      },
    })

    if (!position) return { success: false, error: "Position not found" }

    const closes = new Date(position.createdAt)
    closes.setDate(closes.getDate() + position.intakeWindowDays)

    // LinkedIn Jobs Posting API payload
    const payload = {
      author: `urn:li:organization:${externalOrgId}`,
      lifecycleState: "PUBLISHED",
      title: { localized: { en_US: position.title } },
      description: {
        localized: { en_US: position.jdText || position.description || "" },
      },
      location: position.location || "United States",
      employmentStatus: mapLinkedInEmployment(position.employmentType),
      workplaceType: position.remotePolicy === "REMOTE" ? "REMOTE" : "ON_SITE",
      expiresAt: closes.getTime(),
      applyMethod: {
        companyApplyUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"}/careers/${positionId}#apply`,
      },
    }

    const response = await fetch("https://api.linkedin.com/v2/simpleJobPostings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[job-push] LinkedIn push failed:", response.status, errorBody)
      return { success: false, error: `LinkedIn API error: ${response.status}` }
    }

    // LinkedIn returns the job ID in the x-restli-id header
    const externalJobId = response.headers.get("x-restli-id") || `linkedin-${Date.now()}`

    console.log(`[job-push] ✅ LinkedIn push success: ${externalJobId}`)
    return { success: true, externalJobId }
  } catch (err) {
    console.error("[job-push] LinkedIn push error:", err)
    return { success: false, error: String(err) }
  }
}

export async function closeJobOnLinkedIn(
  externalJobId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.linkedin.com/v2/simpleJobPostings/${externalJobId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[job-push] LinkedIn close failed:", response.status, errorBody)
      return { success: false, error: `LinkedIn API error: ${response.status}` }
    }

    console.log(`[job-push] ✅ LinkedIn close success: ${externalJobId}`)
    return { success: true }
  } catch (err) {
    console.error("[job-push] LinkedIn close error:", err)
    return { success: false, error: String(err) }
  }
}

// ── Indeed ───────────────────────────────────────────────────────────────────

export async function pushJobToIndeed(
  positionId: string,
  accessToken: string,
  externalOrgId: string
): Promise<PushResult> {
  try {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: {
        title: true,
        description: true,
        jdText: true,
        location: true,
        employmentType: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        createdAt: true,
        intakeWindowDays: true,
      },
    })

    if (!position) return { success: false, error: "Position not found" }

    const closes = new Date(position.createdAt)
    closes.setDate(closes.getDate() + position.intakeWindowDays)

    const payload = {
      employer_id: externalOrgId,
      title: position.title,
      description: position.jdText || position.description || "",
      location: position.location || "United States",
      job_type: mapIndeedEmployment(position.employmentType),
      salary_min: position.salaryMin,
      salary_max: position.salaryMax,
      salary_currency: position.salaryCurrency || "USD",
      apply_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com"}/careers/${positionId}#apply`,
      expiration_date: closes.toISOString().split("T")[0],
    }

    const response = await fetch("https://apis.indeed.com/v1/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[job-push] Indeed push failed:", response.status, errorBody)
      return { success: false, error: `Indeed API error: ${response.status}` }
    }

    const result = await response.json()
    const externalJobId = result.job_id || `indeed-${Date.now()}`

    console.log(`[job-push] ✅ Indeed push success: ${externalJobId}`)
    return { success: true, externalJobId }
  } catch (err) {
    console.error("[job-push] Indeed push error:", err)
    return { success: false, error: String(err) }
  }
}

export async function closeJobOnIndeed(
  externalJobId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://apis.indeed.com/v1/jobs/${externalJobId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      return { success: false, error: `Indeed API error: ${response.status}` }
    }

    console.log(`[job-push] ✅ Indeed close success: ${externalJobId}`)
    return { success: true }
  } catch (err) {
    console.error("[job-push] Indeed close error:", err)
    return { success: false, error: String(err) }
  }
}

// ── IQMela Network (Master Account) ─────────────────────────────────────────

export async function pushJobViaNetwork(
  positionId: string,
  platform: "LINKEDIN" | "INDEED",
  clientOrgName?: string
): Promise<PushResult> {
  const masterToken =
    platform === "LINKEDIN"
      ? process.env.IQMELA_LINKEDIN_ACCESS_TOKEN
      : process.env.IQMELA_INDEED_API_KEY

  const masterId =
    platform === "LINKEDIN"
      ? process.env.IQMELA_LINKEDIN_ORG_ID
      : process.env.IQMELA_INDEED_EMPLOYER_ID

  if (!masterToken || !masterId) {
    return {
      success: false,
      error: `IQMela Network not configured for ${platform}. Missing environment variables.`,
    }
  }

  // Use the same push functions but with IQMela's master credentials
  if (platform === "LINKEDIN") {
    return pushJobToLinkedIn(positionId, masterToken, masterId)
  } else {
    return pushJobToIndeed(positionId, masterToken, masterId)
  }
}

export async function closeJobViaNetwork(
  externalJobId: string,
  platform: "LINKEDIN" | "INDEED"
): Promise<{ success: boolean; error?: string }> {
  const masterToken =
    platform === "LINKEDIN"
      ? process.env.IQMELA_LINKEDIN_ACCESS_TOKEN
      : process.env.IQMELA_INDEED_API_KEY

  if (!masterToken) {
    return { success: false, error: `Missing master ${platform} token` }
  }

  if (platform === "LINKEDIN") {
    return closeJobOnLinkedIn(externalJobId, masterToken)
  } else {
    return closeJobOnIndeed(externalJobId, masterToken)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapLinkedInEmployment(type: string | null): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME": return "FULL_TIME"
    case "PART_TIME": return "PART_TIME"
    case "CONTRACT": return "CONTRACT"
    case "INTERNSHIP": return "INTERNSHIP"
    case "TEMPORARY": return "TEMPORARY"
    default: return "FULL_TIME"
  }
}

function mapIndeedEmployment(type: string | null): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME": return "fulltime"
    case "PART_TIME": return "parttime"
    case "CONTRACT": return "contract"
    case "INTERNSHIP": return "internship"
    case "TEMPORARY": return "temporary"
    default: return "fulltime"
  }
}
