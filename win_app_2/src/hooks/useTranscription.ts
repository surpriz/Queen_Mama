import { useState, useCallback, useRef } from 'react'
import * as transcriptionService from '@/services/transcription/transcriptionService'

interface TranscriptEntry {
  text: string
  isFinal: boolean
  speaker: string
  timestamp: Date
}

export function useTranscription() {
  const [isConnected, setIsConnected] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [fullText, setFullText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const interimRef = useRef('')

  const connect = useCallback(async () => {
    try {
      setError(null)

      transcriptionService.setCallbacks({
        onTranscript: (text: string) => {
          const entry: TranscriptEntry = {
            text,
            isFinal: true,
            speaker: 'user',
            timestamp: new Date(),
          }

          setTranscript((prev) => [...prev, entry])
          setFullText((prev) => {
            const separator = prev.length > 0 ? ' ' : ''
            return prev + separator + text
          })
          interimRef.current = ''
        },
        onInterimTranscript: (text: string) => {
          interimRef.current = text
        },
        onError: (err: Error) => {
          setError(err.message)
          console.error('[useTranscription] Error:', err)
        },
        onConnectionChanged: (connected: boolean) => {
          setIsConnected(connected)
        },
      })

      await transcriptionService.connect()
      setIsConnected(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transcription connection failed'
      setError(message)
    }
  }, [])

  const disconnect = useCallback(() => {
    transcriptionService.disconnect()
    setIsConnected(false)
  }, [])

  const sendAudio = useCallback((data: ArrayBuffer) => {
    transcriptionService.sendAudio(data)
  }, [])

  const clear = useCallback(() => {
    setTranscript([])
    setFullText('')
    interimRef.current = ''
  }, [])

  return {
    isConnected,
    transcript,
    fullText,
    interimText: interimRef.current,
    error,
    connect,
    disconnect,
    sendAudio,
    clear,
  }
}
