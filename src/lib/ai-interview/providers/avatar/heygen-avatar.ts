/**
 * HeyGen Avatar Provider Shell (Step 212)
 *
 * Implements the placeholder config footprint for HeyGen integration.
 * Final API calls to HeyGen API will live here.
 */

import type { AvatarProvider, AvatarSpeakOptions, AvatarSessionInfo } from "./types";

export class HeyGenAvatarProvider implements AvatarProvider {
  readonly providerName = "heygen";
  private _ready = false;

  async createSession(_context?: Record<string, unknown>): Promise<AvatarSessionInfo> {
    console.log("[HeyGenProvider] createSession stub called.");
    this._ready = true;
    return { sessionId: `heygen-mock-${Date.now()}` };
  }

  async speak(options: AvatarSpeakOptions): Promise<void> {
    console.log(`[HeyGenProvider] speak: "${options.text}"`);
    options.onStart?.();

    // Simulate avatar video rendering time
    return new Promise((resolve) => {
      setTimeout(() => {
        options.onEnd?.();
        resolve();
      }, options.text.length * 50 + 500);
    });
  }

  stop(): void {
    console.log("[HeyGenProvider] stop stub called.");
  }

  async destroySession(): Promise<void> {
    console.log("[HeyGenProvider] destroySession stub called.");
    this._ready = false;
  }

  isReady(): boolean {
    return this._ready;
  }
}
