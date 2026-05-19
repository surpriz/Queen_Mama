export interface TranslationResult {
  translatedText: string
  detectedSourceLang?: string | null
  targetLang: string
  provider: string
  latencyMs: number
  cached: boolean
}

export type TranslationErrorKind =
  | 'notConfigured'
  | 'rateLimited'
  | 'quotaExceeded'
  | 'unsupportedLanguage'
  | 'requestFailed'
  | 'invalidResponse'
  | 'timeout'

export class TranslationError extends Error {
  kind: TranslationErrorKind
  /** Optional extra detail (lang code, server message, etc.). */
  detail?: string

  constructor(kind: TranslationErrorKind, detail?: string) {
    super(detail ? `${kind}: ${detail}` : kind)
    this.name = 'TranslationError'
    this.kind = kind
    this.detail = detail
  }
}

export interface TranslationProvider {
  readonly providerName: string
  readonly isConfigured: boolean
  translate(input: {
    text: string
    sourceLang?: string | null
    targetLang: string
    context?: string | null
  }): Promise<TranslationResult>
}

export class NoOpTranslationProvider implements TranslationProvider {
  readonly providerName = 'None'
  readonly isConfigured = false

  async translate(): Promise<TranslationResult> {
    throw new TranslationError('notConfigured')
  }
}
