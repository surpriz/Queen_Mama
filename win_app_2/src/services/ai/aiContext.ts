import { ResponseType, RESPONSE_TYPE_INFO, BUILT_IN_MODE_NAMES } from '@/types/models'
import type { Mode } from '@/types/models'
import type { AIMessage } from '@/types/api'

const MAX_TRANSCRIPT_LENGTH = 8000

export interface AIContextParams {
  transcript: string
  screenshot?: string // base64 JPEG
  mode: Mode | null
  responseType: ResponseType
  customPrompt?: string
  smartMode?: boolean
}

export function buildSystemPrompt(params: AIContextParams): string {
  const { mode, responseType, smartMode } = params

  const isCustomMode = mode
    ? !BUILT_IN_MODE_NAMES.includes(mode.name as (typeof BUILT_IN_MODE_NAMES)[number])
    : false

  let prompt: string

  if (isCustomMode && mode) {
    // Custom modes: ONLY the mode's prompt + language instruction
    prompt = mode.systemPrompt
    prompt +=
      '\n\nIMPORTANT: Respond in the SAME LANGUAGE as the transcript or screen content. If French, respond in French.'
  } else {
    // Built-in modes: mode prompt + responseType additions
    prompt = mode?.systemPrompt || getDefaultSystemPrompt()
    prompt += '\n\n' + RESPONSE_TYPE_INFO[responseType].systemPromptAddition
  }

  if (smartMode) {
    prompt += `\n\nSMART MODE ENABLED: Please provide enhanced, thorough analysis:
- Think step-by-step before responding
- Consider multiple perspectives and implications
- Provide deeper insights and more nuanced recommendations
- Be more comprehensive in your response`
  }

  return prompt
}

export function buildUserMessage(params: AIContextParams): AIMessage[] {
  const { transcript, screenshot, mode, responseType, customPrompt } = params

  const isCustomMode = mode
    ? !BUILT_IN_MODE_NAMES.includes(mode.name as (typeof BUILT_IN_MODE_NAMES)[number])
    : false

  let textContent = ''

  if (transcript.trim()) {
    const truncated =
      transcript.length > MAX_TRANSCRIPT_LENGTH
        ? '[...previous conversation truncated...]\n\n' +
          transcript.slice(-MAX_TRANSCRIPT_LENGTH)
        : transcript

    textContent += `## Transcript:\n${truncated}\n\n`
  }

  if (screenshot) {
    textContent += '[Screenshot attached - analyze it]\n\n'
  }

  if (customPrompt?.trim()) {
    textContent += customPrompt
  } else if (isCustomMode) {
    textContent += 'Help me with this.'
  } else {
    switch (responseType) {
      case ResponseType.Assist:
        textContent += 'Help me.'
        break
      case ResponseType.WhatToSay:
        textContent += 'What should I say?'
        break
      case ResponseType.FollowUp:
        textContent += 'What questions should I ask?'
        break
      case ResponseType.Recap:
        textContent += 'Summarize this.'
        break
      case ResponseType.Custom:
        textContent += 'Help me.'
        break
    }
  }

  // Build message parts
  const content: AIMessage['content'] = []

  if (screenshot) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${screenshot}` },
    })
  }

  content.push({ type: 'text', text: textContent })

  return [{ role: 'user', content }]
}

function getDefaultSystemPrompt(): string {
  return `You're a real-time assistant helping during meetings, exams, and workflows. Answer queries directly.

Responses must be EXTREMELY short:
- 1-2 sentences max, use bullet points only if longer
- Get straight to the point, NO filler or preamble
- If it's a question with options, give the answer and a brief reason
- Never describe what you see, just help

Tone: natural and conversational
- Use contractions naturally
- No hyphens or dashes, use commas or shorter sentences
- Never end with a question

Language: match the content (French content = French response)`
}

// Title generation prompt
export function buildTitlePrompt(transcript: string): AIMessage[] {
  return [
    {
      role: 'system',
      content:
        'Generate a short, descriptive title (max 8 words) for this conversation. Return ONLY the title, no quotes or explanation. Match the language of the content.',
    },
    {
      role: 'user',
      content: transcript.slice(0, 2000),
    },
  ]
}

// Summary generation prompt
export function buildSummaryPrompt(transcript: string): AIMessage[] {
  return [
    {
      role: 'system',
      content:
        'Summarize this conversation in 2-4 sentences. Focus on key decisions, topics discussed, and action items. Match the language of the content.',
    },
    {
      role: 'user',
      content: transcript.slice(0, 6000),
    },
  ]
}
