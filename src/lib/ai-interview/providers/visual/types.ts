/**
 * Visual Provider — interface and type definitions
 *
 * This layer separates the visual representation of the AI interviewer
 * from the interview logic. It supports two main modes:
 * - "orb": An animated, non-human visual component
 * - "video": Real-time video avatars (e.g., Tavus, D-ID, Simli)
 */

export type VisualProviderMode = "orb" | "tavus" | "did" | "simli";

// The interview phases that affect visual state
export type VisualPhase =
  | "loading"
  | "ready"
  | "asking"
  | "listening"
  | "processing"
  | "scoring"
  | "results"
  | "error";

export interface VisualProvider {
  /** Returns the mode of this visual provider */
  getMode(): VisualProviderMode;

  /**
   * Initialise the provider.
   * For video avatars, this might create a streaming session.
   * @param containerRef An optional reference to the DOM element where video might be mounted.
   */
  init(sessionId: string, containerRef?: React.RefObject<HTMLDivElement | null>): Promise<void>;

  /**
   * Called whenever the interview phase changes, so the visual can update its state.
   * e.g. orb starts pulsing, or video character enters "listening" state.
   */
  onPhaseChange(phase: VisualPhase): void;

  /**
   * Clean up resources, like WebRTC connections or ongoing animations.
   */
  destroy(): Promise<void>;

  /**
   * Returns true if the visual provider is fully initialised and ready to render.
   */
  isReady(): boolean;

  /**
   * Optional URL for iframe or WebRTC stream endpoints (used by video avatars).
   */
  getStreamUrl?(): string | undefined;

  /**
   * Speak a question (used by video avatars that bypass normal TTS)
   */
  speak?(text: string): Promise<void>;
}
