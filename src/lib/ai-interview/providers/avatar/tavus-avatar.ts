/**
 * Tavus Avatar Provider Shell (Step 212)
 *
 * Implements the placeholder config footprint for Tavus integration.
 * Final API calls to Tavus network will live here.
 */

import type { AvatarProvider, AvatarSpeakOptions, AvatarSessionInfo } from "./types";

export class TavusAvatarProvider implements AvatarProvider {
  readonly providerName = "tavus";
  private _ready = false;

  async createSession(_context?: Record<string, unknown>): Promise<AvatarSessionInfo> {
    console.log("[TavusProvider] createSession stub called.");
    this._ready = true;
    return { sessionId: `tavus-mock-${Date.now()}` };
  }

  async speak(options: AvatarSpeakOptions): Promise<void> {
    console.log(`[TavusProvider] speak: "${options.text}"`);
    options.onStart?.();

    // Simulate avatar video rendering time
    return new Promise((resolve) => {
      setTimeout(() => {
        options.onEnd?.();
        resolve();
      }, options.text.length * 50 + 500); // 50ms per character rough timing
    });
  }

  stop(): void {
    console.log("[TavusProvider] stop stub called.");
  }

  async destroySession(): Promise<void> {
    console.log("[TavusProvider] destroySession stub called.");
    this._ready = false;
  }

  isReady(): boolean {
    return this._ready;
  }
}
