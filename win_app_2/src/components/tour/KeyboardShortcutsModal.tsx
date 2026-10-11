import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShortcutsStore, KEYBOARD_SHORTCUTS, type ShortcutCategory } from '@/stores/shortcutsStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'

const CATEGORY_KEYS: Record<ShortcutCategory, string> = {
  session: 'shortcutsModal.categories.session',
  widget: 'shortcutsModal.categories.widget',
  ai: 'shortcutsModal.categories.ai',
}

export function KeyboardShortcutsModal() {
  const { t } = useTranslation('dashboard')
  const { isShortcutsModalOpen, closeShortcutsModal } = useShortcutsStore()

  // Group shortcuts by category
  const shortcutsByCategory = KEYBOARD_SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) acc[shortcut.category] = []
      acc[shortcut.category].push(shortcut)
      return acc
    },
    {} as Record<ShortcutCategory, (typeof KEYBOARD_SHORTCUTS)[number][]>,
  )

  return (
    <AnimatePresence>
      {isShortcutsModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeShortcutsModal()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-md rounded-qm-xl bg-qm-bg-primary border border-qm-border-subtle shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-qm-gradient-start/5 via-transparent to-qm-gradient-end/3 pointer-events-none" />

            <div className="relative flex items-center justify-between p-4 border-b border-qm-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-qm-gradient-start/10 to-qm-gradient-end/10 flex items-center justify-center">
                  <Keyboard size={18} className="text-qm-accent" />
                </div>
                <div>
                  <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('shortcutsModal.title')}</h2>
                  <p className="text-caption text-qm-text-tertiary">{t('shortcutsModal.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={closeShortcutsModal}
                className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative p-4 max-h-[60vh] overflow-y-auto space-y-6">
              {(Object.keys(shortcutsByCategory) as ShortcutCategory[]).map((category) => (
                <div key={category}>
                  <h3 className="text-label-sm font-semibold text-qm-text-secondary uppercase tracking-wider mb-3">
                    {t(CATEGORY_KEYS[category])}
                  </h3>
                  <div className="space-y-2">
                    {shortcutsByCategory[category].map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between p-3 rounded-qm-md bg-qm-surface-light hover:bg-qm-surface-hover transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <h4 className="text-body-sm font-medium text-qm-text-primary">{t(`shortcutsModal.items.${shortcut.id}.title`)}</h4>
                          <p className="text-caption text-qm-text-tertiary">{t(`shortcutsModal.items.${shortcut.id}.description`)}</p>
                        </div>
                        <KeyboardShortcutBadge shortcut={shortcut.shortcut} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
