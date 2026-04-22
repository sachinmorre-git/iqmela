/**
 * BGV Provider Factory
 *
 * Routes vendor type to the appropriate provider implementation.
 * Ensures a consistent interface regardless of vendor.
 */

import type { BgvVendorType } from "@prisma/client";
import type { BgvProvider } from "./types";
import { CheckrProvider } from "./providers/checkr";
import { ManualProvider } from "./providers/manual";

const providers: Partial<Record<BgvVendorType, () => BgvProvider>> = {
  CHECKR:           () => new CheckrProvider(),
  MANUAL:           () => new ManualProvider(),
  CANDIDATE_VENDOR: () => new ManualProvider(),
};

/**
 * Get the BGV provider for the given vendor type.
 *
 * @throws Error if the vendor type is not yet supported.
 */
export function getBgvProvider(type: BgvVendorType): BgvProvider {
  const factory = providers[type];
  if (!factory) {
    throw new Error(
      `BGV vendor "${type}" is not yet supported. Available: ${Object.keys(providers).join(", ")}`,
    );
  }
  return factory();
}

/**
 * Check if a vendor type has an active API integration (vs. manual upload).
 */
export function isApiVendor(type: BgvVendorType): boolean {
  return type === "CHECKR" || type === "CERTN";
}
