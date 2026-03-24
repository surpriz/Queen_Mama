import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'
import { captureError, addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('AssemblyAI')

export class AssemblyAIProvider implements TranscriptionProvider {
  readonly name = 'AssemblyAI'
  private ws: WebSocket | null = null
  private token: string | null = null

  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onError: ((error: Error) => void) | null = null

  get isConfigured(): boolean {
    return true
  }

  async connect(): Promise<void> {
    try {
      const tokenResponse = await getTranscriptionToken('assemblyai')
      this.token = tokenResponse.token
      log.info(`Token received (length: ${this.token?.length ?? 0})`)
      addBreadcrumb('transcription', `AssemblyAI token received (len=${this.token?.length})`, 'info')
    } catch (error) {
      log.error('Token fetch failed:', error)
      captureError(error instanceof Error ? error : new Error(String(error)), {
        provider: 'assemblyai',
        phase: 'token_fetch',
      })
      throw error
    }

    const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${encodeURIComponent(this.token!)}`

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        log.info('Connected')
        addBreadcrumb('transcription', 'AssemblyAI WebSocket connected', 'info')
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.message_type === 'SessionBegins') {
            log.info(`Session started: ${data.session_id}`)
            resolve()
            return
          }

          if (data.message_type === 'SessionTerminated') {
            log.warn(`Session terminated by server: ${JSON.stringify(data)}`)
            return
          }

          if (data.message_type === 'FinalTranscript') {
            const text = data.text?.trim()
            if (text) this.onTranscript?.(text)
          } else if (data.message_type === 'PartialTranscript') {
            const text = data.text?.trim()
            if (text) this.onInterimTranscript?.(text)
          }
        } catch (error) {
          log.error('Parse error', error)
        }
      }

      this.ws.onerror = (event) => {
        log.error('WebSocket error', event)
        captureError(new Error('AssemblyAI connection failed'), {
          provider: 'assemblyai',
          phase: 'ws_error',
        })
        reject(new Error('AssemblyAI connection failed'))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code}, reason: "${event.reason}", clean: ${event.wasClean})`)
        if (event.code !== 1000) {
          const err = new Error(`AssemblyAI disconnected: code=${event.code} reason="${event.reason}"`)
          captureError(err, {
            provider: 'assemblyai',
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ terminate_session: true }))
      this.ws.close(1000)
    }
    this.ws = null
  }

  sendAudio(data: ArrayBuffer): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    // AssemblyAI expects base64-encoded audio
    const bytes = new Uint8Array(data)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    this.ws.send(JSON.stringify({ audio_data: base64 }))
  }
}
