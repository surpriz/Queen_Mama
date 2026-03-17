import { Feature } from '@/types/auth'
import type { FeatureAccess } from '@/types/auth'
import i18n from '@/i18n'

export { Feature }

export function isAllowed(access: FeatureAccess): boolean {
  return access.type === 'allowed'
}

export function getUpgradeMessage(access: FeatureAccess): string | null {
  switch (access.type) {
    case 'requiresPro':
      return i18n.t('license.upgradeToProUnlock')
    case 'requiresEnterprise':
      return i18n.t('license.upgradeToEnterpriseUnlock')
    case 'requiresAuth':
      return i18n.t('license.signInToUse')
    case 'limitReached':
      return i18n.t('license.dailyLimitReached', { used: access.used, limit: access.limit })
    case 'blocked':
      return i18n.t('license.featureNotAvailable')
    case 'allowed':
      return null
    default:
      return null
  }
}

export function getUpgradeUrl(): string {
  return 'https://www.queenmama.co/pricing'
}
