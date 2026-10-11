import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logger'
import { captureError, addBreadcrumb } from '@/services/crash/crashReporter'
import { useAppStore } from '@/stores/appStore'
import { useOverlayStore, getOverlaySessionId } from '@/stores/overlayStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useConfigStore } from '@/stores/configStore'
import * as proxyApi from '../proxy/proxyApiClient'
import { getProxyConfigSnapshot } from '../proxy/proxyConfigManager'
import { buildSystemPrompt, buildUserMessage, buildTitlePrompt, buildSummaryPrompt } from './aiContext'
import { getCachedResponse, setCachedResponse, clearCache } from './responseCache'
import { recordUsage, estimateTokens } from './tokenUsageTracker'
import { recordUsage as recordLicenseUsage } from '../license/licenseManager'
import { screenCaptureService } from '../screenCapture/screenCaptureService'
import { flushBatch as flushAudioBatch, flushSystemBatch } from '../transcription/transcriptionService'
import { transcriptBuffer } from '../transcription/transcriptBuffer'
import * as preGeneration from './preGenerationService'
import * as healthCheck from '@/services/health/healthCheckService'
import * as analytics from '@/services/analytics/analyticsService'
import * as relay from '@/services/relay/relayClient'
import { stripPredictionBullets, isRefusalResponse } from './responsePostProcess'
import type { AIContextParams } from './aiContext'
import { Feature } from '@/types/auth'
import { AIStreamError } from '@/types/api'
import type { AIMessage } from '@/types/api'
import type { ResponseType, Mode } from '@/types/models'

const log = createLogger('AIService')

let isProcessing = false
let lastResponseTime = 0
let activeController: AbortController | null = null
const UI_BATCH_INTERVAL = 16 // ms - ~60fps for smooth streaming
const RELAY_INTERVAL = 50 // ms (~20fps overlay streaming)
const MIN_RESPONSE_COOLDOWN = 2000 // 2 seconds between auto-responses
const DEFAULT_MAX_TOKENS = 1000 // mac ProxyConfigManager fallback
const STANDARD_TOKEN_CAP = 600
const RECAP_TOKEN_FLOOR = 3000

/** Shown while a refused/timed-out request is retried without the screenshot. */
const PRIVACY_RETRY_PREFIX =
  '🔒 *Privacy protection activated* — your screen capture contains protected content. Retrying without the screenshot…\n\n'
const PRIVACY_NO_SCREENSHOT_MESSAGE =
  '🔒 **Privacy protection activated**\n\nThe conversation content triggered an AI safety protection. This can happen when the transcript contains sensitive information (medical, financial data) or is interpreted as confidential.\n\n💡 **Try again** — results may vary.'
const TIMEOUT_RETRY_PREFIX = '⏱ *Slow response* — retrying without the screenshot…\n\n'

export interface StreamingOptions {
  manualTrigger?: boolean // Skip cooldown for user-typed questions
  isAutomatic?: boolean // Produced by auto-answer / proactive detection
}

/** Add a completed response to local history and relay it (with a stable id) to the other windows. */
function publishHistoryEntry(
  type: ResponseType,
  content: string,
  meta: { isAutomatic?: boolean; provider?: string; withScreenshot?: boolean } = {},
): string {
  const id = uuidv4()
  const timestamp = new Date().toISOString()
  const sessionId = getOverlaySessionId()
  useOverlayStore.getState().addToHistory(type, content, { id, timestamp, sessionId, ...meta })
  useOverlayStore.getState().setStreamingContent('')
  relay.broadcast('relay:ai-response', {
    type: 'history',
    entry: { id, type, content, timestamp, sessionId, ...meta },
  })
  return id
}

function localizedErrorMessage(error: Error): string {
  if (error instanceof AIStreamError) {
    switch (error.kind) {
      case 'timeout':
        return 'The AI took too long to answer. Please try again.'
      case 'network':
        return 'Network error — check your connection and try again.'
      case 'server':
        return 'The AI service is temporarily unavailable. Please try again.'
      case 'auth':
        return 'Your session has expired. Please sign in again.'
      case 'aborted':
        return 'Request cancelled.'
      default:
        return error.message || 'AI request failed'
    }
  }
  return error.message || 'AI request failed'
}

function publishError(error: Error, params: AIContextParams): void {
  const retryable = error instanceof AIStreamError ? error.retryable : false
  const payload = {
    message: localizedErrorMessage(error),
    retryable,
    retry: { type: params.responseType, question: params.customPrompt },
  }
  useOverlayStore.getState().setLastError(payload)
  relay.broadcast('relay:ai-error', payload)
}

/** Server budget drives Smart mode; Recap needs more, everything else is capped (mac parity). */
function resolveMaxTokens(responseType: ResponseType | string, smartMode: boolean): number {
  const base = getProxyConfigSnapshot().config?.services?.ai?.maxTokens ?? DEFAULT_MAX_TOKENS
  if (responseType === 'Recap') return Math.max(base, RECAP_TOKEN_FLOOR)
  if (smartMode) return base // thinking tokens count against max_tokens
  return Math.min(base, STANDARD_TOKEN_CAP)
}

/** Run one streaming request with batched UI/relay updates; returns the full text. */
async function runStream(
  params: AIContextParams,
  cascadeMode: 'standard' | 'smart' | 'recap',
  maxTokens: number,
  prefix: string,
): Promise<string> {
  const overlayStore = useOverlayStore.getState()
  const systemPrompt = buildSystemPrompt(params)
  const userMessages = buildUserMessage(params)
  const messages: AIMessage[] = [{ role: 'system', content: systemPrompt }, ...userMessages]

  let fullContent = ''
  let batchTimer: ReturnType<typeof setTimeout> | null = null
  let relayTimer: ReturnType<typeof setTimeout> | null = null

  const flushBatch = () => {
    overlayStore.setStreamingContent(prefix + fullContent)
    if (!relayTimer) {
      relayTimer = setTimeout(() => {
        relay.broadcast('relay:ai-response', { type: 'streaming', streamingContent: prefix + fullContent })
        relayTimer = null
      }, RELAY_INTERVAL)
    }
    batchTimer = null
  }

  const controller = new AbortController()
  activeController = controller

  try {
    const stream = proxyApi.streamAIResponse(
      { model: 'auto', messages, stream: true, max_tokens: maxTokens, cascadeMode },
      { signal: controller.signal },
    )

    let isFirstChunk = true
    for await (const chunk of stream) {
      if (chunk.done) break
      fullContent += chunk.content
      if (isFirstChunk) {
        flushBatch()
        isFirstChunk = false
      } else if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, UI_BATCH_INTERVAL)
      }
    }
  } finally {
    if (batchTimer) clearTimeout(batchTimer)
    if (relayTimer) clearTimeout(relayTimer)
    if (activeController === controller) activeController = null
  }

  // Token accounting (1 token ≈ 4 chars)
  const inputText = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('')
  recordUsage(estimateTokens(inputText), estimateTokens(fullContent))

  return fullContent
}

export async function generateStreamingResponse(params: AIContextParams, options?: StreamingOptions): Promise<string> {
  // The guard comes first: the old order wiped the in-flight stream and
  // flipped `isProcessing` off while the first request was still running.
  if (isProcessing) {
    log.warn('Already processing, skipping duplicate')
    return ''
  }

  if (!options?.manualTrigger) {
    const timeSinceLastResponse = Date.now() - lastResponseTime
    if (timeSinceLastResponse < MIN_RESPONSE_COOLDOWN) {
      log.warn(`Response cooldown active (${Math.round(timeSinceLastResponse / 1000)}s/${MIN_RESPONSE_COOLDOWN / 1000}s), skipping`)
      return ''
    }
  }

  const licenseStore = useLicenseStore.getState()
  const access = licenseStore.canUse(Feature.AiRequest)
  if (access.type !== 'allowed') {
    log.warn('AI request not allowed', access)
    if (access.type === 'limitReached') {
      useAppStore.getState().setShowUpgradePricing(true)
    } else {
      useAppStore.getState().setErrorMessage('AI request not available on your plan')
    }
    return ''
  }

  // Include the freshest speech: flush audio batches + transcript buffers,
  // then append the live interims (mic and system — mac includes both).
  flushAudioBatch()
  flushSystemBatch()
  transcriptBuffer.flush()
  const micInterim = useAppStore.getState().interimTranscript
  const systemInterim = getSystemInterim()
  let transcript = params.transcript
  if (micInterim) transcript += `\nMoi: ${micInterim}`
  if (systemInterim) transcript += `\nInterlocuteur: ${systemInterim}`
  params = { ...params, transcript }

  const smartToggle = useConfigStore.getState().smartModeEnabled
  let smartActive = false
  if (params.responseType !== 'Recap' && smartToggle) {
    const smartAccess = licenseStore.canUse(Feature.SmartMode)
    if (smartAccess.type === 'allowed') {
      smartActive = true
    } else {
      log.warn('Smart Mode requested but not allowed, falling back to standard', smartAccess)
      if (smartAccess.type === 'limitReached') {
        useAppStore.getState().setShowUpgradePricing(true)
      } else {
        useAppStore.getState().setErrorMessage('Smart Mode requires the Enterprise plan — using standard mode')
      }
    }
  }
  const cascadeMode: 'standard' | 'smart' | 'recap' =
    params.responseType === 'Recap' ? 'recap' : smartActive ? 'smart' : 'standard'
  if (smartActive) params = { ...params, smartMode: true }

  isProcessing = true
  useAppStore.getState().setProcessing(true)
  const overlayStore = useOverlayStore.getState()
  overlayStore.setStreamingContent('')
  overlayStore.setLastError(null)

  const isScreenOnly = !params.transcript.trim() && !!params.screenshot
  const skipCacheRead = isScreenOnly || options?.manualTrigger === true
  const cached = skipCacheRead
    ? null
    : await getCachedResponse(params.transcript, params.mode?.id ?? null, params.responseType)
  if (cached) {
    publishHistoryEntry(params.responseType, cached, { isAutomatic: options?.isAutomatic })
    lastResponseTime = Date.now()
    isProcessing = false
    useAppStore.getState().setProcessing(false)
    log.info(`Served from cache (${cached.length} chars)`)
    return cached
  }

  const maxTokens = resolveMaxTokens(params.responseType, smartActive)
  addBreadcrumb('ai', `AI streaming request: ${params.responseType} (${cascadeMode}, ${maxTokens} tokens)`, 'info')
  const requestStartedAt = Date.now()
  let fullContent = ''

  try {
    try {
      fullContent = await runStream(params, cascadeMode, maxTokens, '')
    } catch (error) {
      // Timeout with a screenshot → retry with the lighter payload (mac parity)
      if (error instanceof AIStreamError && error.kind === 'timeout' && params.screenshot) {
        log.warn('Timeout with screenshot — retrying without screenshot')
        addBreadcrumb('ai', `Timeout retry without screenshot for ${params.responseType}`, 'warning')
        params = { ...params, screenshot: undefined }
        fullContent = await runStream(params, cascadeMode, maxTokens, TIMEOUT_RETRY_PREFIX)
      } else {
        throw error
      }
    }

    // Refusal detection: the screenshot most likely tripped the safety filter
    if (isRefusalResponse(fullContent)) {
      log.warn('AI refusal detected')
      analytics.capture('ai_refusal_detected', {
        response_type: params.responseType,
        has_screenshot: !!params.screenshot,
      })
      if (params.screenshot) {
        params = { ...params, screenshot: undefined }
        fullContent = await runStream(params, cascadeMode, maxTokens, PRIVACY_RETRY_PREFIX)
        analytics.capture('ai_retry_without_screenshot', {
          response_type: params.responseType,
          retry_succeeded: !isRefusalResponse(fullContent),
        })
      } else {
        fullContent = PRIVACY_NO_SCREENSHOT_MESSAGE
      }
    }

    if (!fullContent.trim()) {
      throw new AIStreamError('The AI returned an empty response. Please try again.', 'server')
    }

    if (params.responseType === 'Assist' || params.responseType === 'Custom') {
      fullContent = stripPredictionBullets(fullContent)
    }

    const provider = proxyApi.getLastStreamMetadata().provider
    publishHistoryEntry(params.responseType, fullContent, {
      isAutomatic: options?.isAutomatic,
      provider,
      withScreenshot: !!params.screenshot,
    })

    await setCachedResponse(params.transcript, params.mode?.id ?? null, params.responseType, fullContent)

    licenseStore.recordAiRequestUsage()
    if (smartActive) {
      recordLicenseUsage('smartMode').catch((e) => log.warn('Failed to record smartMode usage', e))
    }
    if (provider) analytics.trackAIRequestMade(params.responseType, provider)

    const elapsed = Date.now() - requestStartedAt
    healthCheck.recordAIResponseTime(elapsed)
    lastResponseTime = Date.now()
    log.info(`Response generated (${fullContent.length} chars, ${elapsed} ms, ${provider ?? 'unknown provider'})`)
  } catch (error) {
    const err = error instanceof Error ? error : new Error('AI streaming request failed')
    if (error instanceof AIStreamError && error.kind === 'aborted') {
      log.info('AI request cancelled')
    } else {
      log.error('Streaming error', err)
      captureError(err, { service: 'ai', responseType: params.responseType })
      publishError(err, params)
    }
    useOverlayStore.getState().setStreamingContent('')
    relay.broadcast('relay:ai-response', { type: 'streaming', streamingContent: '' })
  } finally {
    isProcessing = false
    useAppStore.getState().setProcessing(false)
  }

  return fullContent
}

/** Abort the in-flight request (if any). */
export function cancelCurrentRequest(): void {
  activeController?.abort()
}

let systemInterimProvider: (() => string) | null = null

/** sessionLifecycle injects the latest "Interlocuteur" interim so requests include it. */
export function setSystemInterimProvider(provider: (() => string) | null): void {
  systemInterimProvider = provider
}

function getSystemInterim(): string {
  try {
    return systemInterimProvider?.() ?? ''
  } catch {
    return ''
  }
}

async function getScreenshotIfEnabled(): Promise<string | undefined> {
  try {
    if (useConfigStore.getState().autoScreenCapture) {
      // The background pre-capture keeps a ≤2 s cache; reuse it instead of
      // paying a fresh capture + encode on every click.
      const cached = await screenCaptureService.getCachedOrCapture()
      return cached ?? undefined
    }
  } catch (err) {
    log.warn('Failed to fetch screenshot for AI context', err)
  }
  return undefined
}

export async function assist(
  transcript: string,
  mode: Mode | null,
  screenshot?: string,
  options?: { skipPreGen?: boolean; isAutomatic?: boolean },
): Promise<string> {
  const preGen = options?.skipPreGen ? null : preGeneration.consumeBuffer()
  if (preGen) {
    publishHistoryEntry('Assist' as ResponseType, preGen, { isAutomatic: options?.isAutomatic })
    useLicenseStore.getState().recordAiRequestUsage()
    lastResponseTime = Date.now()
    log.info(`Served from pre-gen buffer (${preGen.length} chars)`)
    return preGen
  }
  // A manual request supersedes any speculative one (mac cancelAndReset)
  if (!options?.skipPreGen) preGeneration.cancelAndReset()

  const finalScreenshot = screenshot ?? await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot: finalScreenshot,
    mode,
    responseType: 'Assist' as ResponseType,
  }, { manualTrigger: true, isAutomatic: options?.isAutomatic })
}

export async function whatToSay(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'What should I say?' as ResponseType,
  }, { manualTrigger: true })
}

export async function followUp(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'Follow-up' as ResponseType,
  }, { manualTrigger: true })
}

export async function recap(transcript: string, mode: Mode | null): Promise<string> {
  return generateStreamingResponse({
    transcript,
    mode,
    responseType: 'Recap' as ResponseType,
  }, { manualTrigger: true })
}

export async function decode(transcript: string, mode: Mode | null): Promise<string> {
  const screenshot = await getScreenshotIfEnabled()
  return generateStreamingResponse({
    transcript,
    screenshot,
    mode,
    responseType: 'Decode' as ResponseType,
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
    captureError(
      error instanceof Error ? error : new Error('Title generation failed'),
      { service: 'ai', operation: 'generateTitle' },
    )
    return 'Untitled Session'
  }
}

export async function generateSessionSummary(transcript: string): Promise<string | null> {
  try {
    const messages = buildSummaryPrompt(transcript)
    const summary = await proxyApi.generateAIResponse({
      model: 'auto',
      messages,
      max_tokens: 3000,
      temperature: 0.3,
    })
    return summary.trim() || null
  } catch (error) {
    log.error('Summary generation failed', error)
    captureError(
      error instanceof Error ? error : new Error('Summary generation failed'),
      { service: 'ai', operation: 'generateSummary' },
    )
    return null
  }
}

export function clearHistory(): void {
  useOverlayStore.getState().clearHistory()
  clearCache()
  relay.broadcast('relay:ai-response', { type: 'clear' })
}

export function getIsProcessing(): boolean {
  return isProcessing
}
