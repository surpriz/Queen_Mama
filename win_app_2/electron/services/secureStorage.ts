import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const STORAGE_DIR = path.join(app.getPath('userData'), 'secure')

function ensureDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

function getFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(STORAGE_DIR, `${safeKey}.enc`)
}

export function secureStore(key: string, value: string): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[SecureStorage] Encryption not available, storing as plain text')
      ensureDir()
      fs.writeFileSync(getFilePath(key), value, 'utf-8')
      return true
    }

    ensureDir()
    const encrypted = safeStorage.encryptString(value)
    fs.writeFileSync(getFilePath(key), encrypted)
    return true
  } catch (error) {
    console.error('[SecureStorage] Failed to store:', error)
    return false
  }
}

export function secureRetrieve(key: string): string | null {
  try {
    const filePath = getFilePath(key)
    if (!fs.existsSync(filePath)) return null

    if (!safeStorage.isEncryptionAvailable()) {
      return fs.readFileSync(filePath, 'utf-8')
    }

    const encrypted = fs.readFileSync(filePath)
    return safeStorage.decryptString(encrypted)
  } catch (error) {
    console.error('[SecureStorage] Failed to retrieve:', error)
    return null
  }
}

export function secureDelete(key: string): boolean {
  try {
    const filePath = getFilePath(key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('[SecureStorage] Failed to delete:', error)
    return false
  }
}

export function secureHas(key: string): boolean {
  return fs.existsSync(getFilePath(key))
}
