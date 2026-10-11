import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'
import { captureError, addBreadcrumb } from '../crash/crashReporter'

const log = createLogger('AssemblyAI')

export class AssemblyAIProvider implements TranscriptionProvider {
  readonly name = 'AssemblyAI'
  private ws: WebSocket | null = null
  private token: string | null = null

  /**
   * Primary language for transcription. AssemblyAI v2 realtime does NOT auto-detect across
   * languages — without `language_code` the session defaults to English, which silently
   * degrades French calls. transcriptionService sets this from `primaryLanguage` config.
   * Accepted values: 'en', 'fr', 'es', 'de', 'it', 'pt', 'nl' (and a few more).
   * 'multi' is treated as 'en' here since v2 realtime has no multi sentinel.
   */
  language: string = 'en'
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

    // v2 realtime has no multi sentinel — fall back to English when caller passed 'multi'.
    const langCode = !this.language || this.language === 'multi' ? 'en' : this.language
    const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&language_code=${encodeURIComponent(langCode)}&token=${encodeURIComponent(this.token!)}`
    log.info(`Using language_code=${langCode}`)

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
        reject(new Error('AssemblyAI connection failed'))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code}, reason: "${event.reason}", clean: ${event.wasClean})`)
        if (event.code !== 1000) {
          const err = new Error(`AssemblyAI disconnected: code=${event.code} reason="${event.reason}"`)
          this.onError?.(err)
        }
      }
    })
  }

  disconnect(): void {
    const ws = this.ws
    this.ws = null
    if (!ws) return
    ws.onerror = null
    ws.onclose = null
    ws.onmessage = null
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ terminate_session: true }))
      ws.close(1000)
    } else if (ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  }

  sendAudio(data: ArrayBuffer): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return

    // AssemblyAI expects base64-encoded audio (chunked conversion, not char-by-char)
    const bytes = new Uint8Array(data)
    let binary = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
    }
    const base64 = btoa(binary)

    this.ws.send(JSON.stringify({ audio_data: base64 }))
  }
}
