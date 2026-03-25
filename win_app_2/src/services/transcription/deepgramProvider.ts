import type { TranscriptionProvider } from './types'
import { getAccessToken } from '../auth/authenticationManager'
import { getApiBaseUrl } from '../config/appEnvironment'
import { createLogger } from '@/lib/logger'

const log = createLogger('Deepgram')

// WebSocket proxy port - configurable via environment variable
const PROXY_PORT = import.meta.env.VITE_TRANSCRIPTION_PROXY_PORT || 3001

export class DeepgramProvider implements TranscriptionProvider {
  readonly name = 'Deepgram Nova-3'
  private ws: WebSocket | null = null
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null

  language: string = 'fr'
  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onError: ((error: Error) => void) | null = null

  get isConfigured(): boolean {
    // Only configured if the WS proxy port is explicitly set
    return !!import.meta.env.VITE_TRANSCRIPTION_PROXY_PORT
  }

  async connect(): Promise<void> {
    // Get auth token for the proxy
    const authToken = await getAccessToken()

    // Build proxy URL - connects to our backend which proxies to Deepgram
    // The API key never leaves the server
    const baseUrl = getApiBaseUrl()
    const url = new URL(baseUrl)

    // Use correct WebSocket protocol based on HTTP protocol
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = url.hostname

    // Build the proxy URL with proper protocol
    const lang = this.language || 'multi'
    const langParam = lang === 'multi' ? 'detect_language=true' : `language=${lang}`
    const proxyUrl = `${wsProtocol}//${host}:${PROXY_PORT}?token=${encodeURIComponent(authToken)}&${langParam}&model=nova-3`

    log.info(`Connecting to transcription proxy at ${wsProtocol}//${host}:${PROXY_PORT}...`)

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(proxyUrl)
      this.ws = ws

      this.ws.onopen = () => {
        log.info('Connected')
        this.startKeepalive()
        resolve()
      }

      this.ws.onmessage = async (event) => {
        try {
          // Handle Blob data (browser WebSocket may receive as Blob)
          let textData: string
          if (event.data instanceof Blob) {
            textData = await event.data.text()
          } else {
            textData = event.data
          }

          const data = JSON.parse(textData)

          // Handle proxy-specific messages
          if (data.type === 'connected') {
            log.info('Proxy connected to Deepgram')
            return
          }
          if (data.type === 'error') {
            log.error('Proxy error:', data.message)
            this.onError?.(new Error(data.message))
            return
          }

          // Handle Deepgram transcription results
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || ''
            if (transcript.trim()) {
              if (data.is_final) {
                this.onTranscript?.(transcript)
              } else {
                this.onInterimTranscript?.(transcript)
              }
            }
          }
        } catch (error) {
          log.error('Parse error', error)
        }
      }

      this.ws.onerror = (event: Event) => {
        const wsEvent = event as ErrorEvent
        log.error('WebSocket error:', wsEvent.message || 'Unknown error')
        reject(new Error('Transcription proxy connection failed'))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected - code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean}`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          this.onError?.(new Error(`Transcription disconnected: ${event.reason || event.code}`))
        }
      }
    })
  }

  disconnect(): void {
    this.stopKeepalive()
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send close frame
      this.ws.send(JSON.stringify({ type: 'CloseStream' }))
      this.ws.close(1000)
    }
    this.ws = null
  }

  sendAudio(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  private startKeepalive(): void {
    this.keepaliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
      }
    }, 8000)
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval)
      this.keepaliveInterval = null
    }
  }
}
