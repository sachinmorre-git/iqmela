/**
 * Centralized AI layer configuration.
 * All AI-related environment variables are read and validated here.
 * Import `aiConfig` rather than reading process.env directly in providers.
 */

export interface AiConfig {
  /** Which AI provider to use: "deepseek" | "gemini" | "mock" */
  provider: "deepseek" | "gemini" | "mock";

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
  
  const fallbackProvider = (rawFallback === "gemini" && geminiKey) ? "gemini" : "mock";

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

  const isReady = (provider === "deepseek" && !!deepseekKey) || (provider === "gemini" && !!geminiKey);

  const statusMessage = isReady
    ? `${provider === "deepseek" ? "DeepSeek" : "Gemini"} AI ready`
    : "Running in mock mode — set DEEPSEEK_API_KEY or GEMINI_API_KEY to enable real AI";

  return {
    provider,
    fallbackProvider,
    deepseek: {
      apiKey: deepseekKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      chatModel: process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat",
      reasonerModel: process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner",
    },
    gemini: {
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
    temperature,
    isReady,
    statusMessage,
  };
}

/**
 * Singleton AI configuration object.
 * Evaluated once at module load time (server-side only).
 */
export const aiConfig: AiConfig = loadAiConfig();
