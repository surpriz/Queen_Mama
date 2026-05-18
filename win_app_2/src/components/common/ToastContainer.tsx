import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastVariant } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

const ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
}

const TONES: Record<ToastVariant, { icon: string; ring: string; glow: string }> = {
  info: {
    icon: 'text-qm-cyan',
    ring: 'ring-qm-cyan/25',
    glow: 'shadow-qm-glow-cyan',
  },
  success: {
    icon: 'text-emerald-400',
    ring: 'ring-emerald-400/25',
    glow: 'shadow-[0_0_0_1px_rgba(16,185,129,0.3),0_4px_16px_-2px_rgba(16,185,129,0.35)]',
  },
  error: {
    icon: 'text-red-400',
    ring: 'ring-red-400/30',
    glow: 'shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_4px_16px_-2px_rgba(239,68,68,0.35)]',
  },
  warning: {
    icon: 'text-amber-400',
    ring: 'ring-amber-400/25',
    glow: 'shadow-[0_0_0_1px_rgba(245,158,11,0.3),0_4px_16px_-2px_rgba(245,158,11,0.35)]',
  },
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="fixed z-[100] bottom-4 right-4 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.variant]
          const tone = TONES[t.variant]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 32, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
              className={cn(
                'qm-glass-strong pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[380px] px-3.5 py-3 rounded-qm-lg ring-1',
                tone.ring,
                tone.glow,
              )}
            >
              <Icon size={18} strokeWidth={2} className={cn('flex-shrink-0 mt-0.5', tone.icon)} />
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-qm-text-primary leading-tight tracking-tight">
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-caption text-qm-text-tertiary mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 p-0.5 rounded text-qm-text-tertiary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
