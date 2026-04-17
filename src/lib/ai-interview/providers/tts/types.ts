/**
 * TTS Provider — interface and type definitions
 *
 * Separates text-to-speech (what the AI says) from the Avatar (visual).
 * This allows mixing any TTS engine with any avatar visual independently.
 *
 * Implementations:
 *   - BrowserTtsProvider  — free, zero setup (window.speechSynthesis)
 *   - ElevenLabsTtsProvider — high-quality, requires API key + server proxy
 */

export interface TtsSpeakOptions {
  text: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface TtsProvider {
  readonly providerName: string;

  /** Speak the given text. Resolves when audio finishes. */
  speak(options: TtsSpeakOptions): Promise<void>;

  /** Immediately cancel any in-progress speech. */
  stop(): void;

  /** Returns true if the provider is ready to speak. */
  isReady(): boolean;

  /** Optional warm-up / initialisation (e.g. validate API key). */
  init?(): Promise<void>;
}
