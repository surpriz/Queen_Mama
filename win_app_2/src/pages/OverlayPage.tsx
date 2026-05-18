import { useEffect } from 'react'
import { OverlayApp } from '@/components/overlay/OverlayApp'
import { useTranscriptSync } from '@/hooks/useTranscriptSync'

export function OverlayPage() {
  useTranscriptSync()

  useEffect(() => {
    // Make body transparent for overlay window
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    // Disable ambient mesh/noise (which would defeat window transparency)
    document.documentElement.classList.add('qm-overlay-window')

    return () => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
      document.documentElement.classList.remove('qm-overlay-window')
    }
  }, [])

  return <OverlayApp />
}
