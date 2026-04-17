/**
 * Visual Provider Resolver
 *
 * Returns the correct visual provider based on a string key (usually from config or env).
 * Centralizes the provider selection logic.
 *
 * Usage:
 *   resolveVisualProvider("orb")    → OrbVisualProvider
 *   resolveVisualProvider("tavus")  → VideoVisualProvider("tavus")
 *   resolveVisualProvider()         → OrbVisualProvider (default)
 */

import type { VisualProvider, VisualProviderMode } from "./types";
import { OrbVisualProvider } from "./orb-provider";
import { VideoVisualProvider } from "./video-provider";

export function resolveVisualProvider(mode?: string | null): VisualProvider {
  const normMode = (mode ?? "orb").toLowerCase().trim() as string;

  switch (normMode) {
    case "tavus":
      return new VideoVisualProvider("tavus");
    case "did":
    case "d-id":
      return new VideoVisualProvider("did");
    case "simli":
      return new VideoVisualProvider("simli");
    case "orb":
    default:
      return new OrbVisualProvider();
  }
}

export type { VisualProvider, VisualProviderMode, VisualPhase } from "./types";
