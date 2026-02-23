import { useEffect } from 'react'
import { OverlayApp } from '@/components/overlay/OverlayApp'
import { useTranscriptSync } from '@/hooks/useTranscriptSync'

export function OverlayPage() {
  useTranscriptSync()

  useEffect(() => {
    // Make body transparent for overlay window
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'

    return () => {
      // Restore on unmount (not really needed but good practice)
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])

  return <OverlayApp />
}
