/**
 * Per-account scoping of local data.
 *
 * The SQLite database lives in the Windows user profile, not in the Queen Mama
 * account. Without an owner column, signing out and signing in with another
 * account on the same PC showed (and would sync up) the previous account's
 * sessions and contacts. Rows carry `owner_user_id`. Rows created before the
 * column existed were assigned once, by the DB migration, to the account that
 * was signed in during the upgrade; they are never attached to a later account
 * automatically (that would be the same cross-account leak in disguise).
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

/** Number of rows no account owns (diagnostics only; nothing adopts them). */
export async function countUnownedRows(): Promise<{ sessions: number; contacts: number }> {
  try {
    const s = await db.queryGet<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE owner_user_id IS NULL')
    const c = await db.queryGet<{ n: number }>('SELECT COUNT(*) AS n FROM contacts WHERE owner_user_id IS NULL')
    return { sessions: s?.n ?? 0, contacts: c?.n ?? 0 }
  } catch (err) {
    log.warn('Unowned row count failed', err)
    return { sessions: 0, contacts: 0 }
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
 * sign-out clears it, sign-in reloads the new account's rows.
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
      reload().catch((err) => log.warn('Reload after sign-in failed', err))
    }
  })
  return () => {
    unsub()
    installed = false
  }
}
