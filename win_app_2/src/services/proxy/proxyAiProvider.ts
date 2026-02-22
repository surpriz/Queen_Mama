import { AIProviderType } from '@/types/models'
import type { ProxyConfig } from '@/types/api'

// Maps internal provider types to backend proxy names
const PROVIDER_BACKEND_MAP: Record<AIProviderType, string> = {
  [AIProviderType.OpenAI]: 'openai',
  [AIProviderType.Anthropic]: 'anthropic',
  [AIProviderType.Gemini]: 'gemini',
  [AIProviderType.Grok]: 'grok',
}

// Maps backend names back to AIProviderType
const BACKEND_TO_PROVIDER: Record<string, AIProviderType> = {
  openai: AIProviderType.OpenAI,
  anthropic: AIProviderType.Anthropic,
  gemini: AIProviderType.Gemini,
  grok: AIProviderType.Grok,
}

export function getBackendProviderName(provider: AIProviderType): string {
  return PROVIDER_BACKEND_MAP[provider] ?? provider
}

export function getAvailableProviders(config: ProxyConfig): AIProviderType[] {
  const available: AIProviderType[] = []

  for (const name of config.aiProviders) {
    const provider = BACKEND_TO_PROVIDER[name.toLowerCase()]
    if (provider) available.push(provider)
  }

  // Default fallback order if no config
  if (available.length === 0) {
    return [AIProviderType.OpenAI, AIProviderType.Anthropic, AIProviderType.Gemini]
  }

  return available
}

export function getDefaultModel(provider: AIProviderType): string {
  switch (provider) {
    case AIProviderType.OpenAI:
      return 'gpt-4o'
    case AIProviderType.Anthropic:
      return 'claude-sonnet-4-20250514'
    case AIProviderType.Gemini:
      return 'gemini-2.0-flash'
    case AIProviderType.Grok:
      return 'grok-2'
    default:
      return 'gpt-4o'
  }
}
