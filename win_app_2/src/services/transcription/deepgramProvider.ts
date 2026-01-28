import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'

const log = createLogger('Deepgram')

export class DeepgramProvider implements TranscriptionProvider {
  readonly name = 'Deepgram Nova-3'
  private ws: WebSocket | null = null
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null
  private token: string | null = null
  private tokenExpiry: number = 0

  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onError: ((error: Error) => void) | null = null

  get isConfigured(): boolean {
    return true // Uses proxy tokens
  }

  async connect(): Promise<void> {
    // Get token from proxy
    if (!this.token || Date.now() > this.tokenExpiry - 120000) {
      const tokenResponse = await getTranscriptionToken('deepgram')
      this.token = tokenResponse.token
      this.tokenExpiry = new Date(tokenResponse.expiresAt).getTime()
    }

    const url =
      'wss://api.deepgram.com/v1/listen?' +
      'model=nova-3&' +
      'language=multi&' +
      'smart_format=true&' +
      'interim_results=true&' +
      'encoding=linear16&' +
      'sample_rate=16000&' +
      'channels=1'

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url, ['token', this.token!])

      this.ws.onopen = () => {
        log.info('Connected')
        this.startKeepalive()
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
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

      this.ws.onerror = (event) => {
        log.error('WebSocket error', event)
        reject(new Error('Deepgram connection failed'))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code})`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          this.onError?.(new Error(`Deepgram disconnected: ${event.reason || event.code}`))
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
