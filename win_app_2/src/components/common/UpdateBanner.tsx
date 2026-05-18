import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUpdaterStore } from '@/stores/updaterStore'
import { cn } from '@/lib/utils'

export function UpdateBanner() {
  const { t } = useTranslation('dashboard')
  const status = useUpdaterStore((s) => s.status)
  const version = useUpdaterStore((s) => s.version)
  const percent = useUpdaterStore((s) => s.percent)
  const dismissed = useUpdaterStore((s) => s.dismissedForSession)
  const dismissBanner = useUpdaterStore((s) => s.dismissBanner)

  const isDownloaded = status === 'downloaded'
  const isDownloading = status === 'downloading'
  const visible = (isDownloaded && !dismissed) || isDownloading

  const handleInstall = () => {
    const api = window.electronAPI as typeof window.electronAPI & {
      installUpdate?: () => Promise<boolean>
    }
    api?.installUpdate?.()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="update-banner"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.34, 1.2, 0.64, 1] }}
          className={cn(
            'relative z-40 w-full px-5 py-2.5 flex items-center gap-4',
            'qm-glass-strong border-b border-qm-accent/30',
            'shadow-[0_4px_18px_-6px_rgba(56,189,248,0.35)]',
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isDownloaded ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-qm-accent/15 ring-1 ring-qm-accent/40">
                <Download size={16} className="text-qm-accent" strokeWidth={2.2} />
              </div>
            ) : (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-qm-cyan/15 ring-1 ring-qm-cyan/30">
                <Loader2 size={16} className="text-qm-cyan animate-spin" strokeWidth={2.2} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-semibold text-qm-text-primary leading-tight">
                {isDownloaded
                  ? t('update.banner.readyTitle', { version: version ?? '' })
                  : t('update.banner.downloadingTitle', { percent })}
              </p>
              <p className="text-caption text-qm-text-tertiary leading-tight mt-0.5">
                {isDownloaded
                  ? t('update.banner.readyDescription')
                  : t('update.banner.downloadingDescription')}
              </p>
            </div>
          </div>

          {isDownloaded && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInstall}
                className={cn(
                  'px-3.5 py-1.5 rounded-qm-md text-body-sm font-semibold text-white',
                  'bg-qm-accent hover:bg-qm-accent/85 active:bg-qm-accent/95',
                  'shadow-qm-glow transition-colors',
                )}
              >
                {t('update.banner.installNow')}
              </button>
              <button
                onClick={dismissBanner}
                className="px-3 py-1.5 rounded-qm-md text-body-sm text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
              >
                {t('update.banner.later')}
              </button>
              <button
                onClick={dismissBanner}
                aria-label={t('update.banner.dismiss')}
                className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isDownloading && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-32 h-1.5 rounded-full bg-qm-surface-medium overflow-hidden">
                <motion.div
                  className="h-full bg-qm-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-caption text-qm-text-tertiary tabular-nums w-10 text-right">
                {percent}%
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
