import type { TranscriptionProvider } from './types'
import { getTranscriptionToken } from '../proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'

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
    const tokenResponse = await getTranscriptionToken('assemblyai')
    this.token = tokenResponse.token

    const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${this.token}`

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        log.info('Connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.message_type === 'SessionBegins') {
            log.info(`Session started: ${data.session_id}`)
            resolve()
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
        log.info(`Disconnected (code: ${event.code})`)
        if (event.code !== 1000) {
          this.onError?.(new Error(`AssemblyAI disconnected: ${event.reason || event.code}`))
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
