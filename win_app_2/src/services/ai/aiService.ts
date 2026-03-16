import { createLogger } from '@/lib/logger'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore } from '@/stores/overlayStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useConfigStore } from '@/stores/configStore'
import * as proxyApi from '../proxy/proxyApiClient'
import { buildSystemPrompt, buildUserMessage, buildTitlePrompt, buildSummaryPrompt } from './aiContext'
import { getCachedResponse, setCachedResponse, clearCache } from './responseCache'
import { recordUsage, estimateTokens } from './tokenUsageTracker'
import { screenCaptureService } from '../screenCapture/screenCaptureService'
import type { AIContextParams } from './aiContext'
import { Feature } from '@/types/auth'
import type { ResponseType, Mode } from '@/types/models'
import type { AIMessage } from '@/types/api'

const log = createLogger('AIService')

let isProcessing = false
let lastResponseTime = 0
const UI_BATCH_INTERVAL = 16 // ms - ~60fps for smooth streaming
const RELAY_INTERVAL = 100 // ms - less frequent IPC relay to reduce overhead
const MIN_RESPONSE_COOLDOWN = 2000 // 2 seconds between auto-responses

export interface StreamingOptions {
  manualTrigger?: boolean // Skip cooldown for user-typed questions
}

export async function generateStreamingResponse(params: AIContextParams, options?: StreamingOptions): Promise<string> {
  // Show processing state immediately so the UI responds on first click,
  // before screenshot capture and network latency kick in
  useAppStore.getState().setProcessing(true)
  const overlayStore = useOverlayStore.getState()
  overlayStore.setStreamingContent('')

  if (isProcessing) {
    log.warn('Already processing, skipping duplicate')
    useAppStore.getState().setErrorMessage('Already processing a request...')
    useAppStore.getState().setProcessing(false)
    return ''
  }

  // Prevent duplicate responses within cooldown window (skip for manual triggers)
  if (!options?.manualTrigger) {
    const timeSinceLastResponse = Date.now() - lastResponseTime
    if (timeSinceLastResponse < MIN_RESPONSE_COOLDOWN) {
      log.warn(`Response cooldown active (${Math.round(timeSinceLastResponse / 1000)}s/${MIN_RESPONSE_COOLDOWN / 1000}s), skipping`)
      useAppStore.getState().setProcessing(false)
      return ''
    }
  }

  // License check
  const licenseStore = useLicenseStore.getState()
  const access = licenseStore.canUse(Feature.AiRequest)
  if (access.type !== 'allowed') {
    log.warn('AI request not allowed', access)
    if (access.type === 'limitReached') {
      useAppStore.getState().setErrorMessage('Daily AI request limit reached')
    } else {
      useAppStore.getState().setErrorMessage('AI request not available on your plan')
    }
    useAppStore.getState().setProcessing(false)
    return ''
  }

  isProcessing = true

  // Check cache first (skip cache in screen-only mode — each call needs a fresh screenshot)
  const isScreenOnly = !params.transcript.trim() && !!params.screenshot
  const cached = isScreenOnly ? null : await getCachedResponse(
    params.transcript,
    params.mode?.id ?? null,
    params.responseType,
  )
  if (cached) {
    overlayStore.addToHistory(params.responseType, cached)
    overlayStore.setStreamingContent('')
    // Broadcast cached response to all windows
    window.electronAPI?.relay?.broadcast('relay:ai-response', {
      type: 'history',
      streamingContent: '',
      entry: { type: params.responseType, content: cached, timestamp: new Date().toISOString() },
    })
    lastResponseTime = Date.now()
    isProcessing = false
    useAppStore.getState().setProcessing(false)
    log.info(`Served from cache (${cached.length} chars)`)
    return cached
  }

  const systemPrompt = buildSystemPrompt(params)
  const userMessages = buildUserMessage(params)

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ]

  let fullContent = ''
  let batchedContent = ''
  let batchTimer: ReturnType<typeof setTimeout> | null = null
  let relayTimer: ReturnType<typeof setTimeout> | null = null

  const flushBatch = () => {
    if (batchedContent) {
      overlayStore.setStreamingContent(batchedContent)
      // Relay to other windows at a lower frequency to reduce IPC overhead
      if (!relayTimer) {
        relayTimer = setTimeout(() => {
          window.electronAPI?.relay?.broadcast('relay:ai-response', {
            type: 'streaming',
            streamingContent: batchedContent,
          })
          relayTimer = null
        }, RELAY_INTERVAL)
      }
    }
    batchTimer = null
  }

  // Token limits matching macOS: 1000 default, 3000 for recap
  const maxTokens = params.responseType === 'Recap' ? 3000 : 1000

  try {
    const stream = proxyApi.streamAIResponse({
      model: 'auto',
      messages,
      stream: true,
      max_tokens: maxTokens,
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
      batchTimer = null
    }
    if (relayTimer) {
      clearTimeout(relayTimer)
      relayTimer = null
    }
    overlayStore.setStreamingContent(fullContent)

    // Record to history and clear streaming content (so it doesn't show twice)
    overlayStore.addToHistory(params.responseType, fullContent)
    overlayStore.setStreamingContent('')

    // Broadcast completed response to all windows
    const timestamp = new Date().toISOString()
    window.electronAPI?.relay?.broadcast('relay:ai-response', {
      type: 'history',
      streamingContent: '',
      entry: { type: params.responseType, content: fullContent, timestamp },
    })

    // Cache the response
    await setCachedResponse(
      params.transcript,
      params.mode?.id ?? null,
      params.responseType,
      fullContent,
    )

    // Record usage
    licenseStore.recordAiRequestUsage()

    // Estimate token usage from character counts (1 token ≈ 4 chars)
    const inputText = messages.map((m) => m.content).join('')
    const estInputTokens = estimateTokens(inputText)
    const estOutputTokens = estimateTokens(fullContent)
    recordUsage(estInputTokens, estOutputTokens)

    lastResponseTime = Date.now()
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

// Auto-fetch screenshot if screen capture is enabled
async function getScreenshotIfEnabled(): Promise<string | undefined> {
  try {
    if (useConfigStore.getState().autoScreenCapture) {
      // Force a fresh capture so page/window changes are always reflected
      const fresh = await screenCaptureService.captureOnce()
      if (fresh) return fresh
      // Fallback to cache if fresh capture returned null (hash dedup on static screen)
      const cached = await screenCaptureService.getCachedOrCapture()
      return cached ?? undefined
    }
  } catch (err) {
    log.warn('Failed to fetch screenshot for AI context', err)
  }
  return undefined
}

// Convenience methods matching macOS API
export async function assist(
  transcript: string,
  mode: Mode | null,
  screenshot?: string,
): Promise<string> {
  const finalScreenshot = screenshot ?? await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot: finalScreenshot,
    mode,
    responseType: 'Assist' as ResponseType,
  }, { manualTrigger: true })
}

export async function whatToSay(transcript: string, mode: Mode | null): Promise<string> {
  const screenshot = await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'What should I say?' as ResponseType,
  }, { manualTrigger: true })
}

export async function followUp(transcript: string, mode: Mode | null): Promise<string> {
  const screenshot = await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'Follow-up' as ResponseType,
  }, { manualTrigger: true })
}

export async function recap(transcript: string, mode: Mode | null): Promise<string> {
  const screenshot = await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'Recap' as ResponseType,
  }, { manualTrigger: true })
}

export async function askCustomQuestion(
  transcript: string,
  question: string,
  mode: Mode | null,
): Promise<string> {
  const screenshot = await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'Custom' as ResponseType,
    customPrompt: question,
  }, { manualTrigger: true })
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
  clearCache()
}

export function getIsProcessing(): boolean {
  return isProcessing
}
