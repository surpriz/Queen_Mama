// AI Provider configurations and tier limits for proxy service

import { getAdminApiKey, getConfiguredProviders, toApiKeyProvider } from "@/lib/admin-keys";
import { ApiKeyProvider } from "@prisma/client";

export type AIProviderType = "openai" | "anthropic" | "gemini" | "grok";
export type TranscriptionProviderType = "deepgram" | "assemblyai";
export type PlanTier = "FREE" | "PRO" | "ENTERPRISE";

// Map our types to Prisma enum
const providerToPrisma: Record<AIProviderType | TranscriptionProviderType, ApiKeyProvider> = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
  gemini: "GEMINI",
  grok: "GROK",
  deepgram: "DEEPGRAM",
  assemblyai: "ASSEMBLYAI",
};

// Model configurations per provider
export const AI_MODELS = {
  openai: {
    standard: "gpt-4o-mini",
    smart: "o3",
  },
  anthropic: {
    standard: "claude-sonnet-4-20250514",
    smart: "claude-sonnet-4-20250514", // Uses extended thinking
  },
  gemini: {
    standard: "gemini-2.0-flash",
    smart: "gemini-2.0-flash-thinking-exp",
  },
  grok: {
    standard: "grok-3-fast",
    smart: "grok-3",
  },
} as const;

// Tier-based feature limits
export const TIER_LIMITS = {
  FREE: {
    aiProviders: ["openai", "anthropic"] as AIProviderType[], // Allow OpenAI or Anthropic
    transcriptionProviders: ["deepgram"] as TranscriptionProviderType[],
    maxTokens: 1000,
    smartMode: false,
    dailyAiRequests: 1,
    transcription: true,
    screenshot: false,
  },
  PRO: {
    aiProviders: ["openai", "anthropic", "grok", "gemini"] as AIProviderType[],
    transcriptionProviders: ["deepgram", "assemblyai"] as TranscriptionProviderType[],
    maxTokens: 4000,
    smartMode: false,
    dailyAiRequests: null, // unlimited
    transcription: true,
    screenshot: true,
  },
  ENTERPRISE: {
    aiProviders: ["openai", "anthropic", "grok", "gemini"] as AIProviderType[],
    transcriptionProviders: ["deepgram", "assemblyai"] as TranscriptionProviderType[],
    maxTokens: 16000,
    smartMode: true,
    dailyAiRequests: null, // unlimited
    transcription: true,
    screenshot: true,
  },
} as const;

// API URLs for each provider
export const PROVIDER_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  grok: "https://api.x.ai/v1/chat/completions",
} as const;

// Get API key for a provider from database (async)
export async function getProviderApiKey(
  provider: AIProviderType | TranscriptionProviderType
): Promise<string | null> {
  const prismaProvider = providerToPrisma[provider];
  if (!prismaProvider) return null;
  return getAdminApiKey(prismaProvider);
}

// Get API key synchronously from environment (fallback for edge cases)
export function getProviderApiKeySync(
  provider: AIProviderType | TranscriptionProviderType
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
}): object {
  return {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature ?? 0.7,
    stream: params.stream,
  };
}

// Build request body for Anthropic API
export function buildAnthropicRequestBody(params: {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string | object[] }>;
  maxTokens: number;
  stream: boolean;
  smartMode: boolean;
}): object {
  const body: Record<string, unknown> = {
    model: params.model,
    system: params.systemPrompt,
    messages: params.messages,
    max_tokens: params.maxTokens,
    stream: params.stream,
  };

  // Add extended thinking for smart mode
  if (params.smartMode) {
    body.thinking = {
      type: "enabled",
      budget_tokens: Math.min(params.maxTokens * 2, 10000),
    };
  }

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
