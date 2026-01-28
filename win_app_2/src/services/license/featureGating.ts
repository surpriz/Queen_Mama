import { Feature } from '@/types/auth'
import type { FeatureAccess } from '@/types/auth'

export { Feature }

export function isAllowed(access: FeatureAccess): boolean {
  return access.type === 'allowed'
}

export function getUpgradeMessage(access: FeatureAccess): string | null {
  switch (access.type) {
    case 'requiresPro':
      return 'Upgrade to Pro to unlock this feature'
    case 'requiresEnterprise':
      return 'Upgrade to Enterprise to unlock this feature'
    case 'requiresAuth':
      return 'Sign in to use this feature'
    case 'limitReached':
      return `Daily limit reached (${access.used}/${access.limit})`
    case 'blocked':
      return 'This feature is not available'
    case 'allowed':
      return null
    default:
      return null
  }
}

export function getUpgradeUrl(): string {
  return 'https://queenmama.ai/pricing'
}
