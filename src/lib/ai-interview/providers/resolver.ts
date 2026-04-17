/**
 * Provider Resolver (Steps 183, 184, 186)
 *
 * Resolves the avatar and voice providers from environment variables.
 * All provider strings are read from env — no hardcoded vendor in business logic.
 *
 * Avatar: AVATAR_PROVIDER = mock | tavus | heygen (default: mock)
 * Voice:  VOICE_PROVIDER  = browser | mock         (default: browser)
 */

// ── Avatar ────────────────────────────────────────────────────────────────────

import type { AvatarProvider } from "./avatar/types";
import type { VoiceProvider } from "./voice/types";

export function resolveAvatarProvider(): AvatarProvider {
  // Only import server-safe providers here; browser-only providers are
  // instantiated client-side in AiInterviewShell.
  const provider = (
    process.env.AVATAR_PROVIDER ?? "mock"
  ).toLowerCase();

  switch (provider) {
    case "tavus": {
      // Tavus is browser/server hybrid — dynamic import to avoid SSR issues
      const { TavusAvatarProvider } = require("./avatar/tavus-avatar");
      return new TavusAvatarProvider();
    }
    case "heygen": {
      const { HeyGenAvatarProvider } = require("./avatar/heygen-avatar");
      return new HeyGenAvatarProvider();
    }
    case "mock":
    default: {
      // MockAvatarProvider uses browser speechSynthesis — instantiate client-side
      // This function is also callable server-side for provider name checks
      const { MockAvatarProvider } = require("./avatar/mock-avatar");
      return new MockAvatarProvider();
    }
  }
}

export function resolveVoiceProvider(): VoiceProvider {
  const provider = (
    process.env.VOICE_PROVIDER ?? "browser"
  ).toLowerCase();

  switch (provider) {
    case "mock": {
      const { MockVoiceProvider } = require("./voice/mock-voice");
      return new MockVoiceProvider();
    }
    case "browser":
    default: {
      const { BrowserVoiceProvider } = require("./voice/browser-voice");
      return new BrowserVoiceProvider();
    }
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

/** Returns the configured avatar provider name (for display or logging) */
export function getAvatarProviderName(): string {
  return process.env.AVATAR_PROVIDER ?? "mock";
}

/** Returns the configured voice provider name */
export function getVoiceProviderName(): string {
  return process.env.VOICE_PROVIDER ?? "browser";
}

/** Returns the configured scoring provider name */
export function getScoringProviderName(): string {
  return process.env.SCORING_PROVIDER ?? process.env.AI_PROVIDER ?? "gemini";
}

export type { AvatarProvider } from "./avatar/types";
export type { VoiceProvider } from "./voice/types";
