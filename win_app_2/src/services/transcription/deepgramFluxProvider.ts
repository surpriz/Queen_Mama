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
  diarize: boolean = false // Enable Deepgram speaker diarization (fallback when system audio unavailable)
  onTranscript: ((text: string) => void) | null = null
  onInterimTranscript: ((text: string) => void) | null = null
  onDiarizedTranscript: ((text: string, speaker: number) => void) | null = null
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
      'punctuate=true&' +
      'encoding=linear16&' +
      'sample_rate=16000&' +
      'channels=1&' +
      'endpointing=300&' +
      'utterance_end_ms=1000&' +
      'vad_events=true'

    if (this.diarize) {
      url += '&diarize=true'
    }

    log.info(`Connecting to Deepgram (lang: ${lang}, diarize: ${this.diarize}, tokenLen: ${this.token!.length})...`)

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
            const alt = data.channel?.alternatives?.[0]
            const transcript = alt?.transcript || ''
            if (transcript.trim()) {
              if (data.is_final) {
                const words = alt?.words as Array<{ word?: string; speaker?: number }> | undefined
                if (this.diarize && this.onDiarizedTranscript && words?.length && words[0]?.speaker !== undefined) {
                  this.emitDiarizedSegments(words)
                } else {
                  this.onTranscript?.(transcript)
                }
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
        reject(new Error(`Deepgram Flux connection failed: ${errEvent.message || 'unknown'}`))
      }

      this.ws.onclose = (event) => {
        log.info(`Disconnected (code: ${event.code}, reason: "${event.reason}", clean: ${event.wasClean})`)
        this.stopKeepalive()
        if (event.code !== 1000) {
          const err = new Error(`Deepgram Flux disconnected: code=${event.code} reason="${event.reason}"`)
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

  /** Group consecutive words by speaker and emit per-speaker segments */
  private emitDiarizedSegments(words: Array<{ word?: string; speaker?: number }>): void {
    let currentSpeaker = words[0]?.speaker ?? 0
    let currentWords: string[] = []

    for (const w of words) {
      const speaker = w.speaker ?? 0
      const word = w.word ?? ''
      if (!word) continue

      if (speaker !== currentSpeaker && currentWords.length > 0) {
        this.onDiarizedTranscript?.(currentWords.join(' '), currentSpeaker)
        currentWords = []
        currentSpeaker = speaker
      }
      currentWords.push(word)
    }

    if (currentWords.length > 0) {
      this.onDiarizedTranscript?.(currentWords.join(' '), currentSpeaker)
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
