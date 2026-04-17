/**
 * Voice Provider — interface and type definitions (Step 184)
 *
 * A voice provider handles the candidate's speech input side of the interview.
 * It captures audio, transcribes it to text, and exposes that text to the app.
 *
 * The default implementation uses the browser's Web Speech API (free).
 * More advanced providers (Deepgram, OpenAI Realtime, AssemblyAI) use
 * server-side streaming STT for higher accuracy and cross-browser support.
 */

export interface VoiceTranscriptEvent {
  /** The current transcription (may be partial / interim) */
  text: string;
  /** True if this is a final (committed) result, false if still streaming */
  isFinal: boolean;
}

export interface VoiceListenOptions {
  /** Language BCP-47 tag, e.g. "en-US" */
  language?: string;
  /** Called on every transcript update (including interim results) */
  onTranscript: (event: VoiceTranscriptEvent) => void;
  /** Called when microphone access is denied */
  onPermissionDenied?: () => void;
  /** Called on any other error */
  onError?: (error: Error) => void;
}

export interface VoiceTranscriptResult {
  text: string;
  durationMs: number;
  confidence?: number;
  providerName: string;
}

/**
 * Core Voice Provider contract.
 * Implement this interface to add Deepgram, OpenAI Realtime, or any other STT.
 */
export interface VoiceProvider {
  readonly providerName: string;

  /**
   * Initialises the provider (connect WebSocket, request mic permission, etc.)
   * Called once before the first question.
   */
  init(): Promise<void>;

  /**
   * Starts listening for candidate speech.
   * Transcripts are delivered via the onTranscript callback in options.
   */
  startListening(options: VoiceListenOptions): Promise<void>;

  /**
   * Stops the current listening session and returns the final combined transcript logic and audio metadata.
   */
  stopListening(): Promise<VoiceTranscriptResult>;

  /**
   * Completely tears down the provider (close WebSocket, release mic).
   */
  close(): Promise<void>;

  /**
   * Returns true if the provider is currently recording audio.
   */
  isListening(): boolean;
}
