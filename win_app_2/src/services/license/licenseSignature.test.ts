import { describe, it, expect } from 'vitest'
import { webcrypto, createHmac } from 'node:crypto'
import { buildSignaturePayload, computeLicenseSignature, verifyLicenseSignature, constantTimeEqual } from './licenseSignature'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus, type License } from '@/types/auth'

const subtle = webcrypto.subtle as unknown as SubtleCrypto

const PRO: License = {
  ...FREE_LICENSE,
  plan: SubscriptionPlan.Pro,
  status: SubscriptionStatus.Active,
  trial: { isActive: true, daysRemaining: 5, endsAt: '2026-12-01T00:00:00.000Z' },
  cacheTTL: 3600,
  validatedAt: '2026-10-11T10:00:00.000Z',
  signature: '',
}

describe('licenseSignature', () => {
  it('reproduces the backend payload (same fields, same order) and signature', async () => {
    const secret = 'test-secret'
    // The backend signs crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    const serverPayload = JSON.stringify({
      valid: PRO.valid,
      plan: PRO.plan,
      status: PRO.status,
      features: PRO.features,
      trial: PRO.trial,
      cacheTTL: PRO.cacheTTL,
      validatedAt: PRO.validatedAt,
    })
    expect(buildSignaturePayload(PRO)).toBe(serverPayload)
    const serverSig = createHmac('sha256', secret).update(serverPayload).digest('hex')
    expect(await computeLicenseSignature(PRO, secret, subtle)).toBe(serverSig)
    expect(await verifyLicenseSignature({ ...PRO, signature: serverSig }, secret, subtle)).toBe('valid')
  })

  it('rejects a tampered plan', async () => {
    const secret = 'test-secret'
    const sig = await computeLicenseSignature(PRO, secret, subtle)
    const tampered = { ...PRO, plan: SubscriptionPlan.Enterprise, signature: sig }
    expect(await verifyLicenseSignature(tampered, secret, subtle)).toBe('invalid')
  })

  it('skips when no secret is configured or for an unsigned local FREE license', async () => {
    expect(await verifyLicenseSignature({ ...PRO, signature: 'abc' }, null, subtle)).toBe('skipped')
    expect(await verifyLicenseSignature(FREE_LICENSE, 'secret', subtle)).toBe('skipped')
    expect(await verifyLicenseSignature({ ...PRO, signature: '' }, 'secret', subtle)).toBe('invalid')
  })

  it('constant-time compare', () => {
    expect(constantTimeEqual('abcd', 'abcd')).toBe(true)
    expect(constantTimeEqual('abcd', 'abce')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })
})
