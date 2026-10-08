// AI Provider configurations and tier limits for proxy service

import { getAdminApiKey, getConfiguredProviders, toApiKeyProvider } from "@/lib/admin-keys";
import { ApiKeyProvider } from "@prisma/client";

export type AIProviderType = "openai" | "anthropic" | "gemini" | "grok";
export type TranscriptionProviderType = "deepgram" | "assemblyai";
export type TranslationProviderType = "deepl";
export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

// Map our types to Prisma enum
const providerToPrisma: Record<AIProviderType | TranscriptionProviderType | TranslationProviderType, ApiKeyProvider> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
  gemini: "GEMINI",
  grok: "GROK",
  deepgram: "DEEPGRAM",
  assemblyai: "ASSEMBLYAI",
  deepl: "DEEPL",
};

// Model cascade configuration for resilience
// Alternates between providers to maximize uptime
// Order: Primary → Different provider → Backup → Last resort
export interface CascadeModel {
  provider: AIProviderType;
  model: string;
}

export const MODEL_CASCADE = {
  // Standard Mode (PRO): Real-time suggestions, latency is king
  standard: [
    { provider: "openai", model: "gpt-6-luna" },                       // Primary: GPT-6 Luna, reasoning_effort=none (see OPENAI_REASONING_EFFORT)
    { provider: "openai", model: "gpt-5.4-mini" },                     // Fallback 1: previous primary, same speed profile
    { provider: "anthropic", model: "claude-sonnet-5-5" },             // Fallback 2: Sonnet 5.5, thinking off (between_tools)
    { provider: "anthropic", model: "claude-sonnet-4-6" },             // Last resort: previous gen
  ] as CascadeModel[],

  // Smart Mode (Enterprise): Deep analysis with adaptive thinking
  smart: [
    { provider: "anthropic", model: "claude-sonnet-5-5" },             // Primary: Sonnet 5.5, adaptive thinking, effort=medium
    { provider: "openai", model: "gpt-6-luna" },                       // Fallback 1: Luna with reasoning_effort=low
    { provider: "anthropic", model: "claude-sonnet-4-6" },             // Last resort: previous gen
  ] as CascadeModel[],

  // Recap Mode: Meeting summaries (text-only, large context preferred)
  recap: [
    { provider: "anthropic", model: "claude-sonnet-5-5" },             // Primary: Sonnet 5.5, adaptive thinking, effort=high
    { provider: "openai", model: "gpt-6-luna" },                       // Fallback 1: 1M context, reasoning_effort=medium
    { provider: "anthropic", model: "claude-sonnet-4-6" },             // Last resort: previous gen
  ] as CascadeModel[],
} as const;

// ============================================
// OpenAI request tuning
// ============================================

export type OpenAIReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

// Reasoning effort sent to OpenAI reasoning models, per mode.
// Standard MUST stay "none": gpt-6-luna defaults to "medium", which adds hidden
// reasoning before the first token. "none" is gpt-5.4-mini's default, i.e. the
// latency profile Assist was tuned on.
export const OPENAI_REASONING_EFFORT: Record<CascadeMode, OpenAIReasoningEffort> = {
  standard: "none",
  smart: "low",
  recap: "medium",
};

// Model registry: display label, pricing (USD per 1M tokens) and, for OpenAI
// reasoning models, the reasoning_effort values the model accepts. A model not
// listed here still works, it just gets no reasoning_effort and a cost of 0.
export interface ModelSpec {
  label: string;
  input: number;
  output: number;
  reasoningEfforts?: readonly OpenAIReasoningEffort[];
}

export const MODEL_SPECS: Record<string, ModelSpec> = {
  "gpt-6-luna":                  { label: "GPT-6 Luna",        input: 0.10, output: 0.50,  reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"] },
  "gpt-5.4-mini":                { label: "GPT-5.4 mini",      input: 0.75, output: 4.50,  reasoningEfforts: ["none", "low", "medium", "high", "xhigh"] },
  "gpt-4.1":                     { label: "GPT-4.1",           input: 2.00, output: 8.00  },
  "gpt-4.1-mini":                { label: "GPT-4.1 mini",      input: 0.40, output: 1.60  },
  "gpt-4o":                      { label: "GPT-4o",            input: 2.50, output: 10.00 }, // kept for legacy logs
  "gpt-4o-mini":                 { label: "GPT-4o mini",       input: 0.15, output: 0.60  },
  "o4-mini":                     { label: "o4-mini",           input: 1.10, output: 4.40  }, // deprecated, kept for legacy logs
  "claude-sonnet-5-5":           { label: "Claude Sonnet 5.5", input: 2.00, output: 10.00 },
  "claude-sonnet-5":             { label: "Claude Sonnet 5",   input: 2.00, output: 10.00 }, // server-side refusal fallback target
  "claude-sonnet-4-6":           { label: "Claude Sonnet 4.6", input: 3.00, output: 15.00 },
  "claude-sonnet-4-5-20250929":  { label: "Claude Sonnet 4.5", input: 3.00, output: 15.00 },
  "grok-4-1-fast-non-reasoning": { label: "Grok 4.1 Fast",     input: 3.00, output: 15.00 },
  "grok-4-1-fast-reasoning":     { label: "Grok 4.1 Fast (reasoning)", input: 3.00, output: 15.00 },
};

export function calculateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const rates = MODEL_SPECS[model];
  if (!rates) return 0;
  return (usage.inputTokens / 1_000_000) * rates.input
       + (usage.outputTokens / 1_000_000) * rates.output;
}

// GPT-5+ and o-series: reasoning models (max_completion_tokens, no custom temperature)
function isOpenAIReasoningModel(model: string): boolean {
  return /^gpt-([5-9]|\d{2,})/.test(model) || /^o\d/.test(model);
}

// Models that reject max_tokens and require max_completion_tokens
function usesMaxCompletionTokens(model: string): boolean {
  return isOpenAIReasoningModel(model) || model.startsWith("gpt-4o") || model.startsWith("gpt-4.1");
}

// reasoning_effort to send for this model/mode, or undefined if the model doesn't take it
export function getOpenAIReasoningEffort(model: string, mode: CascadeMode): OpenAIReasoningEffort | undefined {
  const effort = OPENAI_REASONING_EFFORT[mode];
  return MODEL_SPECS[model]?.reasoningEfforts?.includes(effort) ? effort : undefined;
}

// ============================================
// Anthropic request tuning
// ============================================

export type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicThinkingParams {
  // Fields to merge into the request body
  params: {
    thinking?: Record<string, unknown>;
    output_config?: { effort: AnthropicEffort };
    fallbacks?: "default";
  };
  // anthropic-beta header values
  betas: string[];
  effort: AnthropicEffort;
}

// Effort per mode. Standard goes up a notch on long transcripts.
export function getAnthropicEffort(mode: CascadeMode, inputLength: number): AnthropicEffort {
  if (mode === "recap") return "high";
  if (mode === "smart") return "medium";
  return inputLength > 2000 ? "medium" : "low";
}

// Sonnet 5.5 generation: budget_tokens and thinking "disabled" both return a 400,
// non-default temperature too. Thinking is off via "between_tools", on via adaptive + effort.
function isAnthropicGen55(model: string): boolean {
  return model.startsWith("claude-sonnet-5-5");
}

// Thinking / effort / beta config for an Anthropic request.
export function getAnthropicThinkingParams(
  model: string,
  mode: CascadeMode,
  inputLength: number
): AnthropicThinkingParams {
  const effort = getAnthropicEffort(mode, inputLength);

  if (isAnthropicGen55(model)) {
    return {
      params: {
        // Standard: no extended thinking, same latency profile as Sonnet 4.6 without thinking.
        // Smart/Recap: adaptive thinking, depth driven by effort.
        thinking: mode === "standard" ? { type: "between_tools" } : { type: "adaptive" },
        output_config: { effort },
        // Server retries cyber/frontier_llm declines on Sonnet 5; other declines surface as
        // stop_reason "refusal" and the cascade moves on to the next model.
        fallbacks: "default",
      },
      betas: ["server-side-fallback-2026-07-01"],
      effort,
    };
  }

  // Sonnet 4.6 and older
  if (mode === "recap") {
    return { params: { thinking: { type: "enabled", budget_tokens: 16000 } }, betas: ["prompt-caching-2024-07-31", "interleaved-thinking-2025-05-14"], effort };
  }
  if (mode === "smart") {
    return { params: { thinking: { type: "adaptive" } }, betas: ["prompt-caching-2024-07-31", "interleaved-thinking-2025-05-14"], effort };
  }
  return { params: { output_config: { effort } }, betas: ["prompt-caching-2024-07-31"], effort };
}

// Legacy AI_MODELS for backward compatibility
export const AI_MODELS = {
  openai: {
    standard: "gpt-6-luna",
    smart: "gpt-6-luna",
  },
  anthropic: {
    standard: "claude-sonnet-5-5",  // PRO: thinking off (between_tools)
    smart: "claude-sonnet-5-5",     // Enterprise: adaptive thinking
  },
  gemini: {
    standard: "gemini-2.0-flash",
    smart: "gemini-2.0-flash-thinking-exp",
  },
  grok: {
    standard: "grok-4-1-fast-non-reasoning",
    smart: "grok-4-1-fast-reasoning",
  },
} as const;

// Tier-based feature limits
// All tiers use the cascade system for resilience (OpenAI → Grok → Claude)
export const TIER_LIMITS = {
  FREE: {
    aiProviders: ["openai", "grok", "anthropic"] as AIProviderType[], // Cascade providers
    transcriptionProviders: ["deepgram"] as TranscriptionProviderType[],
    translationProviders: [] as TranslationProviderType[], // Not available on FREE
    maxTokens: 1000,
    smartMode: false,
    dailyAiRequests: 10,
    transcription: true,
    translation: false,
    monthlyTranslationChars: 0,
    screenshot: false,
  },
  PRO: {
    aiProviders: ["openai", "grok", "anthropic"] as AIProviderType[], // Cascade providers
    transcriptionProviders: ["deepgram", "assemblyai"] as TranscriptionProviderType[],
    translationProviders: ["deepl"] as TranslationProviderType[],
    maxTokens: 4000,
    smartMode: false,
    dailyAiRequests: null, // unlimited
    transcription: true,
    translation: true,
    monthlyTranslationChars: 500_000, // 500K chars/mo (~10h meeting)
    screenshot: true,
  },
  ENTERPRISE: {
    aiProviders: ["openai", "grok", "anthropic"] as AIProviderType[], // Cascade providers
    transcriptionProviders: ["deepgram", "assemblyai"] as TranscriptionProviderType[],
    translationProviders: ["deepl"] as TranslationProviderType[],
    maxTokens: 16000,
    smartMode: true, // Sonnet 4.6 adaptive thinking, see MODEL_CASCADE.smart
    dailyAiRequests: null, // unlimited
    transcription: true,
    translation: true,
    monthlyTranslationChars: null, // unlimited
    screenshot: true,
  },
} as const;

// Mode types for cascade selection
export type CascadeMode = "standard" | "smart" | "recap";

// User-selectable models exposed in client UIs.
// Only applied when cascadeMode === "standard" — Smart/Recap stay on cascade.
// Keys are the IDs sent by clients; values describe how to dispatch.
// "Standard (default)" is exposed in clients via the absence of `model` — backend
// uses its standard cascade whose primary is `gpt-6-luna`. So `gpt-6-luna` is
// intentionally NOT in this whitelist (would be a duplicate of the default).
export const USER_SELECTABLE_MODELS: Record<string, CascadeModel> = {
  "claude-sonnet-4-6": { provider: "anthropic", model: "claude-sonnet-4-6" },
  "gpt-5.4-mini":      { provider: "openai",    model: "gpt-5.4-mini"      },
  "gpt-4o-mini":       { provider: "openai",    model: "gpt-4o-mini"       },
  "gpt-4.1-mini":      { provider: "openai",    model: "gpt-4.1-mini"      },
};

export function isUserSelectableModel(id: string | undefined | null): id is keyof typeof USER_SELECTABLE_MODELS {
  return typeof id === "string" && id in USER_SELECTABLE_MODELS;
}

// Get model cascade for a given mode, filtered by configured providers.
// When `overrideModel` is provided AND mode === "standard", the override is placed at
// the head of the cascade; the rest of the standard cascade is kept as fallback so a
// transient outage of the user-picked model still yields a response.
export async function getModelCascade(
  mode: CascadeMode | boolean,
  opts: { overrideModel?: string } = {}
): Promise<CascadeModel[]> {
  // Support legacy boolean parameter (for backward compatibility)
  let cascadeMode: CascadeMode;
  if (typeof mode === "boolean") {
    cascadeMode = mode ? "smart" : "standard";
  } else {
    cascadeMode = mode;
  }

  let cascade: readonly CascadeModel[] = MODEL_CASCADE[cascadeMode];

  if (cascadeMode === "standard" && isUserSelectableModel(opts.overrideModel)) {
    const override = USER_SELECTABLE_MODELS[opts.overrideModel];
    // Place override first; deduplicate same provider+model from default cascade
    const rest = MODEL_CASCADE.standard.filter(
      (c) => !(c.provider === override.provider && c.model === override.model)
    );
    cascade = [override, ...rest];
  }

  const configuredProviders = await getConfiguredProviders();

  // Filter cascade to only include configured providers
  return cascade.filter((item) => {
    const prismaProvider = providerToPrisma[item.provider];
    return configuredProviders.includes(prismaProvider);
  });
}

// API URLs for each provider
export const PROVIDER_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  grok: "https://api.x.ai/v1/chat/completions",
} as const;

// Get API key for a provider from database (async)
export async function getProviderApiKey(
  provider: AIProviderType | TranscriptionProviderType | TranslationProviderType
): Promise<string | null> {
  const prismaProvider = providerToPrisma[provider];
  if (!prismaProvider) return null;
  return getAdminApiKey(prismaProvider);
}

// Get API key synchronously from environment (fallback for edge cases)
export function getProviderApiKeySync(
  provider: AIProviderType | TranscriptionProviderType | TranslationProviderType
): string | undefined {
  // Fallback to env vars (useful during migration or if DB is down)
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "grok":
      return process.env.XAI_API_KEY;
    case "deepgram":
      return process.env.DEEPGRAM_API_KEY;
    case "assemblyai":
      return process.env.ASSEMBLYAI_API_KEY;
    case "deepl":
      return process.env.DEEPL_API_KEY;
    default:
      return undefined;
  }
}

// Check if a provider is configured (has API key) - async version
export async function isProviderConfigured(
  provider: AIProviderType | TranscriptionProviderType
): Promise<boolean> {
  const key = await getProviderApiKey(provider);
  return !!key && key.length > 0;
}

// Get available AI providers based on tier and DB configuration
export async function getAvailableAIProviders(tier: PlanTier): Promise<AIProviderType[]> {
  const tierConfig = TIER_LIMITS[tier];
  const configuredProviders = await getConfiguredProviders();

  return tierConfig.aiProviders.filter((provider) => {
    const prismaProvider = providerToPrisma[provider];
    return configuredProviders.includes(prismaProvider);
  });
}

// Get available transcription providers based on tier and DB configuration
export async function getAvailableTranscriptionProviders(
  tier: PlanTier
): Promise<TranscriptionProviderType[]> {
  const tierConfig = TIER_LIMITS[tier];
  const configuredProviders = await getConfiguredProviders();

  return tierConfig.transcriptionProviders.filter((provider) => {
    const prismaProvider = providerToPrisma[provider];
    return configuredProviders.includes(prismaProvider);
  });
}

// Get available translation providers based on tier and DB configuration
export async function getAvailableTranslationProviders(
  tier: PlanTier
): Promise<TranslationProviderType[]> {
  const tierConfig = TIER_LIMITS[tier];
  if (!tierConfig.translation) return [];

  const configuredProviders = await getConfiguredProviders();
  return tierConfig.translationProviders.filter((provider) => {
    const prismaProvider = providerToPrisma[provider];
    return configuredProviders.includes(prismaProvider);
  });
}

// Check if user can use a specific AI provider
export async function canUseAIProvider(
  tier: PlanTier,
  provider: AIProviderType
): Promise<boolean> {
  const tierConfig = TIER_LIMITS[tier];
  if (!tierConfig.aiProviders.includes(provider)) return false;
  return isProviderConfigured(provider);
}

// Check if user can use smart mode
export function canUseSmartMode(tier: PlanTier): boolean {
  return TIER_LIMITS[tier].smartMode;
}

// Get max tokens for tier
export function getMaxTokens(tier: PlanTier): number {
  return TIER_LIMITS[tier].maxTokens;
}

// Get model for provider based on smart mode
export function getModelForProvider(provider: AIProviderType, smartMode: boolean): string {
  const models = AI_MODELS[provider];
  return smartMode ? models.smart : models.standard;
}

// Build request body for OpenAI-compatible APIs (OpenAI, Grok)
export function buildOpenAIRequestBody(params: {
  model: string;
  messages: Array<{ role: string; content: string | object[] }>;
  maxTokens: number;
  stream: boolean;
  temperature?: number;
  mode?: CascadeMode;
}): object {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: params.stream,
  };

  // Reasoning models only support the default temperature
  if (!isOpenAIReasoningModel(params.model)) {
    body.temperature = params.temperature ?? 0.7;
  }

  if (usesMaxCompletionTokens(params.model)) {
    body.max_completion_tokens = params.maxTokens;
  } else {
    body.max_tokens = params.maxTokens;
  }

  const effort = getOpenAIReasoningEffort(params.model, params.mode ?? "standard");
  if (effort) {
    body.reasoning_effort = effort;
  }

  if (params.stream) {
    // Usage comes in the final chunk, needed for cost tracking
    body.stream_options = { include_usage: true };
  }

  return body;
}

// Build request body for Anthropic API
export function buildAnthropicRequestBody(params: {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string | object[] }>;
  maxTokens: number;
  stream: boolean;
  smartMode: boolean;
  mode?: CascadeMode;  // Optional: pass mode for fine-grained thinking control
}): object {
  const body: Record<string, unknown> = {
    model: params.model,
    system: params.systemPrompt,
    messages: params.messages,
    max_tokens: params.maxTokens,
    stream: params.stream,
  };

  // Extended thinking configuration by mode:
  // - Standard (PRO): NO thinking → fastest responses
  // - Smart (Enterprise): adaptive thinking → model decides when to reason deeply
  // - Recap: forced thinking with 16000 tokens → full power for comprehensive summaries
  const isRecapMode = params.mode === "recap";
  const isSmartMode = params.smartMode || params.mode === "smart";

  if (isRecapMode) {
    // Recap mode: full thinking power (user has time to wait for quality summary)
    body.thinking = {
      type: "enabled",
      budget_tokens: 16000,
    };
  } else if (isSmartMode) {
    // Smart mode: adaptive thinking — model decides when reasoning is needed
    // Skips thinking on simple requests for speed, activates on complex ones
    body.thinking = {
      type: "adaptive",
    };
  }
  // Standard mode: no thinking (fastest responses)

  return body;
}

// Build request body for Gemini API
export function buildGeminiRequestBody(params: {
  contents: Array<{ role: string; parts: Array<{ text?: string; inline_data?: object }> }>;
  maxTokens: number;
}): object {
  return {
    contents: params.contents,
    generationConfig: {
      maxOutputTokens: params.maxTokens,
      temperature: 0.7,
    },
  };
}

// Validate AI request against tier limits
export interface AIRequestValidation {
  valid: boolean;
  error?: string;
  maxTokens: number;
  model: string;
}

export async function validateAIRequest(params: {
  tier: PlanTier;
  provider: AIProviderType;
  smartMode: boolean;
  dailyRequestCount: number;
}): Promise<AIRequestValidation> {
  const tierConfig = TIER_LIMITS[params.tier];

  // Check if provider is allowed for tier
  if (!tierConfig.aiProviders.includes(params.provider)) {
    return {
      valid: false,
      error: `Provider ${params.provider} not available for ${params.tier} tier`,
      maxTokens: 0,
      model: "",
    };
  }

  // Check if provider is configured (async DB check)
  const providerConfigured = await isProviderConfigured(params.provider);
  if (!providerConfigured) {
    return {
      valid: false,
      error: `Provider ${params.provider} is not configured by admin`,
      maxTokens: 0,
      model: "",
    };
  }

  // Check smart mode access
  if (params.smartMode && !tierConfig.smartMode) {
    return {
      valid: false,
      error: "Smart Mode requires Enterprise subscription",
      maxTokens: 0,
      model: "",
    };
  }

  // Check daily request limit
  if (tierConfig.dailyAiRequests !== null && params.dailyRequestCount >= tierConfig.dailyAiRequests) {
    return {
      valid: false,
      error: `Daily AI request limit reached (${tierConfig.dailyAiRequests})`,
      maxTokens: 0,
      model: "",
    };
  }

  return {
    valid: true,
    maxTokens: tierConfig.maxTokens,
    model: getModelForProvider(params.provider, params.smartMode),
  };
}
