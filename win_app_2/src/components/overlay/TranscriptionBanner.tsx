import { useState } from 'react'
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import { useTranscriptionStateStore } from '@/stores/transcriptionStateStore'
import * as sessionClient from '@/services/session/sessionClient'
import { cn } from '@/lib/utils'

/**
 * Shown while a session runs but the transcription socket is down
 * (mac `TranscriptionConnectionBanner` parity): explains the state and offers
 * "Retry now" instead of leaving the user with a silent, empty transcript.
 */
export function TranscriptionBanner() {
  const { t } = useTranslation('overlay')
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const connected = useTranscriptionStateStore((s) => s.connected)
  const countdown = useTranscriptionStateStore((s) => s.recoveryCountdown ?? 0)
  const connecting = useTranscriptionStateStore((s) => s.connecting)
  const [retrying, setRetrying] = useState(false)

  // Initial connect of the session is not a disconnection: stay quiet until the
  // socket is up or the service reports a real drop / recovery cycle.
  if (!isSessionActive || connected || (connecting && countdown === 0)) return null

  const gaveUp = countdown === -1
  const label = gaveUp
    ? t('transcriptionBanner.stopped')
    : countdown > 0
      ? t('transcriptionBanner.retryingIn', { seconds: countdown })
      : t('transcriptionBanner.reconnecting')

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await sessionClient.retryTranscription()
    } catch {
      // the relayed state will show the outcome
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border-b border-white/5 text-caption',
        gaveUp ? 'bg-qm-error/15 text-qm-error' : 'bg-amber-500/15 text-amber-300',
      )}
    >
      {gaveUp ? <WifiOff size={12} /> : <Loader2 size={12} className="animate-spin" />}
      <span className="flex-1 truncate">{label}</span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-qm-text-primary font-medium transition-colors disabled:opacity-50"
      >
        <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
        {t('transcriptionBanner.retryNow')}
      </button>
    </div>
  )
}
