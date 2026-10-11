/**
 * App Initialization Service
 *
 * Two boot profiles share one bundle:
 *
 * - Session host (hidden `#/session` window): owns auth, license, sync,
 *   analytics identity and the whole session pipeline. Runs
 *   `checkExistingAuth` and every periodic task exactly once per app.
 *
 * - UI windows (dashboard / overlay / notification): load config + local DB
 *   caches for display, then mirror auth/license/session state from the host
 *   through the relay snapshot and broadcasts. They never validate the license
 *   or refresh tokens on their own.
 */

import * as crashReporter from '@/services/crash/crashReporter'
import * as analyticsService from '@/services/analytics/analyticsService'
import { checkExistingAuth } from '@/services/auth/authenticationManager'
import * as proxyConfigManager from '@/services/proxy/proxyConfigManager'
import * as licenseManager from '@/services/license/licenseManager'
import * as syncManager from '@/services/sync/syncManager'
import { useAuthStore } from '@/stores/authStore'
import { initializeDatabase } from '@/db/client'
import { loadSessions, closeOrphanSessions } from '@/services/session/sessionManager'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import { useContactStore } from '@/stores/contactStore'
import { modesService } from '@/services/modes/modesService'
import { useAppStore } from '@/stores/appStore'
import { useConfigStore } from '@/stores/configStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { installUserScopeSync } from '@/services/session/userScope'
import { useLicenseStore } from '@/stores/licenseStore'
import { isSessionHost, getWindowKind } from '@/lib/runtime'

let initialized = false

/** Reload everything that is scoped to the signed-in account. */
export async function reloadAccountData(): Promise<void> {
  await loadSessions()
  const contacts = await contactDb.getAllContacts()
  useContactStore.getState().setContacts(contacts)
  await useOverlayStore.getState().loadRecentResponses()
}
let postAuthRunning = false
let postAuthDone = false

async function step(label: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn()
    console.log(`[AppInit] ${label}: ok`)
  } catch (error) {
    console.error(`[AppInit] ${label}: failed`, error)
  }
}

/** Boot steps every window needs (config, device id, DB handle, local caches). */
async function initializeShared(): Promise<void> {
  // Crash reporting first so DB / session-load failures are captured too
  await step('Crash reporter', () => crashReporter.start())
  await step('Config load', () => useConfigStore.getState().loadFromStorage())
  await step('Device ID', () => syncManager.initDeviceId())
  await step('Database init', async () => {
    const userDataPath = await window.electronAPI?.getPath('userData')
    if (userDataPath) initializeDatabase(userDataPath)
  })
  await step('Sessions load', () => loadSessions())
  await step('Default mode', async () => {
    const allModes = await modesService.getAll()
    const defaultMode = allModes.find((m) => m.name === 'Default')
    if (defaultMode) useAppStore.getState().setSelectedMode(defaultMode)
  })
  await step('Contacts load', async () => {
    const contacts = await contactDb.getAllContacts()
    useContactStore.getState().setContacts(contacts)
  })
  await step('Recent AI responses', () => useOverlayStore.getState().loadRecentResponses())
}

/** PostHog identity (host only): user + current plan, refreshed when the plan changes. */
function identifyAnalyticsUser(): void {
  const user = useAuthStore.getState().currentUser
  if (!user) return
  const plan = useLicenseStore.getState().currentLicense.plan
  analyticsService.identify(user.id, user.email, user.name ?? null, plan)
}

/**
 * Everything that must happen once the host knows the user is authenticated:
 * proxy config, license, sync queue + periodic sync, contact pull.
 * Idempotent per auth session; `resetPostAuth()` re-arms it on logout.
 */
export async function runPostAuthTasks(): Promise<void> {
  if (!isSessionHost()) return
  if (postAuthRunning || postAuthDone) return
  if (!useAuthStore.getState().isAuthenticated) return
  postAuthRunning = true

  try {
    // Local rows are scoped per account: reload for this account before
    // anything (sync, contacts) reads them.
    await step('Account data scope', () => reloadAccountData())
    await step('Proxy config', () => proxyConfigManager.refreshConfig().then(() => undefined))
    await step('License validation', async () => {
      await licenseManager.revalidate()
      licenseManager.startPeriodicRevalidation()
    })
    identifyAnalyticsUser()
    await step('Sync queue', () => syncManager.loadQueue())
    syncManager.startPeriodicSync()
    await step('Contacts pull', async () => {
      const imported = await contactSyncService.pullContacts()
      if (imported.length > 0) {
        const allContacts = await contactDb.getAllContacts()
        useContactStore.getState().setContacts(allContacts)
      }
    })
    postAuthDone = true
  } finally {
    postAuthRunning = false
  }
}

/** Tear down per-user background work (logout / session expired). */
export function resetPostAuth(): void {
  postAuthDone = false
  licenseManager.stopPeriodicRevalidation()
  syncManager.stopPeriodicSync()
  syncManager.clearQueue()
  // UI windows are not allowed to publish license state; the host drops to
  // FREE here and broadcasts it (the dashboard already cleared the disk cache).
  licenseManager.resetOnLogout().catch((e) => console.warn('[AppInit] License reset failed:', e))
  analyticsService.reset()
}

async function initializeSessionHost(): Promise<void> {
  await initializeShared()
  // Sessions left open by a crash / force-quit (mac closes them at launch)
  await step('Orphan sessions', async () => {
    const { closed, deleted } = await closeOrphanSessions()
    if (closed || deleted) await loadSessions()
  })
  await step('Analytics', () => analyticsService.start())
  // Re-identify when the plan changes (upgrade mid-session)
  useLicenseStore.subscribe((state, prev) => {
    if (state.currentLicense.plan !== prev.currentLicense.plan && useAuthStore.getState().isAuthenticated) {
      identifyAnalyticsUser()
    }
  })

  // React to auth transitions no matter which window produced them (own
  // checkExistingAuth below, or a login/logout relayed from the dashboard).
  useAuthStore.subscribe((state, prev) => {
    if (state.isAuthenticated && !prev.isAuthenticated) {
      void runPostAuthTasks()
    } else if (!state.isAuthenticated && prev.isAuthenticated) {
      resetPostAuth()
    }
  })

  await step('Auth check', () => checkExistingAuth())
  await runPostAuthTasks()
}

async function initializeUiWindow(): Promise<void> {
  await initializeShared()
}

export async function initializeApp(): Promise<void> {
  if (initialized) return
  initialized = true

  const kind = getWindowKind()
  console.log(`[AppInit] Starting initialization (${kind})...`)
  installUserScopeSync(reloadAccountData)

  if (isSessionHost()) {
    await initializeSessionHost()
  } else {
    await initializeUiWindow()
  }

  console.log('[AppInit] Initialization complete')
}
