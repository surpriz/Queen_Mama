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

import * as crashReporter from '@/services/crash/crashReporter'
import * as analyticsService from '@/services/analytics/analyticsService'
import { checkExistingAuth } from '@/services/auth/authenticationManager'
import * as proxyConfigManager from '@/services/proxy/proxyConfigManager'
import * as licenseManager from '@/services/license/licenseManager'
import * as syncManager from '@/services/sync/syncManager'
import { useAuthStore } from '@/stores/authStore'
import { initializeDatabase } from '@/db/client'
import { loadSessions } from '@/services/session/sessionManager'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import { useContactStore } from '@/stores/contactStore'
import { modesService } from '@/services/modes/modesService'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'

let initialized = false

export async function initializeApp(): Promise<void> {
  if (initialized) return
  initialized = true

  console.log('[AppInit] Starting initialization...')

  // Refresh proxy config whenever auth transitions to authenticated. The boot
  // fetch (step 5) is gated on auth being ready in time; on a slow token refresh
  // it gets skipped, leaving translation/config disabled for the whole session
  // even though the license resolves correctly later. Re-fetch on every auth gain.
  useAuthStore.subscribe((state, prev) => {
    if (state.isAuthenticated && !prev.isAuthenticated) {
      proxyConfigManager.refreshConfig().catch((e) =>
        console.warn('[AppInit] Proxy config refresh after auth failed:', e),
      )
    }
  })

  // Load persisted user config (showLiveTranscript, captureSystemAudio, etc.)
  // Must run in every window (dashboard + overlay) so each Zustand instance
  // reflects the user's saved preferences instead of falling back to defaults.
  try {
    await useConfigStore.getState().loadFromStorage()
    console.log('[AppInit] Config loaded from storage')
  } catch (error) {
    console.error('[AppInit] Config load failed:', error)
  }

  // 1. Initialize device ID cache (for sync)
  try {
    await syncManager.initDeviceId()
    console.log('[AppInit] Device ID cached')
  } catch (error) {
    console.error('[AppInit] Device ID init failed:', error)
  }

  // 2. Initialize database
  try {
    const userDataPath = await window.electronAPI?.getPath('userData')
    if (userDataPath) {
      initializeDatabase(userDataPath)
    }
    console.log('[AppInit] Database initialized')
  } catch (error) {
    console.error('[AppInit] Database init failed:', error)
  }

  // 2b. Load persisted sessions from DB
  try {
    await loadSessions()
    console.log('[AppInit] Sessions loaded from DB')
  } catch (error) {
    console.error('[AppInit] Sessions load failed:', error)
  }

  // 2c. Auto-select Default mode
  try {
    const allModes = await modesService.getAll()
    const defaultMode = allModes.find((m) => m.name === 'Default')
    if (defaultMode) {
      useAppStore.getState().setSelectedMode(defaultMode)
      console.log('[AppInit] Default mode selected')
    }
  } catch (error) {
    console.error('[AppInit] Default mode selection failed:', error)
  }

  // 2d. Load contacts from DB
  try {
    const contacts = await contactDb.getAllContacts()
    useContactStore.getState().setContacts(contacts)
    console.log('[AppInit] Contacts loaded from DB')
  } catch (error) {
    console.error('[AppInit] Contacts load failed:', error)
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
    analyticsService.start()
    console.log('[AppInit] Analytics initialized')
  } catch (error) {
    console.error('[AppInit] Analytics failed:', error)
  }

  // 4. Check existing auth (non-blocking)
  try {
    await checkExistingAuth()
    console.log('[AppInit] Auth check completed')
  } catch (error) {
    console.error('[AppInit] Auth check failed:', error)
  }

  // 5. Load proxy config (only if authenticated)
  const { isAuthenticated } = useAuthStore.getState()
  if (isAuthenticated) {
    try {
      await proxyConfigManager.getProxyConfig()
      console.log('[AppInit] Proxy config loaded')
    } catch (error) {
      console.error('[AppInit] Proxy config failed:', error)
    }

    // 6. Validate license
    try {
      await licenseManager.revalidate()
      licenseManager.startPeriodicRevalidation()
      console.log('[AppInit] License validated')
    } catch (error) {
      console.error('[AppInit] License validation failed:', error)
    }

    // 7. Load sync queue from previous runs, then start periodic sync
    try {
      await syncManager.loadQueue()
      console.log('[AppInit] Sync queue loaded')
    } catch (error) {
      console.error('[AppInit] Sync queue load failed:', error)
    }
    syncManager.startPeriodicSync()

    // 8. Pull contacts from server and merge with local DB
    try {
      const imported = await contactSyncService.pullContacts()
      if (imported.length > 0) {
        const allContacts = await contactDb.getAllContacts()
        useContactStore.getState().setContacts(allContacts)
        console.log(`[AppInit] Pulled ${imported.length} contacts from server`)
      }
    } catch (error) {
      console.error('[AppInit] Contact pull failed:', error)
    }
  }

  console.log('[AppInit] Initialization complete')
}
