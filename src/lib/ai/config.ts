/**
 * Centralized AI layer configuration.
 * All AI-related environment variables are read and validated here.
 * Import `aiConfig` rather than reading process.env directly in providers.
 */

export interface AiConfig {
  /** Which AI provider to use: "deepseek" | "gemini" | "mock" */
  provider: "deepseek" | "gemini" | "mock";

  /** Execution mode: "dev" (sequential/delayed) or "prod" (parallel/fast/advanced models) */
  mode: "dev" | "prod";

  /** Whether fallback logic is enabled */
  fallbackEnabled: boolean;

  /** Fallback provider if the primary fails or lacks a key */
  fallbackProvider: "gemini" | "mock";

  deepseek: {
    apiKey:             string | null;
    baseUrl:            string;
    chatModel:          string;
    reasonerModel:      string;
  };

  gemini: {
    apiKey:             string | null;
    model:              string;
  };

  /** Temperature for structured extraction (lower = more deterministic) */
  temperature:        number;

  /** Max output tokens (optional limit) */
  maxOutputTokens?:   number;

  /** Whether the current configuration is considered production-ready */
  isReady: boolean;

  /** Human-readable status message for UI display */
  statusMessage: string;
}

function loadAiConfig(): AiConfig {
  const rawProvider = process.env.AI_PROVIDER?.toLowerCase() ?? "";
  const rawFallback = process.env.AI_FALLBACK_PROVIDER?.toLowerCase() ?? "mock";
  
  const deepseekKey = process.env.DEEPSEEK_API_KEY || null;
  const geminiKey = process.env.GEMINI_API_KEY || null;
  
  const fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== "false";
  const fallbackProvider = (rawFallback === "gemini" && geminiKey) ? "gemini" : "mock";

  const mode: AiConfig["mode"] = process.env.AI_EXECUTION_MODE?.toLowerCase() === "prod" ? "prod" : "dev";

  // Resolve effective provider
  let provider: AiConfig["provider"];
  if (rawProvider === "mock") {
    provider = "mock";
  } else if (rawProvider === "deepseek" && deepseekKey) {
    provider = "deepseek";
  } else if (rawProvider === "gemini" && geminiKey) {
    provider = "gemini";
  } else {
    // If primary fails, resolve to fallback
    provider = fallbackProvider;
  }

  const temperature = process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.1;
  const maxOutputTokens = process.env.AI_MAX_OUTPUT_TOKENS ? parseInt(process.env.AI_MAX_OUTPUT_TOKENS) : undefined;

  const isReady = (provider === "deepseek" && !!deepseekKey) || (provider === "gemini" && !!geminiKey);

  const statusMessage = isReady
    ? `${provider === "deepseek" ? "DeepSeek" : "Gemini"} AI ready`
    : "Running in mock mode — set DEEPSEEK_API_KEY or GEMINI_API_KEY to enable real AI";

  return {
    provider,
    mode,
    fallbackEnabled,
    fallbackProvider,
    deepseek: {
      apiKey: deepseekKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      chatModel: process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat",
      // In prod mode, use the faster chat model for ranking (cost-optimized).
      // In dev mode, use the full reasoner for higher quality (but slower/pricier).
      reasonerModel: mode === "prod"
        ? (process.env.DEEPSEEK_REASONER_MODEL || "deepseek-chat")
        : (process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner"),
    },
    gemini: {
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
    temperature,
    maxOutputTokens,
    isReady,
    statusMessage,
  };
}

// ── Singleton with dev-mode hot-reload ────────────────────────────────────────

let _cached: AiConfig | null = null;

/**
 * Get a fresh AI configuration (re-reads env vars).
 * Use this when you need to guarantee the latest config (e.g., admin panels).
 */
export function getAiConfig(): AiConfig {
  return loadAiConfig();
}

/**
 * AI configuration object.
 *
 * - In production: evaluated once at module load time (cached singleton).
 * - In development: re-evaluates on each access to support env var changes
 *   without restarting the dev server.
 */
export const aiConfig: AiConfig =
  process.env.NODE_ENV === "production"
    ? loadAiConfig()
    : new Proxy({} as AiConfig, {
        get(_target, prop, _receiver) {
          if (!_cached || Date.now() - (_cached as any).__ts > 5000) {
            _cached = loadAiConfig();
            (_cached as any).__ts = Date.now();
          }
          return (_cached as any)[prop];
        },
      });

