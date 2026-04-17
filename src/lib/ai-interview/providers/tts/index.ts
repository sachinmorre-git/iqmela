/**
 * TTS Provider Resolver
 *
 * Returns the correct TTS provider based on a string key.
 * Add new providers here — the rest of the app never changes.
 *
 * Usage:
 *   resolveTtsProvider("browser")    → BrowserTtsProvider
 *   resolveTtsProvider("elevenlabs") → ElevenLabsTtsProvider
 *   resolveTtsProvider()             → BrowserTtsProvider (default)
 */

import type { TtsProvider } from "./types";
import { BrowserTtsProvider } from "./browser-tts";
import { ElevenLabsTtsProvider } from "./elevenlabs-tts";

export function resolveTtsProvider(providerName?: string | null): TtsProvider {
  const name = (providerName ?? "browser").toLowerCase().trim();

  switch (name) {
    case "elevenlabs":
    case "eleven_labs":
    case "eleven":
      return new ElevenLabsTtsProvider();

    case "browser":
    case "mock":
    default:
      return new BrowserTtsProvider();
  }
}

export type { TtsProvider };
export type { TtsSpeakOptions } from "./types";
