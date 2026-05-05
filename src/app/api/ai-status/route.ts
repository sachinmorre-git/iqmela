/**
 * GET /api/ai-status
 *
 * Lightweight endpoint that returns the current AI provider status.
 * Used by the AiDegradedBanner to detect mock/degraded mode.
 * No auth required — returns no sensitive data.
 */

import { NextResponse } from "next/server";
import { aiConfig } from "@/lib/ai/config";

export async function GET() {
  const isMock = aiConfig.provider === "mock";
  const isReady = aiConfig.isReady;

  // Check if circuit breaker is open (primary down, using fallback)
  let circuitOpen = false;
  try {
    const { getAllCircuitBreakers } = await import("@/lib/ai/circuit-breaker");
    const breakers = getAllCircuitBreakers();
    circuitOpen = breakers.some((b) => b.getState() === "OPEN");
  } catch {
    // Circuit breaker not initialized yet — not degraded
  }

  const degraded = isMock || !isReady || circuitOpen;

  let message = "";
  if (isMock) {
    message = "Running in mock mode — AI scores are simulated. Configure API keys to enable real AI.";
  } else if (circuitOpen) {
    message = `Primary AI provider (${aiConfig.provider}) is temporarily unavailable. Using fallback.`;
  } else if (!isReady) {
    message = "No AI provider configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY.";
  }

  return NextResponse.json({
    provider: aiConfig.provider,
    isReady,
    degraded,
    message,
    fallbackProvider: aiConfig.fallbackProvider,
    circuitOpen,
  });
}
