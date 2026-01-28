import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'

const log = createLogger('DeepgramFlux')

export class DeepgramFluxProvider implements TranscriptionProvider {
  readonly name = 'Deepgram Flux'
  private ws: WebSocket | null = null
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null
  private token: string | null = null

  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onError: ((error: Error) => void) | null = null

  get isConfigured(): boolean {
    return true
  }

  async connect(): Promise<void> {
    const tokenResponse = await getTranscriptionToken('deepgram')
    this.token = tokenResponse.token

    const url =
      'wss://api.deepgram.com/v2/listen?' +
      'model=flux-general-en&' +
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

      this.ws.onerror = () => reject(new Error('Deepgram Flux connection failed'))

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code})`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          this.onError?.(new Error(`Deepgram Flux disconnected: ${event.code}`))
        }
      }
    })
  }

  disconnect(): void {
    this.stopKeepalive()
    if (this.ws?.readyState === WebSocket.OPEN) {
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
