/**
 * Per-account scoping of local data.
 *
 * The SQLite database lives in the Windows user profile, not in the Queen Mama
 * account. Without an owner column, signing out and signing in with another
 * account on the same PC showed (and would sync up) the previous account's
 * sessions and contacts. Rows carry `owner_user_id`; rows created before this
 * existed (NULL) are adopted by the first account that signs in.
 */

import { db } from '@/db/client'
import { useAuthStore } from '@/stores/authStore'
import { useSessionStore } from '@/stores/sessionStore'
import { useContactStore } from '@/stores/contactStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { createLogger } from '@/lib/logger'

const log = createLogger('UserScope')

/** Account id that owns rows created now; null while signed out. */
export function currentOwnerId(): string | null {
  return useAuthStore.getState().currentUser?.id ?? null
}

/** SQL fragment + params restricting a query to the signed-in account (or legacy rows when signed out). */
export function ownerFilter(column = 'owner_user_id'): { sql: string; params: unknown[] } {
  const owner = currentOwnerId()
  return owner ? { sql: `${column} = ?`, params: [owner] } : { sql: `${column} IS NULL`, params: [] }
}

/** Assign legacy (NULL owner) rows to the signed-in account. Idempotent. */
export async function adoptLegacyRows(): Promise<void> {
  const owner = currentOwnerId()
  if (!owner) return
  try {
    const s = await db.query('UPDATE sessions SET owner_user_id = ? WHERE owner_user_id IS NULL', [owner])
    const c = await db.query('UPDATE contacts SET owner_user_id = ? WHERE owner_user_id IS NULL', [owner])
    if ((s.changes ?? 0) > 0 || (c.changes ?? 0) > 0) {
      log.info(`Adopted legacy rows: ${s.changes ?? 0} sessions, ${c.changes ?? 0} contacts`)
    }
  } catch (err) {
    log.warn('Legacy row adoption failed', err)
  }
}

/** Drop everything account-specific from memory (sign-out / account switch). */
export function clearAccountState(): void {
  useSessionStore.getState().setSessions([])
  useSessionStore.getState().setCurrentSession(null)
  useContactStore.getState().setContacts([])
  useOverlayStore.getState().clearHistory()
}

let installed = false

/**
 * Keep in-memory data aligned with the signed-in account in every window:
 * sign-out clears it, sign-in adopts legacy rows and reloads.
 */
export function installUserScopeSync(reload: () => Promise<void>): () => void {
  if (installed) return () => undefined
  installed = true
  let lastUserId = currentOwnerId()
  const unsub = useAuthStore.subscribe((state) => {
    const userId = state.currentUser?.id ?? null
    if (userId === lastUserId) return
    lastUserId = userId
    clearAccountState()
    if (userId) {
      adoptLegacyRows()
        .then(reload)
        .catch((err) => log.warn('Reload after sign-in failed', err))
    }
  })
  return () => {
    unsub()
    installed = false
  }
}
