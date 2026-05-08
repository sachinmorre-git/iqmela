/**
 * AI Model Router — Core Resolver Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves the model chain for a given AI task, with org-level overrides.
 *
 * Resolution Order:
 *   1. Check OrgAiConfig for the given orgId + taskKey
 *   2. Fall back to PlatformConfig global defaults
 *   3. Fall back to hardcoded DEFAULT_MODEL_CHAINS
 *
 * Usage:
 *   const chain = await getModelChain("extraction", orgId);
 *   // → { primary: "gemini-2.5-flash", fallback1: "deepseek-chat", fallback2: null }
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_MODEL_CHAINS, AI_MODELS, type ModelChain, type AiModelId } from "./models";

// ── Cache to avoid repeated DB reads within a single request ─────────────────

const _globalCache: { data: Record<string, any> | null; ts: number } = { data: null, ts: 0 };
const _orgCache: Map<string, { data: Record<string, any> | null; ts: number }> = new Map();
const CACHE_TTL = 10_000; // 10 seconds

// ── Schema field mapping ─────────────────────────────────────────────────────

const TASK_TO_FIELD: Record<string, string> = {
  extraction:       "extractionModels",
  ranking:          "rankingModels",
  judgment:         "judgmentModels",
  jdAnalysis:       "jdAnalysisModels",
  interviewScore:   "interviewScoreModels",
  codingGen:        "codingGenModels",
  interviewPrep:    "interviewPrepModels",
  redFlags:         "redFlagModels",
  candidateSummary: "candidateSummaryModels",
};

// ── Private Helpers ──────────────────────────────────────────────────────────

function parseChain(raw: unknown): ModelChain | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  if (!obj.primary || typeof obj.primary !== "string") return null;
  // Validate that the primary model exists in our registry
  if (!(obj.primary in AI_MODELS)) return null;
  return {
    primary: obj.primary as AiModelId,
    fallback1: (obj.fallback1 && obj.fallback1 in AI_MODELS) ? obj.fallback1 as AiModelId : null,
    fallback2: (obj.fallback2 && obj.fallback2 in AI_MODELS) ? obj.fallback2 as AiModelId : null,
  };
}

async function getGlobalConfig(): Promise<Record<string, any>> {
  const now = Date.now();
  if (_globalCache.data && now - _globalCache.ts < CACHE_TTL) {
    return _globalCache.data;
  }
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: "GLOBAL" } });
    const data = config ?? {};
    _globalCache.data = data;
    _globalCache.ts = now;
    return data;
  } catch (e) {
    console.error("[ModelRouter] Failed to load PlatformConfig:", e);
    return {};
  }
}

async function getOrgConfig(orgId: string): Promise<Record<string, any> | null> {
  const now = Date.now();
  const cached = _orgCache.get(orgId);
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data;
  }
  try {
    const config = await prisma.orgAiConfig.findUnique({ where: { organizationId: orgId } });
    const data = config ? (config as unknown as Record<string, any>) : null;
    _orgCache.set(orgId, { data, ts: now });
    return data;
  } catch (e) {
    console.error("[ModelRouter] Failed to load OrgAiConfig for", orgId, e);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the model chain for a given AI task.
 *
 * @param taskKey - One of the AI_TASK_TYPES keys (e.g. "extraction", "ranking")
 * @param orgId   - Optional organization ID for per-org overrides
 * @returns The resolved ModelChain with primary + fallbacks
 */
export async function getModelChain(taskKey: string, orgId?: string): Promise<ModelChain> {
  const field = TASK_TO_FIELD[taskKey];
  if (!field) {
    console.warn(`[ModelRouter] Unknown task key "${taskKey}", using hardcoded defaults.`);
    return DEFAULT_MODEL_CHAINS[taskKey] ?? DEFAULT_MODEL_CHAINS.extraction;
  }

  // 1. Check org-level override
  if (orgId) {
    const orgConfig = await getOrgConfig(orgId);
    if (orgConfig) {
      const orgChain = parseChain(orgConfig[field]);
      if (orgChain) return orgChain;
    }
  }

  // 2. Check global PlatformConfig
  const globalConfig = await getGlobalConfig();
  const globalChain = parseChain(globalConfig[field]);
  if (globalChain) return globalChain;

  // 3. Hardcoded defaults
  return DEFAULT_MODEL_CHAINS[taskKey] ?? DEFAULT_MODEL_CHAINS.extraction;
}

/**
 * Get ALL model chains for display in admin UI.
 * Returns a map of taskKey → ModelChain.
 */
export async function getAllModelChains(orgId?: string): Promise<Record<string, ModelChain>> {
  const result: Record<string, ModelChain> = {};
  for (const taskKey of Object.keys(TASK_TO_FIELD)) {
    result[taskKey] = await getModelChain(taskKey, orgId);
  }
  return result;
}

/**
 * Determine the provider name ("gemini" | "deepseek") for a given model ID.
 * Used by the withFallback logic to instantiate the correct provider class.
 */
export function getProviderForModel(modelId: AiModelId): "gemini" | "deepseek" | "mock" {
  const meta = AI_MODELS[modelId];
  if (!meta) return "mock";
  switch (meta.provider) {
    case "GEMINI": return "gemini";
    case "DEEPSEEK": return "deepseek";
    default: return "mock";
  }
}

/**
 * Invalidate all caches. Call after an admin changes config.
 */
export function invalidateModelRouterCache(orgId?: string) {
  _globalCache.data = null;
  _globalCache.ts = 0;
  if (orgId) {
    _orgCache.delete(orgId);
  } else {
    _orgCache.clear();
  }
}
