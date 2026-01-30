import { createLogger } from '@/lib/logger'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useLicenseStore } from '@/stores/licenseStore'
import * as proxyApi from '../proxy/proxyApiClient'
import { buildSystemPrompt, buildUserMessage, buildTitlePrompt, buildSummaryPrompt } from './aiContext'
import type { AIContextParams } from './aiContext'
import type { ResponseType, Mode } from '@/types/models'
import type { AIMessage } from '@/types/api'

const log = createLogger('AIService')

let isProcessing = false
const UI_BATCH_INTERVAL = 50 // ms

export async function generateStreamingResponse(params: AIContextParams): Promise<string> {
  if (isProcessing) {
    log.warn('Already processing')
    return ''
  }

  // License check
  const licenseStore = useLicenseStore.getState()
  const access = licenseStore.canUse('aiRequest')
  if (access.type !== 'allowed') {
    log.warn('AI request not allowed', access)
    return ''
  }

  isProcessing = true
  useAppStore.getState().setProcessing(true)
  const overlayStore = useOverlayStore.getState()
  overlayStore.setStreamingContent('')

  const systemPrompt = buildSystemPrompt(params)
  const userMessages = buildUserMessage(params)

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ]

  let fullContent = ''
  let batchedContent = ''
  let batchTimer: ReturnType<typeof setTimeout> | null = null

  const flushBatch = () => {
    if (batchedContent) {
      overlayStore.setStreamingContent(batchedContent)
    }
    batchTimer = null
  }

  try {
    const stream = proxyApi.streamAIResponse({
      model: 'auto',
      messages,
      stream: true,
    })

    for await (const chunk of stream) {
      if (chunk.done) break

      fullContent += chunk.content
      batchedContent = fullContent

      // Batch UI updates to 50ms
      if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, UI_BATCH_INTERVAL)
      }
    }

    // Final flush
    if (batchTimer) {
      clearTimeout(batchTimer)
    }
    overlayStore.setStreamingContent(fullContent)

    // Record to history
    overlayStore.addToHistory(params.responseType, fullContent)

    // Record usage
    licenseStore.recordAiRequestUsage()

    log.info(`Response generated (${fullContent.length} chars)`)
  } catch (error) {
    log.error('Streaming error', error)
    useAppStore.getState().setErrorMessage(
      error instanceof Error ? error.message : 'AI request failed',
    )
  } finally {
    isProcessing = false
    useAppStore.getState().setProcessing(false)
  }

  return fullContent
}

// Convenience methods matching macOS API
export async function assist(
  transcript: string,
  mode: Mode | null,
  screenshot?: string,
): Promise<string> {
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'Assist' as ResponseType,
  })
}

export async function whatToSay(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'What should I say?' as ResponseType,
  })
}

export async function followUp(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'Follow-up questions' as ResponseType,
  })
}

export async function recap(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'Recap' as ResponseType,
  })
}

export async function askCustomQuestion(
  transcript: string,
  question: string,
  mode: Mode | null,
): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'Custom' as ResponseType,
    customPrompt: question,
  })
}

// Title generation (non-streaming)
export async function generateSessionTitle(transcript: string): Promise<string> {
  try {
    const messages = buildTitlePrompt(transcript)
    const title = await proxyApi.generateAIResponse({
      model: 'auto',
      messages,
      max_tokens: 50,
      temperature: 0.3,
    })
    return title.trim().replace(/^["']|["']$/g, '') || 'Untitled Session'
  } catch (error) {
    log.error('Title generation failed', error)
    return 'Untitled Session'
  }
}

// Summary generation (non-streaming)
export async function generateSessionSummary(transcript: string): Promise<string | null> {
  try {
    const messages = buildSummaryPrompt(transcript)
    const summary = await proxyApi.generateAIResponse({
      model: 'auto',
      messages,
      max_tokens: 300,
      temperature: 0.3,
    })
    return summary.trim() || null
  } catch (error) {
    log.error('Summary generation failed', error)
    return null
  }
}

export function clearHistory(): void {
  useOverlayStore.getState().clearHistory()
}

export function getIsProcessing(): boolean {
  return isProcessing
}
