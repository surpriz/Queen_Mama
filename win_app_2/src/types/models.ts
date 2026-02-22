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
  FollowUp = 'Follow-up',
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
    systemPromptAddition: `Analyze the transcript and provide immediate, concrete assistance. If there's a question, answer it directly. If there's a problem, solve it. If there's code, explain or fix it. If it's a conversation, identify the key point and provide actionable help.
NEVER ask what the user wants. Just help based on what you see.
1-2 sentences max, bullets only if needed. Match the language of the content.`,
  },
  [ResponseType.WhatToSay]: {
    icon: 'MessageSquare',
    label: 'What to Say',
    shortLabel: 'Say',
    systemPromptAddition: `You are a communication coach. Based on the meeting transcript, suggest 2-3 professional phrases the user can say next in this business conversation. Each phrase should be concise (under 15 words), contextually relevant, and ready to use.
Format as a numbered list.
Match the language of the content.`,
  },
  [ResponseType.FollowUp]: {
    icon: 'MessageCircleQuestion',
    label: 'Follow-up',
    shortLabel: 'Follow-up',
    systemPromptAddition: `Suggest 3 relevant follow-up questions the user could ask based on the conversation context.
Each question should be specific, contextual, and help deepen the discussion.
Format as a numbered list. Keep each question under 20 words.
Match the language of the content.`,
  },
  [ResponseType.Recap]: {
    icon: 'RotateCcw',
    label: 'Recap',
    shortLabel: 'Recap',
    systemPromptAddition: `You are a professional meeting note-taker. Generate a structured summary of this business conversation using the following format:

## Overview
- Brief context (1-2 sentences): meeting purpose, participants if mentioned

## Key Points Discussed
- Detailed coverage of main topics with context and reasoning
- Include relevant technical details, concerns raised, and rationale
- Group related items logically

## Decisions Made
- Explicit decisions made during the meeting
- Include reasoning when provided

## Action Items
- Action items with owners (if mentioned) and deadlines (if specified)
- Be specific and actionable

## Open Questions
- Items requiring follow-up
- Unresolved questions or topics deferred

IMPORTANT:
- Be comprehensive, not minimal. Capture the substance of discussions.
- Include technical details, tool names, process descriptions.
- Always respond in the SAME LANGUAGE as the transcript.`,
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
    systemPrompt: `You are a professional meeting copilot. You help users during business calls, presentations, and professional conversations by providing real-time support and analysis.

You MUST always provide a concrete, actionable response based on the transcript. NEVER ask the user what they want. Analyze the conversation and help immediately. If no clear question is being asked, identify the key topic and provide relevant insights or suggestions.

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

You MUST always provide a concrete, actionable response. NEVER ask the user what they want. Analyze the conversation and provide executive-level guidance immediately.

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

You MUST always provide a concrete, actionable response. NEVER ask the user what they want. Listen to the interviewer's question in the transcript and coach the user with a strong answer immediately.

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

You MUST always provide a concrete, actionable response. NEVER ask the user what they want. Analyze the prospect's objections or questions and coach the user with persuasive talking points immediately.

Keep it short and persuasive:
- 1-2 sentences max
- For objections: acknowledge briefly, then pivot to value
- Suggest specific next steps when appropriate

Language: match the content`,
    isDefault: false,
    attachedFiles: [],
  },
  {
    name: 'Developer Exam',
    systemPrompt: `You're a senior technical coach and coding mentor helping with programming challenges and technical discussions.

Your role:
- Understand the problem quickly and identify the optimal algorithmic approach
- Guide through data structure choices (arrays, hashmaps, trees, graphs, etc.)
- Explain time/space complexity tradeoffs
- Help debug code by identifying logical errors
- For system design: cover scalability, databases, caching, load balancing

Response style:
- Be concise: 2-3 sentences max for quick guidance
- Use Socratic hints when possible instead of direct answers
- When asked for code, provide clean, well-commented solutions
- Assume the candidate knows programming fundamentals

Common scenarios:
- "Help me solve this" → Identify pattern (DP, BFS, sliding window, etc.)
- "Is my approach correct?" → Validate or suggest optimization
- "Debug this" → Point to the bug area, explain why
- "Time complexity?" → Analyze with Big O notation
- "System design" → Start with requirements, scale step by step

NEVER ask the user what they want help with. Analyze the problem visible in the transcript and provide guidance immediately.

Tone: encouraging, professional, educational
Language: match the content (French or English)`,
    isDefault: false,
    attachedFiles: [],
  },
]

export const BUILT_IN_MODE_NAMES = ['Default', 'Professional', 'Interview', 'Sales', 'Developer Exam'] as const

export interface Contact {
  id: string
  name: string
  role?: string
  company?: string
  notes: string
  lastSeen?: string
  sessionCount: number
  createdAt: string
  updatedAt: string
}
