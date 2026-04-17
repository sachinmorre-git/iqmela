/**
 * Avatar Provider — interface and type definitions (Step 183)
 *
 * An avatar provider controls how the AI "face" is presented to the candidate.
 * The simplest implementation uses the browser's speech synthesis (mock).
 * More advanced providers (Tavus, HeyGen) stream a realtime video avatar.
 */

export interface AvatarSpeakOptions {
  /** Text for the avatar to speak */
  text: string;
  /** Called when the avatar has finished speaking */
  onEnd?: () => void;
  /** Called when speaking starts (some providers have async warm-up) */
  onStart?: () => void;
}

export interface AvatarSessionInfo {
  sessionId: string;
  /** Provider-specific metadata (e.g., Tavus conversation_id) */
  meta?: Record<string, unknown>;
}

/**
 * Core avatar provider contract.
 * Implement this interface to add Tavus, HeyGen, or any other avatar provider.
 */
export interface AvatarProvider {
  readonly providerName: string;

  /**
   * Creates (or initialises) an avatar session before the interview begins.
   * For browser-based providers this is a no-op.
   */
  createSession(context?: Record<string, unknown>): Promise<AvatarSessionInfo>;

  /**
   * Makes the avatar speak a piece of text.
   * Returns a promise that resolves when speaking is complete.
   */
  speak(options: AvatarSpeakOptions): Promise<void>;

  /**
   * Immediately stops any in-progress speech.
   */
  stop(): void;

  /**
   * Tears down the avatar session and releases remote resources.
   */
  destroySession(): Promise<void>;

  /**
   * Returns true if the provider is ready to speak (session is live).
   */
  isReady(): boolean;
}
