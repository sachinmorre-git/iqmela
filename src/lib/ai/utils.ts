/**
 * src/lib/ai/utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utilities for parsing and cleaning AI responses.
 * Import from here — do NOT duplicate these in individual route files.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Strips markdown code fences that some models wrap around JSON.
 * Handles: ```json ... ``` and ``` ... ```
 *
 * @example
 * cleanJsonFences("```json\n{\"a\":1}\n```") // → '{"a":1}'
 */
export function cleanJsonFences(raw: string): string {
  return raw.replace(/```json\n?|\n?```/g, "").trim();
}

/**
 * Extracts a JSON object from a raw AI response string.
 * More robust than cleanJsonFences — searches for the outermost `{...}` block,
 * which handles models that prepend/append prose around the JSON.
 *
 * @throws Error if no JSON object is found in the string.
 *
 * @example
 * extractJson<{ score: number }>("Here is the result: {\"score\": 85}")
 * // → { score: 85 }
 */
export function extractJson<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(
      `[AI Utils] extractJson: No JSON object found in response. ` +
      `Raw (first 200 chars): ${raw.slice(0, 200)}`
    );
  }
  return JSON.parse(match[0]) as T;
}

/**
 * Safe wrapper around JSON.parse that falls back to a default value instead
 * of throwing. Useful for non-critical AI outputs.
 */
export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(cleanJsonFences(raw)) as T;
  } catch {
    return fallback;
  }
}
