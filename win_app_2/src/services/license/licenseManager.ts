import { createLogger } from '@/lib/logger'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import * as authApi from '../auth/authApiClient'
import type { License } from '@/types/auth'
import { FREE_LICENSE } from '@/types/auth'

const log = createLogger('License')

const GRACE_PERIOD_DAYS = 7
const REVALIDATION_INTERVAL = 60 * 60 * 1000 // 60 minutes

let revalidationTimer: ReturnType<typeof setInterval> | null = null

export async function revalidate(): Promise<void> {
  const authStore = useAuthStore.getState()
  const licenseStore = useLicenseStore.getState()

  if (!authStore.isAuthenticated) {
    licenseStore.setLicense(FREE_LICENSE)
    return
  }

  licenseStore.setValidating(true)

  try {
    const deviceInfo = await window.electronAPI?.getDeviceInfo()
    const license = await authApi.validateLicense(deviceInfo?.deviceId || 'unknown')

    licenseStore.setLicense(license)
    licenseStore.setLastValidatedAt(new Date().toISOString())
    licenseStore.setOffline(false)

    // Update usage from server
    if (license.usage) {
      // Direct state update via store
      useLicenseStore.setState({
        smartModeUsedToday: license.usage.smartModeUsedToday,
        aiRequestsToday: license.usage.aiRequestsToday,
      })
    }

    // Cache
    await window.electronAPI?.store.set('cached_license', JSON.stringify(license))
    await window.electronAPI?.store.set(
      'cached_license_expiry',
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    )

    log.info(`License validated: ${license.plan} (${license.status})`)
  } catch (error) {
    log.error('Validation failed', error)
    licenseStore.setOffline(true)

    // Use cached license
    const cachedJson = (await window.electronAPI?.store.get('cached_license')) as string | null
    if (cachedJson) {
      try {
        const cached: License = JSON.parse(cachedJson)
        const expiry = (await window.electronAPI?.store.get('cached_license_expiry')) as
          | number
          | null
        if (expiry && Date.now() < expiry) {
          licenseStore.setLicense(cached)
        } else {
          licenseStore.setLicense(FREE_LICENSE)
        }
      } catch {
        licenseStore.setLicense(FREE_LICENSE)
      }
    }
  }

  licenseStore.setValidating(false)
}

export function startPeriodicRevalidation(): void {
  stopPeriodicRevalidation()
  revalidationTimer = setInterval(async () => {
    const authStore = useAuthStore.getState()
    if (!authStore.isAuthenticated) return

    const licenseStore = useLicenseStore.getState()
    const lastValidated = licenseStore.lastValidatedAt
    if (lastValidated) {
      const elapsed = Date.now() - new Date(lastValidated).getTime()
      if (elapsed < 5 * 60 * 1000) return // Skip if validated in last 5 min
    }

    await revalidate()
  }, REVALIDATION_INTERVAL)
}

export function stopPeriodicRevalidation(): void {
  if (revalidationTimer) {
    clearInterval(revalidationTimer)
    revalidationTimer = null
  }
}

export async function recordUsage(feature: string, provider?: string): Promise<void> {
  const licenseStore = useLicenseStore.getState()

  switch (feature) {
    case 'smartMode':
      licenseStore.recordSmartModeUsage()
      break
    case 'aiRequest':
      licenseStore.recordAiRequestUsage()
      break
  }

  // Fire and forget server recording
  try {
    await authApi.recordUsage(feature, provider)
  } catch {
    log.warn('Failed to record usage to server')
  }
}
