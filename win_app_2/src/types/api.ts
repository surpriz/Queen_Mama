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
}

export interface AIProxyRequest {
  model: string
  messages: AIMessage[]
  stream?: boolean
  max_tokens?: number
  temperature?: number
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
  endTime: string | null
  transcript: string
  summary: string | null
  actionItems: string[]
  modeId: string | null
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
