import { useRef, useEffect, useState, useCallback } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import React from 'react'
import { Copy, Check, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { submitFeedback } from '@/services/proxy/proxyApiClient'
import { toast } from '@/stores/toastStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Markdown normalization ───────────────────────────────────────────
// Normalize inline bullets ("• item1 • item2") into separate lines
function normalizeMarkdown(text: string): string {
  return text.replace(/ • /g, '\n• ')
}

// ── Relative time helper ─────────────────────────────────────────────

function useFormatRelativeTime() {
  const { t } = useTranslation('overlay')

  return function formatRelativeTime(isoTimestamp: string): string {
    const diff = Date.now() - new Date(isoTimestamp).getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 5) return t('response.justNow')
    if (seconds < 60) return t('response.secondsAgo', { count: seconds })

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('response.minutesAgo', { count: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('response.hoursAgo', { count: hours })

    const days = Math.floor(hours / 24)
    return t('response.daysAgo', { count: days })
  }
}

// ── Per-bubble copy button ───────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation('overlay')
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-qm-sm bg-qm-surface-medium hover:bg-qm-surface-hover text-qm-text-tertiary transition-colors"
      title={t('response.copyToClipboard')}
    >
      {copied ? <Check size={12} className="text-qm-success" /> : <Copy size={12} />}
    </button>
  )
}

// ── Code block with copy button ─────────────────────────────────────

function CodeBlockWrapper({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false)

  const getCodeText = () => {
    const codeEl = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && (child as React.ReactElement).type === 'code',
    )
    if (React.isValidElement(codeEl)) {
      return String((codeEl as React.ReactElement<{ children?: React.ReactNode }>).props.children ?? '').replace(/\n$/, '')
    }
    return ''
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <pre {...props}>{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-qm-surface-hover text-qm-text-tertiary hover:text-qm-text-secondary"
        title="Copier le code"
      >
        {copied ? <Check size={11} className="text-qm-success" /> : <Copy size={11} />}
      </button>
    </div>
  )
}

// ── Per-bubble feedback buttons ─────────────────────────────────────

function FeedbackButtons({ responseId, sessionId }: { responseId: string; sessionId: string }) {
  const { t } = useTranslation('overlay')
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null)
  const canUseKB = useLicenseStore((s) => s.canUse)(Feature.KnowledgeBase).type === 'allowed'

  const handleFeedback = useCallback(async (isHelpful: boolean) => {
    const rating = isHelpful ? 'positive' : 'negative'
    setFeedback(rating)
    try {
      await submitFeedback(responseId, sessionId, isHelpful)
    } catch (err) {
      console.warn('[Feedback] Submit failed:', err)
    }
  }, [responseId, sessionId])

  // After the hooks — early returns before useCallback break the hook order
  // when the license state changes mid-session
  if (!canUseKB) return null

  return (
    <>
      <button
        onClick={() => handleFeedback(true)}
        disabled={feedback !== null}
        className={`p-1 rounded-qm-sm transition-colors ${
          feedback === 'positive'
            ? 'bg-qm-success/20 text-qm-success'
            : 'bg-qm-surface-medium hover:bg-qm-surface-hover text-qm-text-tertiary'
        } ${feedback !== null ? 'opacity-60 cursor-default' : ''}`}
        title={t('response.helpful')}
      >
        <ThumbsUp size={12} />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        disabled={feedback !== null}
        className={`p-1 rounded-qm-sm transition-colors ${
          feedback === 'negative'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-qm-surface-medium hover:bg-qm-surface-hover text-qm-text-tertiary'
        } ${feedback !== null ? 'opacity-60 cursor-default' : ''}`}
        title={t('response.notHelpful')}
      >
        <ThumbsDown size={12} />
      </button>
    </>
  )
}

// ── Provider badge ──────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-green-500/15 text-green-400',
  Anthropic: 'bg-purple-500/15 text-purple-400',
  'Google Gemini': 'bg-blue-500/15 text-blue-400',
  'xAI Grok': 'bg-orange-500/15 text-orange-400',
}

function ProviderBadge({ provider }: { provider: string }) {
  const colorClass = PROVIDER_COLORS[provider] ?? 'bg-qm-surface-medium text-qm-text-tertiary'
  return (
    <span className={`text-[10px] font-medium leading-none px-1.5 py-0.5 rounded ${colorClass} select-none`}>
      {provider}
    </span>
  )
}

// ── Processing indicator (mirrors macOS ProcessingIndicator) ─────────

function ProcessingIndicator() {
  const { t } = useTranslation('overlay')
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full bg-qm-accent animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
          />
        ))}
      </div>
      <span className="text-qm-text-secondary text-body-sm">{t('response.analyzing')}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────

export function ResponseDisplay() {
  const { t } = useTranslation('overlay')
  const formatRelativeTime = useFormatRelativeTime()
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const isAutoAnswer = useOverlayStore((s) => s.isAutoAnswer)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const errorMessage = useAppStore((s) => s.errorMessage)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Surface error messages through central toast system, then clear from store
  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage)
      useAppStore.getState().setErrorMessage(null)
    }
  }, [errorMessage])

  // Force re-render every 30s so relative timestamps stay fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll when processing starts or new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamingContent, responseHistory.length, isProcessing])

  const hasHistory = responseHistory.length > 0

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-y-auto p-3 space-y-3">
        {(hasHistory || isProcessing || streamingContent) ? (
          <>
            {/* History bubbles (newest first in store, render oldest first) */}
            {[...responseHistory].reverse().map((entry, idx) => (
              <div
                key={`${entry.timestamp}-${idx}`}
                className="relative rounded-qm-md bg-qm-bg-tertiary/55 shadow-qm-elev-1 p-3"
              >
                {/* Top-right actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {isAutoAnswer && (
                    <span className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-qm-accent/20 text-qm-accent select-none">
                      {t('response.autoLabel')}
                    </span>
                  )}
                  {entry.provider && <ProviderBadge provider={entry.provider} />}
                  <FeedbackButtons
                    responseId={entry.id ?? entry.timestamp}
                    sessionId={entry.sessionId ?? ''}
                  />
                  <CopyButton text={entry.content} />
                </div>

                {/* Markdown body */}
                <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed pr-16">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlockWrapper }}>
                    {normalizeMarkdown(entry.content)}
                  </ReactMarkdown>
                </div>

                {/* Timestamp */}
                <div className="mt-1.5 text-right">
                  <span className="text-[10px] text-qm-text-tertiary/60 select-none">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {/* Analyzing indicator — shown immediately on click, before first token */}
            {isProcessing && !streamingContent && <ProcessingIndicator />}

            {/* Live streaming content (not yet in history) */}
            {streamingContent && (
              <div className="relative rounded-qm-md bg-qm-bg-tertiary/55 shadow-qm-elev-1 p-3">
                {/* Top-right actions */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {isAutoAnswer && (
                    <span className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-qm-accent/20 text-qm-accent select-none">
                      {t('response.autoLabel')}
                    </span>
                  )}
                  {!isProcessing && <CopyButton text={streamingContent} />}
                </div>

                <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed pr-16">
                  {isProcessing ? (
                    // Plain text during streaming — avoids expensive Markdown re-parsing on every chunk
                    <p className="whitespace-pre-wrap m-0">
                      {streamingContent}
                      <span className="inline-block w-[3px] h-[14px] rounded-full bg-qm-accent-light shadow-[0_0_8px_rgba(167,139,250,0.7)] animate-pulse ml-1 align-middle" />
                    </p>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlockWrapper }}>
                      {normalizeMarkdown(streamingContent)}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Timestamp placeholder for live content */}
                <div className="mt-1.5 text-right">
                  <span className="text-[10px] text-qm-text-tertiary/60 select-none">
                    {t('response.streaming')}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-qm-accent/30 blur-xl animate-qm-pulse" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
                <Sparkles size={20} className="text-white" strokeWidth={1.75} />
              </div>
            </div>
            <h4 className="font-display text-body-lg font-semibold text-qm-text-primary tracking-tight">
              {t('response.readyToAssist')}
            </h4>
            <span className="text-caption text-qm-text-tertiary leading-relaxed">
              {t('response.typeQuestionOrTab')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
