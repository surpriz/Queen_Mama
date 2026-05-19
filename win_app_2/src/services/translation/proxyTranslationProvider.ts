import { translate as proxyTranslate } from '@/services/proxy/proxyApiClient'
import { isTranslationEnabled } from '@/services/proxy/proxyConfigManager'
import {
  TranslationError,
  type TranslationProvider,
  type TranslationResult,
} from './translationProvider'

export class ProxyTranslationProvider implements TranslationProvider {
  readonly providerName = 'DeepL (Proxy)'

  get isConfigured(): boolean {
    return isTranslationEnabled()
  }

  async translate(input: {
    text: string
    sourceLang?: string | null
    targetLang: string
    context?: string | null
  }): Promise<TranslationResult> {
    const start = Date.now()
    try {
      const response = await proxyTranslate({
        text: input.text,
        sourceLang: input.sourceLang ?? undefined,
        targetLang: input.targetLang,
        context: input.context ?? undefined,
      })
      return {
        translatedText: response.translated_text,
        detectedSourceLang: response.detected_source_lang ?? null,
        targetLang: response.target_lang ?? input.targetLang,
        provider: this.providerName,
        latencyMs: Date.now() - start,
        cached: false,
      }
    } catch (err) {
      if (err instanceof TranslationError) throw err
      const message = err instanceof Error ? err.message : String(err)
      throw new TranslationError('requestFailed', message)
    }
  }
}
