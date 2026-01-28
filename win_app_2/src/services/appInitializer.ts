/**
 * App Initialization Service
 *
 * Launch sequence:
 * 1. crashReporter.start()
 * 2. analytics.start()
 * 3. auth.checkExistingAuth()
 * 4. proxyConfig.fetch()
 * 5. license.validate()
 * 6. sync.performInitialSync()
 */

import { crashReporter } from '@/services/crash/crashReporter'
import { analyticsService } from '@/services/analytics/analyticsService'
import { checkExistingAuth } from '@/services/auth/authenticationManager'
import { proxyConfigManager } from '@/services/proxy/proxyConfigManager'
import { useLicenseStore } from '@/stores/licenseStore'
import { syncManager } from '@/services/sync/syncManager'
import { useAuthStore } from '@/stores/authStore'
import { initDb } from '@/db/client'

let initialized = false

export async function initializeApp(): Promise<void> {
  if (initialized) return
  initialized = true

  console.log('[AppInit] Starting initialization...')

  // 1. Initialize database
  try {
    initDb()
    console.log('[AppInit] Database initialized')
  } catch (error) {
    console.error('[AppInit] Database init failed:', error)
  }

  // 2. Crash reporter
  try {
    crashReporter.start()
    console.log('[AppInit] Crash reporter started')
  } catch (error) {
    console.error('[AppInit] Crash reporter failed:', error)
  }

  // 3. Analytics
  try {
    analyticsService.initialize()
    console.log('[AppInit] Analytics initialized')
  } catch (error) {
    console.error('[AppInit] Analytics failed:', error)
  }

  // 4. Check existing auth (non-blocking)
  try {
    const authResult = await checkExistingAuth()
    if (authResult) {
      console.log('[AppInit] Existing auth restored')
    } else {
      console.log('[AppInit] No existing auth')
    }
  } catch (error) {
    console.error('[AppInit] Auth check failed:', error)
  }

  // 5. Load proxy config (only if authenticated)
  const authState = useAuthStore.getState()
  if (authState.authState === 'authenticated') {
    try {
      await proxyConfigManager.getConfig()
      console.log('[AppInit] Proxy config loaded')
    } catch (error) {
      console.error('[AppInit] Proxy config failed:', error)
    }

    // 6. Validate license
    try {
      await useLicenseStore.getState().validate()
      console.log('[AppInit] License validated')
    } catch (error) {
      console.error('[AppInit] License validation failed:', error)
    }

    // 7. Initial sync (non-blocking)
    syncManager.performSync().catch((error) => {
      console.error('[AppInit] Initial sync failed:', error)
    })
  }

  console.log('[AppInit] Initialization complete')
}
