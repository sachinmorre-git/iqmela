/**
 * Checkr BGV Provider — Invitation Flow
 *
 * Uses the Checkr-hosted flow where Checkr handles all PII collection.
 * IQMela only sends: firstName, lastName, email, workLocation.
 *
 * API Flow:
 * 1. POST /v1/candidates → create candidate
 * 2. POST /v1/invitations → Checkr emails candidate consent form
 * 3. Webhook: invitation.completed → candidate finished
 * 4. Webhook: report.completed → checks done
 * 5. GET /v1/reports/{id} → fetch results
 */

import { BgvStatus, BgvAdjudication } from "@prisma/client";
import type {
  BgvProvider,
  BgvCandidate,
  BgvPackage,
  BgvInitiateResult,
  BgvStatusResult,
  BgvCheckResult,
  BgvWebhookEvent,
} from "../types";
import crypto from "crypto";

// ── Checkr API base ─────────────────────────────────────────────────────────

const CHECKR_API_BASE = "https://api.checkr.com";

// ── Package definitions ─────────────────────────────────────────────────────

const CHECKR_PACKAGES: BgvPackage[] = [
  {
    slug: "tasker_standard",
    label: "Basic Criminal",
    description: "SSN trace + national criminal search",
    checks: ["ssn_trace", "national_criminal"],
    estimatedDays: 1,
    priceCents: 2900,
  },
  {
    slug: "driver_standard",
    label: "Standard",
    description: "Criminal, county records, and sex offender search",
    checks: ["ssn_trace", "national_criminal", "county_criminal", "sex_offender"],
    estimatedDays: 3,
    priceCents: 4900,
    recommended: true,
  },
  {
    slug: "driver_pro",
    label: "Professional",
    description: "Full criminal + education and employment verification",
    checks: [
      "ssn_trace", "national_criminal", "county_criminal", "sex_offender",
      "global_watchlist", "education_verification", "employment_verification",
    ],
    estimatedDays: 5,
    priceCents: 7900,
  },
  {
    slug: "driver_plus",
    label: "Executive",
    description: "Comprehensive: criminal, education, employment, credit, and driving record",
    checks: [
      "ssn_trace", "national_criminal", "county_criminal", "sex_offender",
      "global_watchlist", "education_verification", "employment_verification",
      "credit_report", "motor_vehicle_report",
    ],
    estimatedDays: 7,
    priceCents: 14900,
  },
];

// ── Status mapping ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, BgvStatus> = {
  pending:   BgvStatus.IN_PROGRESS,
  clear:     BgvStatus.CLEAR,
  consider:  BgvStatus.CONSIDER,
  suspended: BgvStatus.IN_PROGRESS,
  dispute:   BgvStatus.DISPUTE_PERIOD,
  complete:  BgvStatus.COMPLETED,
};

const ADJUDICATION_MAP: Record<string, BgvAdjudication> = {
  engaged:        BgvAdjudication.CLEAR,
  pre_adverse:    BgvAdjudication.CONSIDER,
  adverse_action: BgvAdjudication.ADVERSE,
};

// ── Helper: Checkr API call ─────────────────────────────────────────────────

async function checkrFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<T> {
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch(`${CHECKR_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Checkr API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Type definitions for Checkr API responses ───────────────────────────────

interface CheckrCandidate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface CheckrInvitation {
  id: string;
  status: string;
  invitation_url: string;
  candidate_id: string;
  report_id?: string;
}

interface CheckrScreening {
  id: string;
  type: string;
  status: string;
  result?: string;
  completed_at?: string;
}

interface CheckrReport {
  id: string;
  status: string;
  adjudication: string | null;
  completed_at: string | null;
  candidate_id: string;
  package: string;
  screenings: CheckrScreening[];
}

// ── Provider implementation ─────────────────────────────────────────────────

export class CheckrProvider implements BgvProvider {
  name = "Checkr";

  getPackages(): BgvPackage[] {
    return CHECKR_PACKAGES;
  }

  async initiate(
    candidate: BgvCandidate,
    packageSlug: string,
    orgApiKey: string,
  ): Promise<BgvInitiateResult> {
    // 1. Create candidate on Checkr
    const checkrCandidate = await checkrFetch<CheckrCandidate>("/v1/candidates", orgApiKey, {
      method: "POST",
      body: JSON.stringify({
        first_name: candidate.firstName,
        last_name: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone || undefined,
        work_locations: [{ state: candidate.workLocation, country: "US" }],
        // ⚠️ NO SSN, NO DOB — Checkr collects this on their hosted page
      }),
    });

    // 2. Create invitation — Checkr sends email to candidate
    const invitation = await checkrFetch<CheckrInvitation>("/v1/invitations", orgApiKey, {
      method: "POST",
      body: JSON.stringify({
        candidate_id: checkrCandidate.id,
        package: packageSlug,
        work_locations: [{ state: candidate.workLocation, country: "US" }],
      }),
    });

    return {
      vendorCheckId: invitation.report_id || invitation.id,
      invitationUrl: invitation.invitation_url,
      status: invitation.status,
    };
  }

  async getStatus(vendorCheckId: string, orgApiKey: string): Promise<BgvStatusResult> {
    const report = await checkrFetch<CheckrReport>(`/v1/reports/${vendorCheckId}`, orgApiKey);

    const checkResults: BgvCheckResult[] = (report.screenings || []).map((s) => ({
      checkType: s.type.replace(/_/g, " "),
      status: (s.status === "clear" ? "clear" : s.status === "consider" ? "consider" : "pending") as BgvCheckResult["status"],
      summary: s.result || s.status,
      details: s.completed_at ? `Completed: ${s.completed_at}` : undefined,
    }));

    return {
      status: report.status,
      mappedStatus: STATUS_MAP[report.status] || BgvStatus.IN_PROGRESS,
      adjudication: report.adjudication ? ADJUDICATION_MAP[report.adjudication] : undefined,
      completedAt: report.completed_at || undefined,
      reportAvailable: report.status === "complete" || report.status === "consider" || report.status === "clear",
      checkResults,
    };
  }

  async downloadReport(vendorCheckId: string, orgApiKey: string): Promise<Buffer | null> {
    try {
      const auth = Buffer.from(`${orgApiKey}:`).toString("base64");
      const res = await fetch(`${CHECKR_API_BASE}/v1/reports/${vendorCheckId}/download`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  async parseWebhook(
    payload: unknown,
    signature: string,
    secret: string,
  ): Promise<BgvWebhookEvent | null> {
    // Validate HMAC-SHA256 signature
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      console.error("[CheckrWebhook] Signature mismatch");
      return null;
    }

    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    const event = data as { type?: string; data?: { object?: { id?: string; status?: string; adjudication?: string } } };

    if (!event.type || !event.data?.object?.id) return null;

    return {
      type: event.type,
      vendorCheckId: event.data.object.id,
      status: event.data.object.status || "unknown",
      adjudication: event.data.object.adjudication || undefined,
      data: event.data.object as Record<string, unknown>,
    };
  }
}
