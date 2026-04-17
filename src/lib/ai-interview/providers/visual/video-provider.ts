import type { VisualProvider, VisualProviderMode, VisualPhase } from "./types";

/**
 * Video Visual Provider (Shell)
 * 
 * Handles real-time video avatar connections.
 * It takes a sub-provider (e.g. "tavus", "did", "simli") to determine
 * which underlying API and connection strategy to use.
 */
export class VideoVisualProvider implements VisualProvider {
  private _mode: VisualProviderMode;
  private _phase: VisualPhase = "ready";
  private _ready: boolean = false;
  private _streamUrl?: string;
  private _sessionId?: string;

  constructor(subProvider: "tavus" | "did" | "simli") {
    this._mode = subProvider;
  }

  getMode(): VisualProviderMode {
    return this._mode;
  }

  async init(sessionId: string, containerRef?: React.RefObject<HTMLDivElement | null>): Promise<void> {
    console.log(`[VideoVisualProvider] Initialising ${this._mode} video session for ${sessionId}...`);
    this._sessionId = sessionId;
    
    if (this._mode === "tavus") {
      try {
        const res = await fetch("/api/visual/tavus/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        
        if (!res.ok) {
          throw new Error(`Failed to init Tavus session: ${res.status}`);
        }
        
        const data = await res.json();
        this._streamUrl = data.conversationUrl || undefined;
      } catch (err) {
        console.error("[VideoVisualProvider] Tavus init failed:", err);
        throw err;
      }
    } else if (this._mode === "did") {
      try {
        const res = await fetch("/api/visual/did/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error(`Failed to init D-ID session: ${res.status}`);
      } catch (err) {
        console.error("[VideoVisualProvider] D-ID init failed:", err);
      }
    } else if (this._mode === "simli") {
      try {
        const res = await fetch("/api/visual/simli/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error(`Failed to init Simli session: ${res.status}`);
      } catch (err) {
        console.error("[VideoVisualProvider] Simli init failed:", err);
      }
    } else {
      // Fallback stub for unknown modes
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    this._ready = true;
  }

  onPhaseChange(phase: VisualPhase): void {
    this._phase = phase;
    // We would map these phases to specific provider commands if they
    // require manual state updates, e.g. telling D-ID to "listen".
  }

  async destroy(): Promise<void> {
    console.log(`[VideoVisualProvider] Destroying ${this._mode} video session...`);
    this._ready = false;
  }

  isReady(): boolean {
    return this._ready;
  }

  getStreamUrl(): string | undefined {
    return this._streamUrl;
  }

  async speak(text: string): Promise<void> {
    if (this._mode === "tavus") {
      const sessionId = this._sessionId;
      if (!sessionId) throw new Error("Missing sessionId — init() not called");
      
      const res = await fetch("/api/visual/tavus/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to send speech to Tavus: ${res.status}`);
      }
    } else if (this._mode === "did") {
      const sessionId = this._sessionId;
      if (!sessionId) throw new Error("Missing sessionId — init() not called");

      await fetch("/api/visual/did/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
      });
      // D-ID has different video generation delays vs live WebRTC streams,
      // so duration handling might need a different heuristic in the shell later.
    } else if (this._mode === "simli") {
      const sessionId = this._sessionId;
      if (!sessionId) throw new Error("Missing sessionId — init() not called");

      await fetch("/api/visual/simli/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
      });
    }
  }
}
