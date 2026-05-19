import { useEffect, useRef } from 'react'
import { Globe, CornerDownRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOverlayStore } from '@/stores/overlayStore'
import { useConfigStore } from '@/stores/configStore'
import { getLanguageInfo } from '@/services/translation/deeplLanguage'

export function TranslateTab() {
  const { t } = useTranslation('overlay')
  const entries = useOverlayStore((s) => s.translationEntries)
  const error = useOverlayStore((s) => s.translationError)
  const sourceLang = useConfigStore((s) => s.translationSourceLanguage)
  const targetLang = useConfigStore((s) => s.translationTargetLanguage)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries.length, entries[entries.length - 1]?.translated])

  const sourceLabel =
    !sourceLang || sourceLang.toLowerCase() === 'auto'
      ? t('translate.header.auto')
      : sourceLang.toUpperCase()
  const targetInfo = getLanguageInfo(targetLang)
  const targetLabel = targetInfo ? `${targetInfo.flag} ${targetInfo.badge}` : targetLang

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
      {/* Header — language pair + error */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-qm-border-subtle/40">
        <Globe size={12} className="text-qm-accent-light" />
        <span className="text-caption-sm font-semibold text-qm-text-secondary">
          {sourceLabel} → {targetLabel}
        </span>
        {error && (
          <span className="ml-auto text-[10px] text-yellow-400 truncate max-w-[200px]">
            {error}
          </span>
        )}
      </div>

      {/* Body */}
      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {entries.map((entry) => (
            <EntryBubble
              key={entry.entryId}
              timestamp={entry.timestamp}
              original={entry.original}
              translated={entry.translated}
              targetLang={entry.targetLang}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EntryBubble({
  timestamp,
  original,
  translated,
  targetLang,
}: {
  timestamp: string
  original: string
  translated: string | null
  targetLang: string
}) {
  const time = formatTime(timestamp)
  const targetInfo = getLanguageInfo(targetLang)
  const badge = targetInfo?.badge ?? targetLang

  return (
    <div className="relative rounded-qm-md bg-qm-bg-tertiary/55 shadow-qm-elev-1 p-3">
      {/* Top-right badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <span className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded bg-qm-accent/20 text-qm-accent select-none">
          {badge}
        </span>
      </div>

      {/* Original */}
      <p className="text-body-sm leading-relaxed text-qm-text-primary pr-12 m-0">{original}</p>

      {/* Translation */}
      <div className="mt-2 flex items-start gap-1.5">
        <CornerDownRight size={12} className="mt-1 text-qm-text-tertiary flex-shrink-0" />
        {translated ? (
          <p className="text-body-sm leading-relaxed italic text-qm-text-secondary m-0 flex-1">
            {translated}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-qm-text-tertiary">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-caption italic">Translating…</span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-1.5 text-right">
        <span className="text-[10px] text-qm-text-tertiary/60 font-mono select-none">{time}</span>
      </div>
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation('overlay')
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-qm-accent/30 blur-xl animate-qm-pulse" />
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
          <Globe size={20} className="text-white" strokeWidth={1.75} />
        </div>
      </div>
      <h4 className="font-display text-body-lg font-semibold text-qm-text-primary tracking-tight">
        {t('translate.empty.title')}
      </h4>
      <span className="text-caption text-qm-text-tertiary leading-relaxed">
        {t('translate.empty.subtitle')}
      </span>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}
