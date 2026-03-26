import { useMemo } from 'react'
import { Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'

const TAIL_CHARS = 200 // Show roughly the last 3 lines of text

export function TranscriptPanel() {
  const { t } = useTranslation('overlay')
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const interimTranscript = useAppStore((s) => s.interimTranscript)
  const audioLevel = useAppStore((s) => s.audioLevel)

  // Only show the tail of the transcript so the overlay stays readable
  const tailText = useMemo(() => {
    if (!currentTranscript) return ''
    if (currentTranscript.length <= TAIL_CHARS) return currentTranscript
    // Cut at last word boundary after trimming to TAIL_CHARS
    const sliced = currentTranscript.slice(-TAIL_CHARS)
    const firstSpace = sliced.indexOf(' ')
    return firstSpace > 0 ? '…' + sliced.slice(firstSpace) : '…' + sliced
  }, [currentTranscript])

  if (!isSessionActive) return null

  return (
    <div className="flex flex-col border-b border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Mic size={11} className={audioLevel > 0.01 ? 'text-green-400' : 'text-white/30'} />
          <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{t('transcript.title')}</span>
        </div>
        {audioLevel > 0.01 && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(3, Math.min(12, audioLevel * 100 * (1 + i * 0.3)))}px`,
                  backgroundColor: audioLevel * 100 > i * 20 ? '#4ade80' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transcript tail — last ~3 lines with top fade */}
      <div className="relative px-3 pb-2 max-h-[54px] overflow-hidden">
        {/* Top fade-out gradient */}
        {currentTranscript && currentTranscript.length > TAIL_CHARS && (
          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#1a1a1e] to-transparent z-10 pointer-events-none" />
        )}
        <div className="text-[11px] leading-relaxed text-white/80">
          {tailText ? (
            <>
              {tailText}
              {interimTranscript && (
                <span className="text-white/40 italic animate-pulse ml-1">
                  {interimTranscript}
                </span>
              )}
            </>
          ) : (
            <span className="text-white/30 italic">
              {interimTranscript ? (
                <span className="text-white/40 animate-pulse">{interimTranscript}</span>
              ) : (
                t('transcript.listening')
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
