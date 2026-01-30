import type { AIProviderType } from '@/types/models'
import type { ProxyConfig } from '@/types/api'

// Maps internal provider types to backend proxy names
const PROVIDER_BACKEND_MAP: Record<AIProviderType, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini',
  grok: 'grok',
}

export function getBackendProviderName(provider: AIProviderType): string {
  return PROVIDER_BACKEND_MAP[provider] ?? provider
}

export function getAvailableProviders(config: ProxyConfig): AIProviderType[] {
  const available: AIProviderType[] = []

  if (config.providers?.openai?.enabled) available.push('openai')
  if (config.providers?.anthropic?.enabled) available.push('anthropic')
  if (config.providers?.gemini?.enabled) available.push('gemini')
  if (config.providers?.grok?.enabled) available.push('grok')

  // Default fallback order if no config
  if (available.length === 0) {
    return ['openai', 'anthropic', 'gemini']
  }

  return available
}

export function getDefaultModel(provider: AIProviderType): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o'
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'gemini':
      return 'gemini-2.0-flash'
    case 'grok':
      return 'grok-2'
    default:
      return 'gpt-4o'
  }
}
