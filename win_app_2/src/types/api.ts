// API types for backend communication

export interface ProxyConfig {
  aiProviders: string[]
  transcriptionProviders: string[]
  features: Record<string, boolean>
  limits: Record<string, number>
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
}

// Request format for /api/proxy/ai/stream endpoint
export interface AIStreamRequest {
  systemPrompt: string
  userMessage: string
  screenshot?: string // base64 encoded
  cascadeMode?: 'standard' | 'smart' | 'recap'
  maxTokens?: number
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
