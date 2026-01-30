import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'

let cachedDeviceId: string | null = null

function getDeviceIdPath(): string {
  return path.join(app.getPath('userData'), '.device-id')
}

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId

  const idPath = getDeviceIdPath()

  // Try to read existing
  try {
    if (fs.existsSync(idPath)) {
      const id = fs.readFileSync(idPath, 'utf-8').trim()
      if (id) {
        cachedDeviceId = id
        return id
      }
    }
  } catch {
    // Generate new
  }

  // Generate persistent UUID
  const id = crypto.randomUUID()
  try {
    fs.writeFileSync(idPath, id, 'utf-8')
  } catch (error) {
    console.error('[DeviceIdentifier] Failed to persist device ID:', error)
  }

  cachedDeviceId = id
  return id
}

export function getDeviceInfo() {
  return {
    deviceId: getDeviceId(),
    deviceName: os.hostname(),
    platform: process.platform === 'win32' ? 'windows' : 'macOS',
    osVersion: os.release(),
    appVersion: app.getVersion(),
  }
}
