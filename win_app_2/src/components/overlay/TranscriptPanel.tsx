import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

export function TranscriptPanel() {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const interimTranscript = useAppStore((s) => s.interimTranscript)
  const audioLevel = useAppStore((s) => s.audioLevel)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentTranscript, interimTranscript])

  if (!isSessionActive) return null

  return (
    <div className="flex flex-col border-b border-white/5 max-h-[140px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Mic size={11} className={audioLevel > 0.01 ? 'text-green-400' : 'text-white/30'} />
          <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Transcript</span>
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

      {/* Transcript content */}
      <div
        ref={scrollRef}
        className="flex-1 px-3 pb-2 overflow-y-auto text-[11px] leading-relaxed text-white/80 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
      >
        {currentTranscript ? (
          <>
            {currentTranscript}
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
              'Listening...'
            )}
          </span>
        )}
      </div>
    </div>
  )
}
