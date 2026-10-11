import { app } from 'electron'
import { existsSync, renameSync, cpSync } from 'fs'
import { join } from 'path'

/**
 * The product was shipped as "Queen Mama Electron", which is also the name of
 * the per-user data folder (%APPDATA%/Queen Mama Electron: SQLite DB, config,
 * tokens). Renaming the product to "Queen Mama" moves the default userData
 * path, so the first launch of the renamed build carries the old folder over.
 *
 * Must run before anything touches `app.getPath('userData')` (electron-store
 * instances are created at module load), hence the import at the very top of
 * main.ts.
 */
const LEGACY_PRODUCT_NAME = 'Queen Mama Electron'

export function migrateLegacyUserData(): void {
  try {
    const current = app.getPath('userData')
    const legacy = join(app.getPath('appData'), LEGACY_PRODUCT_NAME)
    if (legacy === current || !existsSync(legacy)) return
    if (existsSync(current)) {
      // Both exist (a fresh profile was already created): keep the new one,
      // never merge silently.
      console.log('[UserData] Legacy folder present but current folder already exists; leaving both')
      return
    }
    try {
      renameSync(legacy, current)
    } catch {
      cpSync(legacy, current, { recursive: true })
    }
    console.log(`[UserData] Migrated ${legacy} -> ${current}`)
  } catch (err) {
    console.error('[UserData] Migration failed:', err)
  }
}

migrateLegacyUserData()
