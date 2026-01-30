import { getApiBaseUrl } from '../config/appEnvironment'
import { getAccessToken } from '../auth/authenticationManager'
import { createLogger } from '@/lib/logger'
import { sleep } from '@/lib/utils'
import type { ProxyConfig, TranscriptionToken, AIProxyRequest, StreamChunk } from '@/types/api'

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
  if (!response.ok) throw new Error(`Token fetch failed: ${response.status}`)
  return response.json()
}

// AI Generation (non-streaming)
export async function generateAIResponse(request: AIProxyRequest): Promise<string> {
  const response = await fetchWithRetry('/api/proxy/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ ...request, stream: false }),
  })
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`)
  const data = await response.json()
  return data.content
}

// AI Streaming (SSE)
export async function* streamAIResponse(
  request: AIProxyRequest,
): AsyncGenerator<StreamChunk> {
  const token = await getAccessToken()
  const baseUrl = getApiBaseUrl()

  const response = await fetch(`${baseUrl}/api/proxy/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...request, stream: true }),
  })

  if (!response.ok) {
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
          const content =
            parsed.choices?.[0]?.delta?.content ||
            parsed.delta?.text ||
            parsed.content ||
            ''

          if (content) {
            yield { id: parsed.id || '', content, done: false }
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
