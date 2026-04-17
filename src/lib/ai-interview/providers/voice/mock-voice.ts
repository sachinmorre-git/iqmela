/**
 * Mock Voice Provider (Step 184)
 *
 * Used in tests and CI. Simulates transcription with a fixed delay.
 * VOICE_PROVIDER=mock
 */

import type { VoiceProvider, VoiceListenOptions } from "./types";

export class MockVoiceProvider implements VoiceProvider {
  readonly providerName = "mock";
  private _listening = false;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _startTime = 0;

  async init(): Promise<void> {}

  async startListening(options: VoiceListenOptions): Promise<void> {
    this._listening = true;
    this._startTime = Date.now();
    // Simulate a transcript arriving after 2s
    this._timer = setTimeout(() => {
      options.onTranscript({
        text: "[Mock answer] This is a simulated candidate response for testing.",
        isFinal: false,
      });
    }, 2000);
  }

  async stopListening(): Promise<import("./types").VoiceTranscriptResult> {
    if (this._timer) clearTimeout(this._timer);
    this._listening = false;
    const durationMs = Date.now() - this._startTime;
    return {
      text: "[Mock answer] This is a simulated candidate response for testing.",
      durationMs: durationMs > 0 ? durationMs : 0,
      providerName: this.providerName,
    };
  }

  async close(): Promise<void> {
    await this.stopListening();
  }

  isListening(): boolean {
    return this._listening;
  }
}
