import { useState, useCallback, useRef } from 'react'
import { screenCaptureService } from '@/services/screenCapture/screenCaptureService'

export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [captureCount, setCaptureCount] = useState(0)
  const callbackRef = useRef<((image: string) => void) | null>(null)

  const startAutoCapture = useCallback((intervalMs?: number) => {
    screenCaptureService.onCapture((image) => {
      setLastCapture(image)
      setCaptureCount((c) => c + 1)
      callbackRef.current?.(image)
    })
    screenCaptureService.startAutoCapture(intervalMs)
    setIsCapturing(true)
  }, [])

  const stopAutoCapture = useCallback(() => {
    screenCaptureService.stopAutoCapture()
    setIsCapturing(false)
  }, [])

  const captureOnce = useCallback(async () => {
    const image = await screenCaptureService.captureOnce()
    if (image) {
      setLastCapture(image)
      setCaptureCount((c) => c + 1)
    }
    return image
  }, [])

  const onCapture = useCallback((callback: (image: string) => void) => {
    callbackRef.current = callback
  }, [])

  return {
    isCapturing,
    lastCapture,
    captureCount,
    startAutoCapture,
    stopAutoCapture,
    captureOnce,
    onCapture,
  }
}
