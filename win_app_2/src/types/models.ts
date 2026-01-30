// Models ported from mac_app/Models/

export interface Session {
  id: string
  title: string
  startTime: string // ISO date string
  endTime: string | null
  transcript: string
  summary: string | null
  actionItems: string[]
  modeId: string | null
  entries: TranscriptEntry[]
  // Sync metadata
  syncStatus?: 'local' | 'synced' | 'pending' | 'failed'
  remoteId?: string
  deviceId?: string
}

export interface TranscriptEntry {
  id: string
  sessionId: string
  timestamp: string // ISO date string
  speaker: string
  text: string
  isFinal: boolean
}

export interface AIResponseRecord {
  id: string
  sessionId?: string
  type: ResponseType
  content: string
  timestamp: string // ISO date string
  provider: AIProviderType
  latencyMs: number | null
  isAutomatic: boolean
}

export enum ResponseType {
  Assist = 'Assist',
  WhatToSay = 'What should I say?',
  FollowUp = 'Follow-up questions',
  Recap = 'Recap',
  Custom = 'Custom',
}

export const RESPONSE_TYPE_INFO: Record<
  ResponseType,
  { icon: string; label: string; shortLabel: string; systemPromptAddition: string }
> = {
  [ResponseType.Assist]: {
    icon: 'Sparkles',
    label: 'Assist',
    shortLabel: 'Assist',
    systemPromptAddition: `Help with what's on screen. If it's a question, give the answer. If it's code, explain or fix it.
1-2 sentences max, bullets only if needed. Match the language of the content.`,
  },
  [ResponseType.WhatToSay]: {
    icon: 'MessageSquare',
    label: 'What to Say',
    shortLabel: 'Say',
    systemPromptAddition: `Give 2-3 short phrases the user can say right now. Keep each under 15 words.
Match the language of the content.`,
  },
  [ResponseType.FollowUp]: {
    icon: 'HelpCircle',
    label: 'Follow-up',
    shortLabel: 'Follow-up',
    systemPromptAddition: `Suggest 3 relevant follow-up questions. Keep them specific, not generic.
Match the language of the content.`,
  },
  [ResponseType.Recap]: {
    icon: 'RotateCcw',
    label: 'Recap',
    shortLabel: 'Recap',
    systemPromptAddition: `Summarize the key points in 3-5 bullets max. Include any decisions or action items.
Match the language of the content.`,
  },
  [ResponseType.Custom]: {
    icon: 'MessageCircle',
    label: 'Custom',
    shortLabel: 'Custom',
    systemPromptAddition: 'Answer directly. Match the language of the content.',
  },
}

export enum AIProviderType {
  Anthropic = 'Anthropic',
  Grok = 'xAI Grok',
  OpenAI = 'OpenAI',
  Gemini = 'Google Gemini',
}

export interface Mode {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
  createdAt: string
  attachedFiles: AttachedFile[]
}

export interface AttachedFile {
  id: string
  name: string
  path: string
  type: AttachedFileType
}

export enum AttachedFileType {
  Resume = 'resume',
  PitchDeck = 'pitchDeck',
  Document = 'document',
  Other = 'other',
}

// Built-in modes (ported from Mode.swift)
export const BUILT_IN_MODES: Omit<Mode, 'id' | 'createdAt'>[] = [
  {
    name: 'Default',
    systemPrompt: `You're a real-time assistant helping during meetings, exams, and workflows. Answer queries directly.

Responses must be EXTREMELY short:
- 1-2 sentences max, use bullet points only if longer
- Get straight to the point, NO filler or preamble
- If it's a question with options, give the answer and a brief reason
- Never describe what you see, just help

Tone: natural and conversational
- Use contractions naturally
- No hyphens or dashes, use commas or shorter sentences
- Never end with a question

Language: match the content (French content = French response)`,
    isDefault: true,
    attachedFiles: [],
  },
  {
    name: 'Professional',
    systemPrompt: `You're a real-time assistant for corporate settings. Help with professional communication.

Keep it short and executive-level:
- 1-2 sentences, bullet points only if needed
- Formal but natural tone
- Focus on clarity and impact

Language: match the content`,
    isDefault: false,
    attachedFiles: [],
  },
  {
    name: 'Interview',
    systemPrompt: `You're a real-time assistant for job interviews. Help the user shine.

Keep it short and actionable:
- 1-2 sentences, use STAR format only when relevant
- Give concrete examples, not generic advice
- For technical questions, answer directly

Language: match the content`,
    isDefault: false,
    attachedFiles: [],
  },
  {
    name: 'Sales',
    systemPrompt: `You're a real-time assistant for sales calls. Help close deals.

Keep it short and persuasive:
- 1-2 sentences max
- For objections: acknowledge briefly, then pivot to value
- Suggest specific next steps when appropriate

Language: match the content`,
    isDefault: false,
    attachedFiles: [],
  },
]

export const BUILT_IN_MODE_NAMES = ['Default', 'Professional', 'Interview', 'Sales'] as const
