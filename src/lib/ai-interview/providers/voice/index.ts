/**
 * Voice Provider Resolver (Step 208)
 *
 * Resolves the configured STT provider based on environment variables.
 * Defaults to the free, built-in BrowserVoiceProvider ("browser").
 *
 * Can swap to Deepgram, OpenAI Realtime, AssemblyAI, or Mock for tests.
 */

import type { VoiceProvider } from "./types";
import { BrowserVoiceProvider } from "./browser-voice";
import { MockVoiceProvider } from "./mock-voice";

export function resolveVoiceProvider(): VoiceProvider {
  // Use NEXT_PUBLIC because this resolver is called in client components
  const providerName = (process.env.NEXT_PUBLIC_VOICE_PROVIDER ?? "browser").toLowerCase();

  switch (providerName) {
    case "mock":
      return new MockVoiceProvider();
    case "deepgram":
      // Stub for future production STT implementation
      console.warn("[Voice] Deepgram STT configured but not yet fully implemented. Falling back to browser.");
      return new BrowserVoiceProvider();
    case "browser":
    default:
      return new BrowserVoiceProvider();
  }
}
