/**
 * BGV Package Definitions
 *
 * Client-safe static data. No Node.js crypto, no API calls.
 * Imported by BgvDrawerView (client component) to display package options.
 */

import type { BgvVendorType } from "@prisma/client";
import type { BgvPackage } from "./types";

// ── Checkr Packages ─────────────────────────────────────────────────────────

export const CHECKR_PACKAGES: BgvPackage[] = [
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

// ── Manual Package ──────────────────────────────────────────────────────────

export const MANUAL_PACKAGES: BgvPackage[] = [
  {
    slug: "manual_upload",
    label: "Manual Upload",
    description: "Upload a completed background check report from any vendor",
    checks: ["custom"],
    estimatedDays: 0,
    priceCents: 0,
  },
];

// ── Package lookup by vendor type ───────────────────────────────────────────

const VENDOR_PACKAGES: Record<string, BgvPackage[]> = {
  CHECKR: CHECKR_PACKAGES,
  MANUAL: MANUAL_PACKAGES,
  CANDIDATE_VENDOR: MANUAL_PACKAGES,
  CERTN: [], // Coming soon
};

/**
 * Get packages for a given vendor type.
 * Client-safe: no Node.js dependencies, pure data lookup.
 */
export function getPackagesForVendor(type: BgvVendorType): BgvPackage[] {
  return VENDOR_PACKAGES[type] || [];
}
