/**
 * Manual BGV Provider
 *
 * Handles the manual upload workflow for organizations that:
 * 1. Use a vendor without API integration
 * 2. Want the candidate's own agency to upload the report
 * 3. Want to upload a previously obtained report themselves
 *
 * Generates a secure upload link (token-based) that can be shared externally.
 */

import { BgvStatus } from "@prisma/client";
import type {
  BgvProvider,
  BgvCandidate,
  BgvPackage,
  BgvInitiateResult,
  BgvStatusResult,
  BgvWebhookEvent,
} from "../types";
import crypto from "crypto";

// ── Package ─────────────────────────────────────────────────────────────────

const MANUAL_PACKAGES: BgvPackage[] = [
  {
    slug: "manual_upload",
    label: "Manual Upload",
    description: "Upload a completed BGV report from any vendor or agency",
    checks: ["manual"],
    estimatedDays: 0,
    priceCents: 0,
  },
  {
    slug: "candidate_vendor",
    label: "Candidate's Vendor",
    description: "Share a secure link with the candidate or their agency to upload the BGV report",
    checks: ["third_party_upload"],
    estimatedDays: 0,
    priceCents: 0,
  },
];

// ── Provider implementation ─────────────────────────────────────────────────

export class ManualProvider implements BgvProvider {
  name = "Manual Upload";

  getPackages(): BgvPackage[] {
    return MANUAL_PACKAGES;
  }

  async initiate(
    _candidate: BgvCandidate,
    _packageSlug: string,
    _orgApiKey: string,
  ): Promise<BgvInitiateResult> {
    // Generate a cryptographic upload token
    const uploadToken = crypto.randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const uploadUrl = `${appUrl}/bgv-upload/${uploadToken}`;

    return {
      vendorCheckId: uploadToken, // We use the token as vendorCheckId
      invitationUrl: uploadUrl,   // The shareable upload link
      status: "awaiting_upload",
    };
  }

  async getStatus(
    _vendorCheckId: string,
    _orgApiKey: string,
  ): Promise<BgvStatusResult> {
    // For manual uploads, status is determined from the DB record directly.
    // This is called as a fallback — the drawer reads from the BgvCheck record.
    return {
      status: "awaiting_upload",
      mappedStatus: BgvStatus.INITIATED,
      reportAvailable: false,
    };
  }

  async downloadReport(
    _vendorCheckId: string,
    _orgApiKey: string,
  ): Promise<Buffer | null> {
    // Manual uploads are stored in R2 directly — no vendor download needed.
    return null;
  }

  async parseWebhook(
    _payload: unknown,
    _signature: string,
    _secret: string,
  ): Promise<BgvWebhookEvent | null> {
    // Manual provider has no webhooks
    return null;
  }
}
