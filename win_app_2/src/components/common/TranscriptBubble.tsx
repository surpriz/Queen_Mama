import { cn } from '@/lib/utils'
import type { TranscriptLine } from '@/services/session/transcriptEntries'

/**
 * Speaker-labelled transcript line (me → right / accent, them → left / surface),
 * shared by the live session view and the session detail page.
 */
export function TranscriptBubble({ line, showTranslation = true }: { line: TranscriptLine; showTranslation?: boolean }) {
  if (line.speaker === null) {
    if (!line.text.trim()) return null
    return <div className="text-qm-text-primary mb-2">{line.text}</div>
  }
  const isMe = line.speaker === 'me'
  return (
    <div className={cn('flex mb-2', isMe ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-3 py-2 rounded-qm-md text-body-sm leading-relaxed',
          isMe ? 'bg-qm-accent text-white rounded-br-sm' : 'bg-qm-surface-medium text-qm-text-primary rounded-bl-sm',
        )}
      >
        <div>{line.text}</div>
        {showTranslation && line.translatedText && (
          <div className={cn('mt-1 text-caption italic', isMe ? 'text-white/70' : 'text-qm-text-tertiary')}>{line.translatedText}</div>
        )}
      </div>
    </div>
  )
}
