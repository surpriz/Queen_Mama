import { useCallback } from 'react'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'

export function useLicense() {
  const currentLicense = useLicenseStore((s) => s.currentLicense)
  const isValidating = useLicenseStore((s) => s.isValidating)
  const canUse = useLicenseStore((s) => s.canUse)
  const isPro = useLicenseStore((s) => s.isPro)
  const isEnterprise = useLicenseStore((s) => s.isEnterprise)

  const isFree = !isPro()

  const checkFeature = useCallback(
    (feature: Feature) => {
      return canUse(feature)
    },
    [canUse],
  )

  return {
    license: currentLicense,
    isValidating,
    isPro: isPro(),
    isEnterprise: isEnterprise(),
    isFree,
    checkFeature,
  }
}
