import type { VisualProvider, VisualProviderMode, VisualPhase } from "./types";

/**
 * Orb Visual Provider
 * 
 * Provides the non-human animated orb visual.
 * This is primarily driven by React state and CSS, so this provider
 * mostly acts as a stub that confirms it's ready immediately.
 */
export class OrbVisualProvider implements VisualProvider {
  private _phase: VisualPhase = "ready";

  getMode(): VisualProviderMode {
    return "orb";
  }

  async init(_sessionId: string): Promise<void> {
    // Nothing to initialise for the pure React orb
    return Promise.resolve();
  }

  onPhaseChange(phase: VisualPhase): void {
    this._phase = phase;
  }

  async destroy(): Promise<void> {
    // Nothing to tear down
    return Promise.resolve();
  }

  isReady(): boolean {
    return true; // Always ready
  }

  getStreamUrl(): string | undefined {
    return undefined;
  }
}
