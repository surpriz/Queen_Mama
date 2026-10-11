import { useRef, useEffect, useState, useCallback, memo, lazy, Suspense, useDeferredValue } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import React from 'react'
import { Copy, Check, Sparkles, ThumbsUp, ThumbsDown, Camera, X, RefreshCw, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore, type ResponseHistoryEntry } from '@/stores/overlayStore'
import { useAppStore } from '@/stores/appStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { ResponseType } from '@/types/models'
import { submitFeedback } from '@/services/proxy/proxyApiClient'
import * as sessionClient from '@/services/session/sessionClient'
import { toast } from '@/stores/toastStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'

// react-markdown plugin arrays (shared by history + stream rendering).
// `singleDollarTextMath: false` → "$5 and $10" stays money; only $$…$$ blocks
// are math (mac MarkdownRenderer parity).
const REMARK_PLUGINS = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] as const
// ignoreMissing → unknown languages (e.g. "mermaid") are left as raw text instead
// of throwing, so the Mermaid code renderer still receives the source string.
const REHYPE_PLUGINS = [rehypeKatex, [rehypeHighlight, { ignoreMissing: true }]] as const

// Mermaid is ~1 MB; load it only when a diagram actually shows up.
const MermaidDiagram = lazy(() => import('./MermaidDiagram'))

function isMermaidCode(node: React.ReactNode): boolean {
  const codeEl = React.Children.toArray(node).find(
    (child) => React.isValidElement(child) && (child as React.ReactElement).type === 'code',
  )
  const className = React.isValidElement(codeEl)
    ? ((codeEl as React.ReactElement<{ className?: string }>).props.className ?? '')
    : ''
  return className.includes('language-mermaid')
}

// Renders fenced code: Mermaid → diagram, everything else → default <code>
// (children already carry highlight.js spans added by rehype-highlight).
function CodeRenderer({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  if (className?.includes('language-mermaid')) {
    const source = Array.isArray(children) ? children.join('') : String(children ?? '')
    return (
      <Suspense fallback={<div className="text-qm-text-tertiary text-xs">Rendering diagram…</div>}>
        <MermaidDiagram code={source.replace(/\n$/, '')} />
      </Suspense>
    )
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

const MARKDOWN_COMPONENTS = { pre: CodeBlockWrapper, code: CodeRenderer }

// ── Markdown normalization ───────────────────────────────────────────
// Normalize inline bullets ("• item1 • item2") into separate lines
function normalizeMarkdown(text: string): string {
  return text.replace(/ • /g, '\n• ')
}

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS as never} rehypePlugins={REHYPE_PLUGINS as never} components={MARKDOWN_COMPONENTS}>
      {normalizeMarkdown(content)}
    </ReactMarkdown>
  )
})

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
  const { t } = useTranslation('overlay')
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

  // Mermaid renders as a diagram (via the code renderer) — skip the code chrome.
  if (isMermaidCode(children)) {
    return <>{children}</>
  }

  return (
    <div className="relative group">
      <pre {...props}>{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-qm-surface-hover text-qm-text-tertiary hover:text-qm-text-secondary"
        title={t('response.copyCode')}
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

// ── Badges ──────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-green-500/15 text-green-400',
  openai: 'bg-green-500/15 text-green-400',
  Anthropic: 'bg-purple-500/15 text-purple-400',
  anthropic: 'bg-purple-500/15 text-purple-400',
  'Google Gemini': 'bg-blue-500/15 text-blue-400',
  gemini: 'bg-blue-500/15 text-blue-400',
  'xAI Grok': 'bg-orange-500/15 text-orange-400',
  grok: 'bg-orange-500/15 text-orange-400',
}

function ProviderBadge({ provider }: { provider: string }) {
  const colorClass = PROVIDER_COLORS[provider] ?? 'bg-qm-surface-medium text-qm-text-tertiary'
  return (
    <span className={`text-[10px] font-medium leading-none px-1.5 py-0.5 rounded ${colorClass} select-none`}>
      {provider}
    </span>
  )
}

const TYPE_LABEL_KEYS: Partial<Record<ResponseType, string>> = {
  [ResponseType.Assist]: 'tabs.assist',
  [ResponseType.WhatToSay]: 'tabs.whatToSay',
  [ResponseType.FollowUp]: 'tabs.followUp',
  [ResponseType.Recap]: 'tabs.recap',
  [ResponseType.Decode]: 'tabs.decode',
  [ResponseType.Custom]: 'response.customLabel',
}

function TypeBadge({ type }: { type: ResponseType }) {
  const { t } = useTranslation('overlay')
  const key = TYPE_LABEL_KEYS[type]
  if (!key) return null
  return (
    <span className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-qm-surface-medium text-qm-text-tertiary select-none">
      {t(key)}
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

// ── Error bubble with Retry (mac AIErrorToast parity) ───────────────

function ErrorBubble() {
  const { t } = useTranslation('overlay')
  const lastError = useOverlayStore((s) => s.lastError)
  const setLastError = useOverlayStore((s) => s.setLastError)
  const isProcessing = useAppStore((s) => s.isProcessing)

  // Non-retryable errors go away on their own after 5 s
  useEffect(() => {
    if (!lastError || lastError.retryable) return
    const timer = setTimeout(() => setLastError(null), 5000)
    return () => clearTimeout(timer)
  }, [lastError, setLastError])

  if (!lastError) return null

  const handleRetry = () => {
    const retry = lastError.retry
    setLastError(null)
    if (!retry) return
    sessionClient.triggerAI(retry.type, retry.question).catch((err) => {
      toast.error(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <div className="flex items-start gap-2 rounded-qm-md bg-qm-error/10 border border-qm-error/25 p-3 animate-qm-fade-in">
      <AlertTriangle size={14} className="text-qm-error mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-qm-text-primary">{lastError.message}</p>
        {lastError.retryable && (
          <button
            onClick={handleRetry}
            disabled={isProcessing}
            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-qm-error/20 hover:bg-qm-error/30 text-qm-error text-caption font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} />
            {t('response.retry')}
          </button>
        )}
      </div>
      <button onClick={() => setLastError(null)} className="p-0.5 rounded text-qm-text-tertiary hover:text-qm-text-primary" title={t('response.dismiss')}>
        <X size={12} />
      </button>
    </div>
  )
}

// ── History bubble (memoized: the list no longer re-parses every entry on each stream tick) ──

const HistoryBubble = memo(function HistoryBubble({
  entry,
  formatRelativeTime,
}: {
  entry: ResponseHistoryEntry
  formatRelativeTime: (iso: string) => string
}) {
  const { t } = useTranslation('overlay')
  const dismissed = useOverlayStore((s) => s.dismissedAutoIds.includes(entry.id))
  const dismissAutoBadge = useOverlayStore((s) => s.dismissAutoBadge)
  const showAuto = entry.isAutomatic && !dismissed

  return (
    <div
      className={`relative rounded-qm-md bg-qm-bg-tertiary/55 shadow-qm-elev-1 p-3 ${
        showAuto ? 'border-l-2 border-amber-400/70' : ''
      }`}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {showAuto && (
          <span className="flex items-center gap-1 text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 select-none">
            {t('response.autoLabel')}
            <button onClick={() => dismissAutoBadge(entry.id)} className="hover:text-white" title={t('response.dismiss')}>
              <X size={9} />
            </button>
          </span>
        )}
        {entry.withScreenshot && (
          <span className="text-qm-text-tertiary" title={t('response.screenCaptured')}>
            <Camera size={11} />
          </span>
        )}
        {entry.provider && <ProviderBadge provider={entry.provider} />}
        <FeedbackButtons responseId={entry.id} sessionId={entry.sessionId ?? ''} />
        <CopyButton text={entry.content} />
      </div>

      <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed pr-16">
        <Markdown content={entry.content} />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <TypeBadge type={entry.type} />
        <span className="text-[10px] text-qm-text-tertiary/60 select-none">{formatRelativeTime(entry.timestamp)}</span>
      </div>
    </div>
  )
})

// ── Main component ───────────────────────────────────────────────────

export function ResponseDisplay() {
  const { t } = useTranslation('overlay')
  const formatRelativeTime = useFormatRelativeTime()
  const streamingContent = useOverlayStore((s) => s.streamingContent)
  const responseHistory = useOverlayStore((s) => s.responseHistory)
  const hasError = useOverlayStore((s) => s.lastError !== null)
  const isProcessing = useAppStore((s) => s.isProcessing)
  const errorMessage = useAppStore((s) => s.errorMessage)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Markdown is rendered live while streaming; the deferred value lets React
  // skip intermediate chunks when parsing can't keep up with the 16 ms ticks.
  const deferredStreaming = useDeferredValue(streamingContent)

  // Surface error messages through central toast system, then clear from store
  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage)
      useAppStore.getState().setErrorMessage(null)
    }
  }, [errorMessage])

  // Force re-render every 30s so relative timestamps stay fresh (cheap: bubbles are memoized)
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll only while the user is pinned to the bottom; scrolling up to
  // read an earlier answer during streaming is no longer fought.
  const pinnedToBottom = useRef(true)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }, [])
  useEffect(() => {
    if (isProcessing && !streamingContent) pinnedToBottom.current = true // new request → follow it
  }, [isProcessing, streamingContent])
  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight
  }, [deferredStreaming, responseHistory.length, isProcessing, hasError])

  const hasHistory = responseHistory.length > 0

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto p-3 space-y-3">
        {(hasHistory || isProcessing || streamingContent || hasError) ? (
          <>
            {[...responseHistory].reverse().map((entry) => (
              <HistoryBubble key={entry.id} entry={entry} formatRelativeTime={formatRelativeTime} />
            ))}

            <ErrorBubble />

            {isProcessing && !streamingContent && <ProcessingIndicator />}

            {streamingContent && (
              <div className="relative rounded-qm-md bg-qm-bg-tertiary/55 shadow-qm-elev-1 p-3 border-l-2 border-qm-accent/60">
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {!isProcessing && <CopyButton text={streamingContent} />}
                </div>

                <div className="prose prose-invert prose-sm max-w-none text-body-sm leading-relaxed pr-16">
                  <Markdown content={deferredStreaming} />
                  {isProcessing && (
                    <span className="inline-block w-[3px] h-[14px] rounded-full bg-qm-accent-light shadow-[0_0_8px_rgba(167,139,250,0.7)] animate-pulse ml-1 align-middle" />
                  )}
                </div>

                <div className="mt-1.5 text-right">
                  <span className="text-[10px] text-qm-text-tertiary/60 select-none">{t('response.streaming')}</span>
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
