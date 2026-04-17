/**
 * ElevenLabs TTS Provider
 *
 * Fetches audio from ElevenLabs via a secure server-side proxy route
 * (/api/tts/elevenlabs) so the API key is never exposed to the browser.
 * Streams audio using the Web Audio API for low latency.
 *
 * Required env vars (server-side):
 *   ELEVENLABS_API_KEY   — your ElevenLabs API key
 *   ELEVENLABS_VOICE_ID  — voice ID from ElevenLabs (default: "Rachel")
 *
 * Selected when ttsProvider prop passed to AiInterviewShell = "elevenlabs".
 */

import type { TtsProvider, TtsSpeakOptions } from "./types";

export class ElevenLabsTtsProvider implements TtsProvider {
  readonly providerName = "elevenlabs";
  private _abortController: AbortController | null = null;
  private _audioCtx: AudioContext | null = null;
  private _sourceNode: AudioBufferSourceNode | null = null;

  isReady(): boolean {
    return true; // Always ready — proxy handles auth
  }

  async speak({ text, onStart, onEnd }: TtsSpeakOptions): Promise<void> {
    this.stop(); // Cancel any in-progress speech

    this._abortController = new AbortController();

    try {
      onStart?.();

      // Call server-side proxy — never exposes the API key to the browser
      const res = await fetch("/api/tts/elevenlabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: this._abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`ElevenLabs proxy ${res.status}: ${await res.text()}`);
      }

      const arrayBuffer = await res.arrayBuffer();

      // Decode + play via Web Audio API
      if (!this._audioCtx || this._audioCtx.state === "closed") {
        this._audioCtx = new AudioContext();
      }

      if (this._audioCtx.state === "suspended") {
        await this._audioCtx.resume();
      }

      const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer);

      await new Promise<void>((resolve) => {
        const source = this._audioCtx!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this._audioCtx!.destination);
        source.onended = () => {
          onEnd?.();
          resolve();
        };
        this._sourceNode = source;
        source.start(0);
      });

    } catch (err: any) {
      if (err?.name === "AbortError") return; // Intentional stop — no callback
      console.error("[ElevenLabsTts] speak error:", err);
      onEnd?.(); // Non-fatal — interviewer continues
      throw err; // Let the shell fall back to browser TTS
    }
  }

  stop(): void {
    this._abortController?.abort();
    this._abortController = null;
    try {
      this._sourceNode?.stop();
    } catch { /* Already stopped */ }
    this._sourceNode = null;
  }
}
