// API types for backend communication

export interface ProxyConfig {
  aiProviders: string[]
  transcriptionProviders: string[]
  features: Record<string, boolean>
  limits: Record<string, number>
  services?: {
    translation?: {
      enabled: boolean
      provider?: string | null
      monthlyCharsLimit?: number | null
    }
  }
}

export interface TranslationProxyRequest {
  text: string
  target_lang: string
  source_lang?: string
  context?: string
}

export interface TranslationProxyResponse {
  translated_text: string
  detected_source_lang?: string
  target_lang: string
}

export interface TranscriptionToken {
  token: string
  expiresAt: string
  provider: string
  tokenType?: 'bearer' | 'token' // 'bearer' for JWT, 'token' for API key
}

export interface AIProxyRequest {
  model: string
  messages: AIMessage[]
  stream?: boolean
  max_tokens?: number
  temperature?: number
  /**
   * Cascade mode forwarded to /api/proxy/ai/stream. When omitted, backend
   * defaults to "standard" (fast cascade). "smart" routes to Sonnet-tier with
   * extended thinking; "recap" routes to the recap-specific cascade.
   */
  cascadeMode?: 'standard' | 'smart' | 'recap'
}

// Request format for /api/proxy/ai/stream endpoint
export interface AIStreamRequest {
  systemPrompt: string
  userMessage: string
  screenshot?: string // base64 encoded
  cascadeMode?: 'standard' | 'smart' | 'recap'
  maxTokens?: number
  /**
   * Optional user-selected model id (e.g. "claude-sonnet-4-6", "gpt-4o-mini", "gpt-4.1-mini").
   * Honored by the backend only when cascadeMode === 'standard'. Smart/Recap stay on cascade.
   */
  model?: string
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIMessageContent[]
}

export interface AIMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface AIProxyResponse {
  id: string
  content: string
  provider: string
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  content: string
  done: boolean
}

export interface SyncSessionRequest {
  sessions: SyncSessionPayload[]
}

export interface SyncSessionPayload {
  originalId: string
  title: string
  startTime: string
  endTime?: string
  duration?: number
  transcript: string
  summary?: string
  actionItems: string[]
  modeUsed?: string
  deviceId: string
  version: number
  checksum: string
}

export interface SyncResult {
  uploaded: number
  updated: number
  errors: string[]
}

export interface RemoteSession {
  id: string
  originalId: string
  title: string
  startTime: string
  endTime: string | null
  transcript: string
  summary: string | null
  actionItems: string[]
  deviceId: string
  deletedAt: string | null
}

export interface UsageRecordRequest {
  action: string
  provider?: string
}
