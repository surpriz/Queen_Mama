import { getApiBaseUrl } from '../config/appEnvironment'
import { getAccessToken } from '../auth/authenticationManager'
import { createLogger } from '@/lib/logger'
import { sleep } from '@/lib/utils'
import type { ProxyConfig, TranscriptionToken, AIProxyRequest, AIStreamRequest, StreamChunk, StreamOptions, TranslationProxyResponse } from '@/types/api'
import { AIStreamError } from '@/types/api'
import { TranslationError } from '@/services/translation/translationProvider'
import { useConfigStore } from '@/stores/configStore'
import { resolveBackendModel } from '@/types/config'

const log = createLogger('ProxyAPI')

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000]
const RETRYABLE_STATUS_CODES = [502, 503, 504]

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken()
  const baseUrl = getApiBaseUrl()
  log.info(`[diag] fetchWithAuth ${options.method ?? 'GET'} ${endpoint} tokenLen=${token.length}`)

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  log.info(`[diag] response ${endpoint} status=${response.status}`)

  // Auto-refresh on 401 — force a real refresh so we don't replay the same
  // cached token the server just rejected. Without force=true, getAccessToken
  // returns the in-memory token whenever its local expiry timestamp is still
  // in the future, even though the server has revoked or invalidated it.
  if (response.status === 401) {
    log.warn(`Got 401 on ${endpoint}, forcing token refresh`)
    let newToken: string
    try {
      newToken = await getAccessToken(true)
    } catch (err) {
      log.error(`Forced refresh failed for ${endpoint}:`, err)
      throw err
    }
    return fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    })
  }

  return response
}

async function fetchWithRetry(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithAuth(endpoint, options)

      if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
        log.warn(`Request failed with ${response.status}, retrying (${attempt + 1}/${MAX_RETRIES})`)
        await sleep(RETRY_DELAYS[attempt])
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < MAX_RETRIES) {
        log.warn(`Request error, retrying (${attempt + 1}/${MAX_RETRIES})`, error)
        await sleep(RETRY_DELAYS[attempt])
      }
    }
  }

  throw lastError || new Error('Request failed after retries')
}

// Proxy Config
export async function fetchConfig(): Promise<ProxyConfig> {
  const response = await fetchWithRetry('/api/proxy/config')
  if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`)
  return response.json()
}

// Translation (DeepL via proxy)
export async function translate(input: {
  text: string
  sourceLang?: string
  targetLang: string
  context?: string
}): Promise<TranslationProxyResponse> {
  const body: Record<string, string> = {
    text: input.text,
    target_lang: input.targetLang,
  }
  if (input.sourceLang && input.sourceLang.toLowerCase() !== 'auto') {
    body.source_lang = input.sourceLang
  }
  if (input.context) {
    body.context = input.context
  }

  const response = await fetchWithAuth('/api/proxy/translate', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (response.ok) {
    return response.json()
  }

  const errorBody = await response.text().catch(() => '')
  log.warn(`Translation proxy ${response.status}: ${errorBody.slice(0, 200)}`)

  switch (response.status) {
    case 401:
      throw new TranslationError('notConfigured', 'unauthenticated')
    case 402:
      throw new TranslationError('quotaExceeded', errorBody)
    case 403:
      throw new TranslationError('requestFailed', errorBody || 'forbidden')
    case 429:
      throw new TranslationError('rateLimited', errorBody)
    case 503:
      throw new TranslationError('notConfigured', errorBody || 'provider unavailable')
    default:
      throw new TranslationError('requestFailed', `HTTP ${response.status}: ${errorBody}`)
  }
}

// Transcription Token
export async function getTranscriptionToken(provider: string): Promise<TranscriptionToken> {
  const response = await fetchWithRetry('/api/proxy/transcription/token', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    log.error(`Token fetch failed for ${provider}: ${response.status} - ${errorBody}`)
    throw new Error(`Token fetch failed: ${response.status} (${provider}) ${errorBody}`)
  }
  return response.json()
}

// AI Generation (non-streaming) - uses /api/proxy/ai/generate
// Tries multiple providers with fallback (same as streaming cascade)
const GENERATE_PROVIDERS = ['openai', 'anthropic', 'gemini', 'grok'] as const

export async function generateAIResponse(request: AIProxyRequest): Promise<string> {
  // Extract system prompt and user message from messages array
  const systemMessage = request.messages.find((m) => m.role === 'system')
  const userMessage = request.messages.find((m) => m.role === 'user')

  if (!systemMessage || !userMessage) {
    throw new Error('Missing system or user message')
  }

  const systemPrompt = typeof systemMessage.content === 'string'
    ? systemMessage.content
    : systemMessage.content.map((c) => c.text || '').join('')
  const userMsg = typeof userMessage.content === 'string'
    ? userMessage.content
    : userMessage.content.map((c) => c.text || '').join('')

  let lastError: Error | null = null

  // User-selected model is only honored in standard mode (non-smart). Generate path is used
  // by background utilities (title, summary, etc.) — keep the user override only when the
  // caller has not forced a specific provider via `request.model`.
  const userModel = resolveBackendModel(useConfigStore.getState().selectedAIModel)

  for (const provider of GENERATE_PROVIDERS) {
    try {
      const response = await fetchWithRetry('/api/proxy/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          systemPrompt,
          userMessage: userMsg,
          maxTokens: request.max_tokens,
          ...(userModel ? { model: userModel } : {}),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.content
      }

      // 503 = provider not configured, try next
      if (response.status === 503) {
        log.warn(`Provider ${provider} not configured, trying next`)
        continue
      }

      const errorText = await response.text().catch(() => '')
      log.error(`AI generate failed with ${provider}: ${response.status}`, errorText)
      lastError = new Error(`AI request failed: ${response.status}`)
    } catch (err) {
      log.error(`AI generate error with ${provider}`, err)
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error('All AI providers failed')
}

// AI Streaming (SSE) - uses /api/proxy/ai/stream with cascade fallback
const STREAM_TIMEOUT_MS = 90_000

interface StreamMetadata {
  provider?: string
  model?: string
  effort?: string
}

let lastStreamMetadata: StreamMetadata = {}

/** Provider/model reported by the backend for the most recent stream. */
export function getLastStreamMetadata(): StreamMetadata {
  return lastStreamMetadata
}

function buildStreamRequest(request: AIProxyRequest): AIStreamRequest {
  const systemMessage = request.messages.find((m) => m.role === 'system')
  const userMessage = request.messages.find((m) => m.role === 'user')

  if (!systemMessage || !userMessage) {
    throw new AIStreamError('Missing system or user message', 'backend')
  }

  // User-selected model id is sent only when in standard cascade
  // (Smart/Recap keep their own cascades server-side).
  const cascadeMode: 'standard' | 'smart' | 'recap' = request.cascadeMode ?? 'standard'
  const selectedRaw = useConfigStore.getState().selectedAIModel
  const userModel = cascadeMode === 'standard' ? resolveBackendModel(selectedRaw) : undefined

  const streamRequest: AIStreamRequest = {
    systemPrompt: typeof systemMessage.content === 'string'
      ? systemMessage.content
      : systemMessage.content.map((c) => c.text || '').join(''),
    userMessage: typeof userMessage.content === 'string'
      ? userMessage.content
      : userMessage.content.map((c) => c.text || '').join(''),
    maxTokens: request.max_tokens,
    cascadeMode,
    ...(userModel ? { model: userModel } : {}),
    ...(useConfigStore.getState().knowledgeEnabled ? {} : { disableKnowledge: true }),
  }

  // Extract screenshot if present in user message
  if (typeof userMessage.content !== 'string') {
    const imageContent = userMessage.content.find((c) => c.type === 'image_url')
    if (imageContent?.image_url?.url) {
      const base64Match = imageContent.image_url.url.match(/^data:image\/\w+;base64,(.+)$/)
      if (base64Match) {
        streamRequest.screenshot = base64Match[1]
      }
    }
  }
  return streamRequest
}

/**
 * Stream an AI response. Guarantees (mac `ProxyAPIClient` parity):
 *  - a hard timeout (default 90 s) and an optional caller AbortSignal, so a hung
 *    stream can never leave the UI stuck in "processing";
 *  - one token refresh + retry on 401;
 *  - backend error frames (`{error: true, message}`) surface as AIStreamError
 *    instead of being swallowed;
 *  - provider/model metadata captured for the history badge.
 */
export async function* streamAIResponse(
  request: AIProxyRequest,
  options: StreamOptions = {},
): AsyncGenerator<StreamChunk> {
  const baseUrl = getApiBaseUrl()
  const streamRequest = buildStreamRequest(request)
  const body = JSON.stringify(streamRequest)
  lastStreamMetadata = {}

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? STREAM_TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onCallerAbort)
  if (options.signal?.aborted) controller.abort()

  const classify = (error: unknown): AIStreamError => {
    if (error instanceof AIStreamError) return error
    if (controller.signal.aborted) {
      return timedOut
        ? new AIStreamError('AI request timed out', 'timeout')
        : new AIStreamError('AI request cancelled', 'aborted')
    }
    const message = error instanceof Error ? error.message : String(error)
    return new AIStreamError(message || 'Network error', 'network')
  }

  try {
    let token = await getAccessToken()
    let response: Response
    try {
      response = await fetch(`${baseUrl}/api/proxy/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      })
      if (response.status === 401) {
        log.warn('Stream got 401, refreshing token once')
        token = await getAccessToken(true)
        response = await fetch(`${baseUrl}/api/proxy/ai/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body,
          signal: controller.signal,
        })
      }
    } catch (error) {
      throw classify(error)
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      log.error(`AI streaming failed: ${response.status}`, errorText)
      const kind = response.status === 401 || response.status === 403 ? 'auth' : response.status >= 500 ? 'server' : 'backend'
      throw new AIStreamError(`AI streaming failed: ${response.status}`, kind, response.status)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new AIStreamError('No response body', 'server', response.status)

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        let result: ReadableStreamReadResult<Uint8Array>
        try {
          result = await reader.read()
        } catch (error) {
          throw classify(error)
        }
        if (result.done) break

        buffer += decoder.decode(result.value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            yield { id: '', content: '', done: true }
            return
          }

          let parsed: { error?: unknown; message?: string; provider?: string; model?: string; effort?: string; content?: string; id?: string }
          try {
            parsed = JSON.parse(data)
          } catch {
            continue // not JSON — ignore keepalive/comment lines
          }

          if (parsed.error) {
            const message = parsed.message || (typeof parsed.error === 'string' ? parsed.error : 'AI request failed')
            log.error('AI stream error frame:', message)
            throw new AIStreamError(message, 'backend')
          }

          if (parsed.provider) {
            lastStreamMetadata = { provider: parsed.provider, model: parsed.model, effort: parsed.effort }
            log.info(`Provider: ${parsed.provider}, model: ${parsed.model}, effort: ${parsed.effort || 'unknown'}`)
          }

          const content = parsed.content || ''
          if (content) {
            yield { id: parsed.id || '', content, done: false }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', onCallerAbort)
  }
}

// Knowledge Base Feedback
export async function submitFeedback(
  responseId: string,
  sessionId: string,
  isHelpful: boolean,
): Promise<void> {
  const response = await fetchWithRetry('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ responseId, sessionId, isHelpful }),
  })
  if (!response.ok) {
    log.error(`Feedback submit failed: ${response.status}`)
    throw new Error(`Feedback submit failed: ${response.status}`)
  }
}

// Knowledge Base Atoms
export interface KnowledgeAtom {
  id: string
  type: string
  content: string
  usageCount: number
  helpfulCount: number
  helpfulRatio: number | null
  createdAt: string
  lastUsedAt: string | null
}

export async function fetchKnowledgeAtoms(
  limit = 50,
  offset = 0,
): Promise<KnowledgeAtom[]> {
  const response = await fetchWithRetry(`/api/knowledge?limit=${limit}&offset=${offset}`)
  if (!response.ok) {
    if (response.status === 403) throw new Error('enterprise_required')
    throw new Error(`Knowledge fetch failed: ${response.status}`)
  }
  const data = await response.json()
  return data.atoms || data
}

export async function deleteKnowledgeAtom(atomId: string): Promise<void> {
  const response = await fetchWithRetry(`/api/knowledge?id=${atomId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(`Knowledge delete failed: ${response.status}`)
}
