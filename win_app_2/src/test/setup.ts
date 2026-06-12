import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.electronAPI
const mockElectronAPI = {
  getDeviceInfo: vi.fn().mockResolvedValue({
    deviceId: 'test-device-id',
    deviceName: 'Test Device',
    platform: 'windows' as const,
    osVersion: '10.0',
    appVersion: '1.0.0',
  }),
  store: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  secureStore: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
  },
  auth: {
    refreshToken: vi.fn().mockResolvedValue({ ok: false, code: 'no_token' }),
    onProtocolCallback: vi.fn(),
    startOAuthServer: vi.fn().mockResolvedValue({ success: true }),
    stopOAuthServer: vi.fn().mockResolvedValue({ success: true }),
  },
  openExternal: vi.fn().mockResolvedValue(undefined),
  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true }),
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true }),
  },
  fs: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
  },
  device: {
    getInfo: vi.fn().mockResolvedValue({
      deviceId: 'test-device-id',
      deviceName: 'Test Device',
      platform: 'windows' as const,
      osVersion: '10.0',
      appVersion: '1.0.0',
    }),
  },
}

Object.assign(globalThis.window || {}, {
  electronAPI: mockElectronAPI,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

// Mock navigator
Object.defineProperty(globalThis, 'navigator', {
  value: {
    onLine: true,
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  },
  writable: true,
})

// Mock AudioContext
class MockAudioContext {
  sampleRate = 48000
  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  createGain = vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  })
  close = vi.fn()
}

// @ts-expect-error - mocking global
globalThis.AudioContext = MockAudioContext

// Mock fetch
globalThis.fetch = vi.fn()
