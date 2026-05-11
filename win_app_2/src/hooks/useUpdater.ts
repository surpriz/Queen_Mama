import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpdaterStore } from '@/stores/updaterStore'
import { toast } from '@/stores/toastStore'

interface UpdaterPayload {
  status: string
  data?: unknown
}

export function useUpdater() {
  const { t } = useTranslation('dashboard')
  const store = useUpdaterStore

  useEffect(() => {
    const api = window.electronAPI as typeof window.electronAPI & {
      onUpdaterStatus?: (cb: (payload: UpdaterPayload) => void) => () => void
    }
    if (!api?.onUpdaterStatus) return

    const unsub = api.onUpdaterStatus((payload) => {
      const s = store.getState()
      switch (payload.status) {
        case 'checking-for-update':
          s.setStatus('checking')
          break
        case 'update-available': {
          const info = payload.data as { version?: string } | undefined
          s.setAvailable(info?.version ?? null)
          toast.info(
            t('update.toast.availableTitle'),
            t('update.toast.availableDescription', { version: info?.version ?? '' }),
            4500,
          )
          break
        }
        case 'update-not-available':
          s.setStatus('not-available')
          break
        case 'download-progress': {
          const progress = payload.data as { percent?: number } | undefined
          s.setProgress(progress?.percent ? Math.round(progress.percent) : 0)
          break
        }
        case 'update-downloaded': {
          const info = payload.data as { version?: string } | undefined
          s.setDownloaded(info?.version ?? null)
          break
        }
        case 'update-error': {
          const err = payload.data as { message?: string } | undefined
          s.setError(err?.message ?? 'Unknown error')
          toast.error(t('update.toast.errorTitle'), err?.message)
          break
        }
        default:
          break
      }
    })

    return () => unsub()
  }, [t, store])
}
