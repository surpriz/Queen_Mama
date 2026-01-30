import { useCallback, useEffect } from 'react'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'

export function useLicense() {
  const license = useLicenseStore((s) => s.license)
  const isValidating = useLicenseStore((s) => s.isValidating)
  const canUse = useLicenseStore((s) => s.canUse)
  const validate = useLicenseStore((s) => s.validate)

  const isPro = license?.plan === 'pro' || license?.plan === 'enterprise'
  const isEnterprise = license?.plan === 'enterprise'
  const isFree = !license || license.plan === 'free'

  const checkFeature = useCallback(
    (feature: Feature) => {
      return canUse(feature)
    },
    [canUse],
  )

  // Periodic revalidation
  useEffect(() => {
    const interval = setInterval(
      () => {
        validate()
      },
      60 * 60 * 1000,
    ) // Every hour
    return () => clearInterval(interval)
  }, [validate])

  return {
    license,
    isValidating,
    isPro,
    isEnterprise,
    isFree,
    checkFeature,
    validate,
  }
}
