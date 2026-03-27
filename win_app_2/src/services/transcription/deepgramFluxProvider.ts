import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'
import { captureError, addBreadcrumb } from '../crash/crashReporter'

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
    let tokenResponse
    try {
      tokenResponse = await getTranscriptionToken('deepgram')
      this.token = tokenResponse.token
      log.info(`Token received (length: ${this.token?.length ?? 0}, type: ${tokenResponse.tokenType ?? 'unknown'})`)
      addBreadcrumb('transcription', `DeepgramFlux token received (len=${this.token?.length})`, 'info')
    } catch (error) {
      log.error('Token fetch failed:', error)
      captureError(error instanceof Error ? error : new Error(String(error)), {
        provider: 'deepgram-flux',
        phase: 'token_fetch',
      })
      throw error
    }

    const lang = this.language || 'multi'
    const langParam = `language=${lang}`
    let url =
      'wss://api.deepgram.com/v1/listen?' +
      `model=nova-3&` +
      `${langParam}&` +
      'smart_format=true&' +
      'interim_results=true&' +
      'encoding=linear16&' +
      'sample_rate=16000&' +
      'channels=1'

    log.info(`Connecting to Deepgram (lang: ${lang}, tokenLen: ${this.token!.length})...`)

    return new Promise<void>((resolve, reject) => {
      // Deepgram browser auth: Sec-WebSocket-Protocol subprotocol
      // See: https://developers.deepgram.com/docs/using-the-sec-websocket-protocol
      const ws = new WebSocket(url, ['token', this.token!])
      this.ws = ws

      this.ws.onopen = () => {
        log.info('Connected')
        addBreadcrumb('transcription', 'DeepgramFlux WebSocket connected', 'info')
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
          } else if (data.type === 'Metadata') {
            log.info(`Metadata received: model=${data.model_info?.name}, request_id=${data.request_id}`)
          } else if (data.type === 'Error' || data.type === 'error') {
            log.error(`Deepgram server error: ${JSON.stringify(data)}`)
            captureError(new Error(`Deepgram server error: ${data.message || JSON.stringify(data)}`), {
              provider: 'deepgram-flux',
              phase: 'server_error',
              errorData: data,
            })
          }
        } catch (error) {
          log.error('Parse error', error)
        }
      }

      this.ws.onerror = (event) => {
        const errEvent = event as ErrorEvent
        log.error(`WebSocket error: ${errEvent.message || 'unknown'}`)
        captureError(new Error(`Deepgram Flux connection failed: ${errEvent.message || 'unknown'}`), {
          provider: 'deepgram-flux',
          phase: 'ws_error',
        })
        reject(new Error(`Deepgram Flux connection failed: ${errEvent.message || 'unknown'}`))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code}, reason: "${event.reason}", clean: ${event.wasClean})`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          const err = new Error(`Deepgram Flux disconnected: code=${event.code} reason="${event.reason}"`)
          captureError(err, {
            provider: 'deepgram-flux',
            phase: 'ws_close',
            closeCode: event.code,
            closeReason: event.reason,
            wasClean: event.wasClean,
          })
          this.onError?.(err)
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
    }, 5000)
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval)
      this.keepaliveInterval = null
    }
  }
}
