/**
 * Avatar Provider Resolver (Step 212)
 *
 * Resolves the configured avatar provider based on the specified name.
 * Defaults to the free MockAvatarProvider (browser TTS).
 */

import type { AvatarProvider } from "./types";
import { MockAvatarProvider } from "./mock-avatar";
import { TavusAvatarProvider } from "./tavus-avatar";
import { HeyGenAvatarProvider } from "./heygen-avatar";

export function resolveAvatarProvider(providerName?: string): AvatarProvider {
  const name = (providerName ?? "mock").toLowerCase();

  switch (name) {
    case "tavus":
      return new TavusAvatarProvider();
    case "heygen":
      return new HeyGenAvatarProvider();
    case "mock":
    default:
      return new MockAvatarProvider();
  }
}
