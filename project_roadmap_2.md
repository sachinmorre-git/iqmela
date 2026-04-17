# Project Roadmap 2 — Modular AI Interview Visual Layer

## Goal
Make the AI interview visual layer fully modular so it supports two modes:

| Mode | What candidate sees | When to use |
|------|---------------------|-------------|
| **Orb** | Animated glowing circle (current) | Default, free, no API needed |
| **Video Avatar** | Real-time talking face (Tavus / D-ID / Simli) | Premium clients who want a visible AI interviewer |

Switching between modes should be **one config change** — per position or globally via `.env`. No code changes required.

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │      AiInterviewShell         │
                    │                               │
                    │   resolveVisualProvider()      │
                    │          ↓                    │
                    │  ┌───────────────────────┐    │
                    │  │   VisualProvider API   │    │
                    │  └───────────────────────┘    │
                    │       ↙          ↘             │
                    │  OrbProvider  VideoProvider    │
                    │  (built-in)   (Tavus/D-ID/    │
                    │               Simli)          │
                    └─────────────────────────────┘
```

**Key principle:** The shell calls `visualProvider.render()` and `visualProvider.onPhaseChange(phase)`. It never knows which one is active. Switching = changing one string in config.

---

## Implementation Steps

### Phase 1 — Define the Interface (Foundation)

**Step 231 — Create `VisualProvider` interface**
- Create `src/lib/ai-interview/providers/visual/types.ts`
- Interface methods:
  - `getMode(): "orb" | "video"`
  - `init(containerRef): Promise<void>` — mount/setup
  - `onPhaseChange(phase: InterviewPhase): void` — update visual state
  - `destroy(): Promise<void>` — cleanup
  - `isReady(): boolean`
- Export `VisualProviderMode = "orb" | "tavus" | "did" | "simli"`

---

**Step 232 — Create `OrbVisualProvider`**
- Create `src/lib/ai-interview/providers/visual/orb-provider.ts`
- Wraps the existing `AvatarOrb` component logic as a provider class
- `getMode()` returns `"orb"`
- `onPhaseChange()` updates internal state that drives orb animations
- `init()` / `destroy()` are no-ops (pure React render, no external session)

---

**Step 233 — Create `VideoVisualProvider` shell**
- Create `src/lib/ai-interview/providers/visual/video-provider.ts`
- Accepts `subProvider: "tavus" | "did" | "simli"` in constructor
- `init()` — placeholder: logs which sub-provider was selected
- `onPhaseChange()` — placeholder
- `destroy()` — placeholder
- `isReady()` → false until real API is wired

---

**Step 234 — Create `VisualProvider` resolver**
- Create `src/lib/ai-interview/providers/visual/index.ts`
- `resolveVisualProvider(mode?: string): VisualProvider`
  - `"orb"` or unset → `OrbVisualProvider`
  - `"tavus"` → `VideoVisualProvider("tavus")`
  - `"did"` → `VideoVisualProvider("did")`
  - `"simli"` → `VideoVisualProvider("simli")`
  - Any failure → fallback to `OrbVisualProvider`

---

### Phase 2 — Refactor Shell to Use Provider

**Step 235 — Add `visualMode` prop to `AiInterviewShell`**
- Add `visualMode?: string` to props + destructuring
- Add `visualRef = useRef<VisualProvider | null>(null)`
- Add `getVisual()` lazy getter using `resolveVisualProvider(visualMode)`
- Pass `visualMode` from `page.tsx` via `process.env.VISUAL_MODE ?? "orb"`

---

**Step 236 — Extract Orb rendering into `OrbDisplay` component**
- Move the current avatar orb JSX block into a standalone `OrbDisplay.tsx`
- Props: `phase: InterviewPhase`
- Re-exports the same animated visual, but now isolated and swappable
- Replace inline JSX in shell with `<OrbDisplay phase={phase} />`

---

**Step 237 — Create `VideoAvatarDisplay` component (placeholder)**
- Create `src/components/ai-interview/VideoAvatarDisplay.tsx`
- Props: `phase: InterviewPhase`, `subProvider: string`, `streamUrl?: string`
- Renders a 16:9 dark card with:
  - Top-left: `● LIVE` badge
  - Center: animated placeholder ring (replaced by iframe/WebRTC later)
  - Bottom: provider name badge ("Powered by Tavus" / "D-ID" / "Simli")
- Same sizing as the Orb card for layout consistency

---

**Step 238 — Conditional render in shell based on visual mode**
- In `AiInterviewShell`, replace the current static orb block with:
  ```tsx
  {visualMode === "orb" || !visualMode
    ? <OrbDisplay phase={phase} />
    : <VideoAvatarDisplay phase={phase} subProvider={visualMode} />
  }
  ```
- Verify both modes render correctly by toggling `VISUAL_MODE` in `.env`

---

### Phase 3 — Config Panel + Per-Position Control

**Step 239 — Add `visualMode` to `AiInterviewConfig` schema**
- Add `visualMode String? @default("orb")` to `AiInterviewConfig` in `schema.prisma`
- Run `prisma db push` + `prisma generate`
- Update `upsertPositionAiConfigAction` to persist `visualMode`

---

**Step 240 — Add Visual Mode selector to `AiInterviewConfigPanel`**
- Add a new "AI Presence" section with two option cards (not a dropdown):
  - **Orb** — "Animated AI presence, zero cost, works everywhere" (selected by default)
  - **Video Avatar** — "Real-time talking face (requires provider API key)"
- When Video Avatar is selected, show a sub-selector: Tavus / D-ID / Simli
- Save selection via `upsertPositionAiConfigAction`

---

**Step 241 — Wire per-position `visualMode` through to the session page**
- In `/ai-interview/[sessionId]/page.tsx`, read `config?.visualMode ?? process.env.VISUAL_MODE ?? "orb"`
- Pass as `visualMode` prop to `AiInterviewShell`
- Priority order: **per-position config → env var → "orb"**

---

### Phase 4 — Tavus Integration (Real Video)

**Step 242 — Add Tavus env vars + server config**
- `.env` additions:
  ```env
  TAVUS_API_KEY=your_key
  TAVUS_PERSONA_ID=your_persona_id
  VISUAL_MODE=orb   # change to "tavus" to activate
  ```
- Document in `.env.example`

---

**Step 243 — Create `/api/visual/tavus/session` route**
- `POST /api/visual/tavus/session`
- Body: `{ sessionId: string }`
- Calls `POST https://tavusapi.com/v2/conversations` with persona_id
- Returns: `{ conversationUrl: string, conversationId: string }`
- Stores `conversationId` in `AiInterviewSession.avatarSessionId`

---

**Step 244 — Wire Tavus session creation into `VideoVisualProvider`**
- In `VideoVisualProvider.init()` for `"tavus"`:
  - Calls `/api/visual/tavus/session`
  - Stores the `conversationUrl`
- `isReady()` returns true after URL is received

---

**Step 245 — Render Tavus iframe in `VideoAvatarDisplay`**
- When `subProvider === "tavus"` and `streamUrl` is set:
  - Render `<iframe src={streamUrl} allow="camera; microphone" />`
  - Replace the animated placeholder ring
- Fallback: if `streamUrl` is null, show the placeholder ring

---

**Step 246 — Wire Tavus "speak" command**
- Tavus handles TTS internally through the conversation interface
- When `visualMode === "tavus"`, skip TTS provider (`elevenlabs`/`browser`)
- Tavus avatar speaks the question via its own voice
- Update `askQuestion()` in shell to branch on `visualMode`

---

### Phase 5 — D-ID Integration Shell

**Step 247 — Create `/api/visual/did/session` route (shell)**
- `POST /api/visual/did/session`
- Stub: returns mock session ID, logs `"[D-ID] stub called"`
- Ready for real D-ID API wiring when needed

---

**Step 248 — Create `/api/visual/did/speak` route (shell)**
- `POST /api/visual/did/speak`
- Body: `{ sessionId: string, text: string }`
- Stub: logs, returns 200
- D-ID uses a REST POST speak model rather than a live stream

---

### Phase 6 — Simli Integration Shell

**Step 249 — Create Simli env config + session shell**
- `.env` additions:
  ```env
  SIMLI_API_KEY=your_key
  SIMLI_FACE_ID=your_face_id
  ```
- `POST /api/visual/simli/session` — stub, returns mock token
- Simli uses WebRTC — document the SDK install step

---

**Step 250 — Document Simli WebRTC embedding approach**
- Create `docs/simli-integration.md`
- Outline: install `@simli-client/simliClient` SDK
- WebRTC connection flow vs Tavus iframe approach
- Note: requires `peerConnection` mount in `VideoAvatarDisplay`

---

### Phase 7 — Fallback Chain + Polish

**Step 251 — Add visual provider fallback chain**
- If video avatar session creation fails → log warning → fall back to Orb automatically
- Show subtle amber toast: "Live avatar unavailable — using AI orb instead"
- Never hard-fail the interview

---

**Step 252 — Add visual mode indicator in interview room UI**
- Small badge below the visual area showing which mode is active
- Orb mode: `🔮 AI Orb`
- Video mode: `🎥 Live Avatar · Tavus` (or D-ID / Simli)
- Disappears after 4 seconds (fade out animation)

---

**Step 253 — Add `VISUAL_MODE` to Vercel env var documentation**
- Update internal docs/README with:
  - Which env vars control which providers
  - The switching checklist (change var → redeploy → done)

---

## Quick Reference — Switching Modes

### Orb mode (default, free, zero setup)
```env
VISUAL_MODE=orb
```

### Tavus video avatar
```env
VISUAL_MODE=tavus
TAVUS_API_KEY=...
TAVUS_PERSONA_ID=...
```

### D-ID video avatar
```env
VISUAL_MODE=did
DID_API_KEY=...
DID_PRESENTER_ID=...
```

### Simli video avatar
```env
VISUAL_MODE=simli
SIMLI_API_KEY=...
SIMLI_FACE_ID=...
```

> No code changes needed to switch — only `.env` update + restart (or Vercel redeploy).

---

## Dependency Map

```
Step 231 (interface)
    ↓
Step 232 (Orb) ──┐
Step 233 (Video) ─┤
Step 234 (resolver)
    ↓
Step 235–238 (shell refactor)
    ↓
Step 239–241 (per-position config)
    ↓
Steps 242–246 (Tavus real API)
Steps 247–248 (D-ID shell)
Steps 249–250 (Simli shell)
    ↓
Steps 251–253 (fallback + polish)
```

Steps 231–241 are the **core foundation** — implement these first and the mode-switching architecture is complete. Steps 242–253 add real provider wiring progressively, only when clients need a specific platform.
