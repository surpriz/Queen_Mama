import { getApiBaseUrl } from '../config/appEnvironment'
import { getAccessToken } from '../auth/authenticationManager'
import { createLogger } from '@/lib/logger'
import { sleep } from '@/lib/utils'
import type { ProxyConfig, TranscriptionToken, AIProxyRequest, AIStreamRequest, StreamChunk } from '@/types/api'
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

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  // Auto-refresh on 401
  if (response.status === 401) {
    const newToken = await getAccessToken()
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
export async function* streamAIResponse(
  request: AIProxyRequest,
): AsyncGenerator<StreamChunk> {
  const token = await getAccessToken()
  const baseUrl = getApiBaseUrl()

  // Extract system prompt and user message from messages array
  const systemMessage = request.messages.find((m) => m.role === 'system')
  const userMessage = request.messages.find((m) => m.role === 'user')

  if (!systemMessage || !userMessage) {
    throw new Error('Missing system or user message')
  }

  // Convert to backend format. User-selected model id is sent only when in standard cascade
  // (Smart/Recap keep their own cascades server-side).
  const cascadeMode: 'standard' | 'smart' | 'recap' = request.cascadeMode ?? 'standard'
  const selectedRaw = useConfigStore.getState().selectedAIModel
  const userModel = cascadeMode === 'standard' ? resolveBackendModel(selectedRaw) : undefined
  // Use console.warn so the message is always visible regardless of DevTools "Default levels" filter.
  // Prefix with a unique sentinel that's trivial to grep/filter on.
  // eslint-disable-next-line no-console
  console.warn(`MODELDBG cascadeMode=${cascadeMode} selectedAIModel=${JSON.stringify(selectedRaw)} sendingModel=${JSON.stringify(userModel)} configStoreKeys=${Object.keys(useConfigStore.getState()).join(',')}`)
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
  }

  // Extract screenshot if present in user message
  if (typeof userMessage.content !== 'string') {
    const imageContent = userMessage.content.find((c) => c.type === 'image_url')
    if (imageContent?.image_url?.url) {
      // Extract base64 data from data URL
      const base64Match = imageContent.image_url.url.match(/^data:image\/\w+;base64,(.+)$/)
      if (base64Match) {
        streamRequest.screenshot = base64Match[1]
      }
    }
  }

  const response = await fetch(`${baseUrl}/api/proxy/ai/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(streamRequest),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    log.error(`AI streaming failed: ${response.status}`, errorText)
    throw new Error(`AI streaming failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6) // Remove "data: " prefix

        if (data === '[DONE]') {
          yield { id: '', content: '', done: true }
          return
        }

        try {
          const parsed = JSON.parse(data)

          // Check for error from backend
          if (parsed.error) {
            log.error('AI stream error:', parsed.message)
            throw new Error(parsed.message || 'AI request failed')
          }

          // Log SSE metadata (provider/model/effort) sent before [DONE]
          if (parsed.provider) {
            const effort = parsed.effort || 'unknown'
            log.info(`Provider: ${parsed.provider}, model: ${parsed.model}, effort: ${effort}`)
          }

          const content = parsed.content || ''

          if (content) {
            yield { id: parsed.id || '', content, done: false }
          }
        } catch (parseError) {
          // Skip unparseable chunks unless it's our own error
          if (parseError instanceof Error && parseError.message !== 'AI request failed') {
            // Ignore JSON parse errors
          } else {
            throw parseError
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
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
