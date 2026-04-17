/**
 * Browser Voice Provider (Step 184)
 *
 * Uses the Web Speech API (SpeechRecognition) for candidate STT.
 * Free, no API key, works in Chrome/Edge/Safari.
 * Fallback: if speech recognition is unavailable, sets permissionDenied.
 *
 * VOICE_PROVIDER=browser (or unset)
 */

import type { VoiceProvider, VoiceListenOptions, VoiceTranscriptResult } from "./types";

export class BrowserVoiceProvider implements VoiceProvider {
  readonly providerName = "browser";
  private recognition: any = null;
  private _listening = false;
  private _transcript = "";
  private _startTime = 0;
  private _confidence = 0;

  async init(): Promise<void> {
    // No async setup needed — browser API is always available if the browser supports it
  }

  async startListening(options: VoiceListenOptions): Promise<void> {
    if (typeof window === "undefined") return;

    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      options.onPermissionDenied?.();
      return;
    }

    this._transcript = "";
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.language ?? "en-US";

    recognition.onresult = (event: any) => {
      let combined = "";
      let confidenceSum = 0;
      let confCount = 0;

      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript + " ";
        if (event.results[i][0].confidence > 0) {
          confidenceSum += event.results[i][0].confidence;
          confCount++;
        }
      }
      this._transcript = combined.trim();
      if (confCount > 0) {
        this._confidence = confidenceSum / confCount;
      }

      const isFinal = event.results[event.results.length - 1]?.isFinal ?? false;
      options.onTranscript({ text: this._transcript, isFinal });
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        options.onPermissionDenied?.();
      } else {
        options.onError?.(new Error(`SpeechRecognition error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      this._listening = false;
    };

    this.recognition = recognition;
    this._listening = true;
    this._startTime = Date.now();
    this._confidence = 0;
    recognition.start();
  }

  async stopListening(): Promise<VoiceTranscriptResult> {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this._listening = false;
    const durationMs = Date.now() - this._startTime;

    return {
      text: this._transcript,
      durationMs: durationMs > 0 ? durationMs : 0,
      confidence: this._confidence > 0 ? this._confidence : undefined,
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
