/**
 * BGV Provider Abstraction Layer — Core Types
 *
 * Vendor-agnostic types used by all BGV providers (Checkr, Certn, Manual).
 * IQMela NEVER handles SSNs, DOB, or any sensitive PII.
 * We only send: firstName, lastName, email, workLocation.
 */

import type { BgvStatus, BgvAdjudication } from "@prisma/client";

// ── Candidate data we send to vendors ───────────────────────────────────────

export interface BgvCandidate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  workLocation: string; // US state code or country code
  // ⚠️ NO SSN. NO DOB. Never touched by IQMela.
}

// ── Package definitions ─────────────────────────────────────────────────────

export interface BgvPackage {
  slug: string;
  label: string;
  description: string;
  checks: string[];          // ["criminal", "education", "employment", "mvr", "credit"]
  estimatedDays: number;     // Avg turnaround in business days
  priceCents: number;        // Cost in cents (e.g., 4900 = $49.00)
  recommended?: boolean;     // UI badge: "⭐ Recommended"
}

// ── Provider responses ──────────────────────────────────────────────────────

export interface BgvInitiateResult {
  vendorCheckId: string;     // External vendor ID to track
  invitationUrl?: string;    // Checkr-hosted URL for candidate consent
  status: string;            // Vendor's initial status string
}

export interface BgvCheckResult {
  checkType: string;         // "criminal", "education", "employment", "mvr", "credit"
  status: "clear" | "consider" | "pending" | "error";
  summary: string;           // "No records found" / "Verified: MIT, BS CS, 2018"
  details?: string;          // Extended info if available
}

export interface BgvStatusResult {
  status: string;            // Vendor's raw status string
  mappedStatus: BgvStatus;   // Our normalized status enum
  adjudication?: BgvAdjudication;
  completedAt?: string;
  reportAvailable: boolean;
  checkResults?: BgvCheckResult[];
}

// ── Webhook events ──────────────────────────────────────────────────────────

export interface BgvWebhookEvent {
  type: string;              // "report.completed", "invitation.completed"
  vendorCheckId: string;
  status: string;
  adjudication?: string;
  data?: Record<string, unknown>;
}

// ── Provider interface ──────────────────────────────────────────────────────

export interface BgvProvider {
  name: string;

  /** Available packages for this vendor */
  getPackages(): BgvPackage[];

  /**
   * Initiate a background check.
   * For Checkr: creates candidate + sends invitation.
   * For Manual: generates upload link token.
   */
  initiate(
    candidate: BgvCandidate,
    packageSlug: string,
    orgApiKey: string,
  ): Promise<BgvInitiateResult>;

  /**
   * Get current status of a check from the vendor.
   * For Checkr: GET /v1/reports/{id}
   * For Manual: checks DB for upload status
   */
  getStatus(
    vendorCheckId: string,
    orgApiKey: string,
  ): Promise<BgvStatusResult>;

  /**
   * Download the completed report PDF from the vendor.
   * Returns Buffer for R2 storage, or null if not yet available.
   */
  downloadReport(
    vendorCheckId: string,
    orgApiKey: string,
  ): Promise<Buffer | null>;

  /**
   * Parse an incoming webhook payload from this vendor.
   * Returns null if signature validation fails.
   */
  parseWebhook(
    payload: unknown,
    signature: string,
    secret: string,
  ): Promise<BgvWebhookEvent | null>;
}
