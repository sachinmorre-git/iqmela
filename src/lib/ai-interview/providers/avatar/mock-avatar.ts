/**
 * Mock Avatar Provider (Step 183)
 *
 * Uses the browser's built-in speechSynthesis API.
 * Zero cost, zero setup — works in Chrome, Safari, Edge.
 * This is the default when AVATAR_PROVIDER=mock (or unset).
 */

import type { AvatarProvider, AvatarSpeakOptions, AvatarSessionInfo } from "./types";

export class MockAvatarProvider implements AvatarProvider {
  readonly providerName = "mock";
  private _ready = false;
  private _utterance: SpeechSynthesisUtterance | null = null;

  async createSession(_context?: Record<string, unknown>): Promise<AvatarSessionInfo> {
    this._ready = true;
    return { sessionId: `mock-${Date.now()}` };
  }

  async speak({ text, onStart, onEnd }: AvatarSpeakOptions): Promise<void> {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }

    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.05;
      utter.volume = 1;

      // Prefer a natural-sounding English voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Alex"))
      );
      if (preferred) utter.voice = preferred;

      utter.onstart = () => onStart?.();
      utter.onend = () => {
        onEnd?.();
        resolve();
      };
      utter.onerror = () => resolve(); // non-fatal

      this._utterance = utter;
      window.speechSynthesis.speak(utter);
    });
  }

  stop(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this._utterance = null;
  }

  async destroySession(): Promise<void> {
    this.stop();
    this._ready = false;
  }

  isReady(): boolean {
    return this._ready;
  }
}
