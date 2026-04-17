/**
 * Browser TTS Provider
 *
 * Uses the browser's built-in window.speechSynthesis API.
 * Zero cost, zero API key, zero setup.
 * Works in Chrome, Safari, Edge. Quality varies by OS voice pack.
 *
 * Selected as default when TTS_PROVIDER is unset or "browser".
 */

import type { TtsProvider, TtsSpeakOptions } from "./types";

export class BrowserTtsProvider implements TtsProvider {
  readonly providerName = "browser";
  private _utterance: SpeechSynthesisUtterance | null = null;

  isReady(): boolean {
    return typeof window !== "undefined" && !!window.speechSynthesis;
  }

  async speak({ text, onStart, onEnd }: TtsSpeakOptions): Promise<void> {
    if (!this.isReady()) {
      onEnd?.();
      return;
    }

    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.05;
      utter.volume = 1;

      // Wait for voices to load (async in some browsers)
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Samantha") ||
              v.name.includes("Alex") ||
              v.name.includes("Karen") ||
              v.name.includes("Daniel"))
        );
        if (preferred) utter.voice = preferred;

        utter.onstart = () => onStart?.();
        utter.onend = () => {
          onEnd?.();
          resolve();
        };
        utter.onerror = () => {
          onEnd?.();
          resolve(); // non-fatal
        };

        this._utterance = utter;
        window.speechSynthesis.speak(utter);
      };

      // Voices may not be available immediately on first load
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoiceAndSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          setVoiceAndSpeak();
        };
        // Fallback if event never fires (Firefox)
        setTimeout(setVoiceAndSpeak, 300);
      }
    });
  }

  stop(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this._utterance = null;
  }
}
