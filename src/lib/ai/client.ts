/**
 * src/lib/ai/client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single shared GoogleGenAI client singleton.
 *
 * USAGE:
 *   import { geminiClient } from "@/lib/ai/client";
 *   const result = await geminiClient.models.generateContent({ ... });
 *
 * WHY A SINGLETON:
 *   GoogleGenAI construction is not free — it validates the key and sets up
 *   internal HTTP machinery. Creating one per request wastes resources and
 *   bypasses aiConfig (env var GEMINI_MODEL would be ignored).
 *
 * FUTURE:
 *   When supporting multiple providers, extend this to a factory:
 *   getClient("gemini") | getClient("anthropic") | getClient("openai")
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenAI } from "@google/genai";
import { aiConfig } from "./config";

function createGeminiClient(): GoogleGenAI {
  const apiKey = aiConfig.gemini.apiKey ?? "";
  if (!apiKey) {
    console.warn(
      "[AI Client] GEMINI_API_KEY is not set — all Gemini calls will fail at runtime. " +
      "Set GEMINI_API_KEY in your .env.local or Vercel environment."
    );
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Shared GoogleGenAI client. Import this everywhere instead of calling
 * `new GoogleGenAI(...)` directly.
 */
export const geminiClient: GoogleGenAI = createGeminiClient();

/**
 * The resolved model name from aiConfig / GEMINI_MODEL env var.
 * Use this as the default `model` field for all generateContent calls.
 */
export const geminiModel: string = aiConfig.gemini.model;
