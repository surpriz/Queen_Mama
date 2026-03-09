import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'

const log = createLogger('DeepgramFlux')

export class DeepgramFluxProvider implements TranscriptionProvider {
  readonly name = 'Deepgram Flux'
  private ws: WebSocket | null = null
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null
  private token: string | null = null

  language: string = 'fr'
  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onError: ((error: Error) => void) | null = null

  get isConfigured(): boolean {
    return true
  }

  async connect(): Promise<void> {
    const tokenResponse = await getTranscriptionToken('deepgram')
    this.token = tokenResponse.token
    log.info('Token received')

    const lang = this.language || 'fr'
    let url =
      'wss://api.deepgram.com/v1/listen?' +
      `model=nova-3&` +
      `language=${lang}&` +
      'smart_format=true&' +
      'interim_results=true&' +
      'encoding=linear16&' +
      'sample_rate=16000&' +
      'channels=1'

    log.info(`Connecting to Deepgram (lang: ${lang})...`)

    return new Promise<void>((resolve, reject) => {
      // Try URL parameter auth first (works with JWT tokens from grant API)
      // Fallback to subprotocol if tokenType is 'token' (raw API key)
      const authUrl = `${url}&token=${encodeURIComponent(this.token!)}`
      const ws = new WebSocket(authUrl)
      this.ws = ws

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
        const errEvent = event as ErrorEvent
        log.error(`WebSocket error: ${errEvent.message || 'unknown'}`)
        reject(new Error(`Deepgram Flux connection failed: ${errEvent.message || 'unknown'}`))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code}, reason: "${event.reason}", clean: ${event.wasClean})`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          this.onError?.(new Error(`Deepgram Flux disconnected: code=${event.code} reason="${event.reason}"`))
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
