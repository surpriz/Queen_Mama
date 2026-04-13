import { useState, useCallback, useRef, useEffect } from 'react'
import * as audioCaptureService from '@/services/audio/audioCaptureService'

export function useAudioCapture() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const audioDataCallbackRef = useRef<((data: ArrayBuffer) => void) | null>(null)

  const start = useCallback(async () => {
    try {
      setError(null)

      // Set up audio level callback
      audioCaptureService.setOnAudioLevel((level: number) => {
        setAudioLevel(level)
      })

      // Set up audio data callback
      if (audioDataCallbackRef.current) {
        audioCaptureService.setOnMicAudioBuffer(audioDataCallbackRef.current)
      }

      await audioCaptureService.startCapture()
      setIsCapturing(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start audio capture'
      setError(message)
      console.error('[useAudioCapture] Start failed:', err)
    }
  }, [])

  const stop = useCallback(() => {
    audioCaptureService.stopCapture()
    setIsCapturing(false)
    setAudioLevel(0)
  }, [])

  const onAudioData = useCallback((callback: (data: ArrayBuffer) => void) => {
    audioDataCallbackRef.current = callback
    audioCaptureService.setOnMicAudioBuffer(callback)
  }, [])

  useEffect(() => {
    return () => {
      if (isCapturing) {
        audioCaptureService.stopCapture()
      }
    }
  }, [isCapturing])

  return {
    isCapturing,
    audioLevel,
    error,
    start,
    stop,
    onAudioData,
  }
}
