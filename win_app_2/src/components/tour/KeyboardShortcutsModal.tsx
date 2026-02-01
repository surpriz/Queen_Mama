import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { useShortcutsStore, KEYBOARD_SHORTCUTS, SHORTCUT_CATEGORIES, type ShortcutCategory } from '@/stores/shortcutsStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'

export function KeyboardShortcutsModal() {
  const { isShortcutsModalOpen, closeShortcutsModal } = useShortcutsStore()

  // Group shortcuts by category
  const shortcutsByCategory = KEYBOARD_SHORTCUTS.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<ShortcutCategory, typeof KEYBOARD_SHORTCUTS[number][]>)

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
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-qm-gradient-start/5 via-transparent to-qm-gradient-end/3 pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-qm-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-qm-gradient-start/10 to-qm-gradient-end/10 flex items-center justify-center">
                  <Keyboard size={18} className="text-qm-accent" />
                </div>
                <div>
                  <h2 className="text-title-sm font-semibold text-qm-text-primary">Keyboard Shortcuts</h2>
                  <p className="text-caption text-qm-text-tertiary">Quick reference guide</p>
                </div>
              </div>
              <button
                onClick={closeShortcutsModal}
                className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="relative p-4 max-h-[60vh] overflow-y-auto space-y-6">
              {(Object.keys(shortcutsByCategory) as ShortcutCategory[]).map((category) => (
                <div key={category}>
                  {/* Category header */}
                  <h3 className="text-label-sm font-semibold text-qm-text-secondary uppercase tracking-wider mb-3">
                    {SHORTCUT_CATEGORIES[category]}
                  </h3>

                  {/* Shortcuts list */}
                  <div className="space-y-2">
                    {shortcutsByCategory[category].map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between p-3 rounded-qm-md bg-qm-surface-light hover:bg-qm-surface-hover transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <h4 className="text-body-sm font-medium text-qm-text-primary">{shortcut.title}</h4>
                          <p className="text-caption text-qm-text-tertiary">{shortcut.description}</p>
                        </div>
                        <KeyboardShortcutBadge shortcut={shortcut.shortcut} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="relative p-4 border-t border-qm-border-subtle bg-qm-bg-secondary/50">
              <p className="text-caption text-qm-text-tertiary text-center">
                Press <KeyboardShortcutBadge shortcut="?" size="small" className="mx-1" /> anytime to show this reference
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
