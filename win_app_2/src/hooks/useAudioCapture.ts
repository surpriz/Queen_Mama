import { useState, useCallback, useRef, useEffect } from 'react'
import { audioCaptureService } from '@/services/audio/audioCaptureService'

export function useAudioCapture() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const levelInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)
      await audioCaptureService.start()
      setIsCapturing(true)

      // Poll audio level
      levelInterval.current = setInterval(() => {
        setAudioLevel(audioCaptureService.getAudioLevel())
      }, 100)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start audio capture'
      setError(message)
      console.error('[useAudioCapture] Start failed:', err)
    }
  }, [])

  const stop = useCallback(() => {
    audioCaptureService.stop()
    setIsCapturing(false)
    setAudioLevel(0)

    if (levelInterval.current) {
      clearInterval(levelInterval.current)
      levelInterval.current = null
    }
  }, [])

  const onAudioData = useCallback((callback: (data: ArrayBuffer) => void) => {
    audioCaptureService.onAudioData(callback)
  }, [])

  useEffect(() => {
    return () => {
      if (levelInterval.current) {
        clearInterval(levelInterval.current)
      }
    }
  }, [])

  return {
    isCapturing,
    audioLevel,
    error,
    start,
    stop,
    onAudioData,
  }
}
