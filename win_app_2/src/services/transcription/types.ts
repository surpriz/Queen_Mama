export interface TranscriptionProvider {
  readonly name: string
  readonly isConfigured: boolean
  connect(): Promise<void>
  disconnect(): void
  sendAudio(data: ArrayBuffer): void
  onTranscript: ((text: string) => void) | null
  onInterimTranscript: ((text: string) => void) | null
  onError: ((error: Error) => void) | null
}

export type TranscriptionProviderType = 'deepgram' | 'assemblyai' | 'deepgram-flux'
