import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: true }, session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } } }))

import { buildContentSecurityPolicy } from './contentSecurityPolicy'

describe('buildContentSecurityPolicy', () => {
  it('locks scripts to the bundle and lists only known network hosts', () => {
    const csp = buildContentSecurityPolicy({})
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain('wss://api.deepgram.com')
    expect(csp).toContain('https://www.queenmama.co')
  })

  it('adds env-provided API / telemetry origins', () => {
    const csp = buildContentSecurityPolicy({
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_SENTRY_DSN: 'https://abc@o123.ingest.us.sentry.io/456',
    })
    expect(csp).toContain('http://localhost:3000')
    expect(csp).toContain('https://o123.ingest.us.sentry.io')
  })
})
