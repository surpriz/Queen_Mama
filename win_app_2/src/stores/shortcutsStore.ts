import { create } from 'zustand'

interface ShortcutsState {
  isShortcutsModalOpen: boolean
  openShortcutsModal: () => void
  closeShortcutsModal: () => void
  toggleShortcutsModal: () => void
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  isShortcutsModalOpen: false,

  openShortcutsModal: () => set({ isShortcutsModalOpen: true }),

  closeShortcutsModal: () => set({ isShortcutsModalOpen: false }),

  toggleShortcutsModal: () => {
    const { isShortcutsModalOpen } = get()
    set({ isShortcutsModalOpen: !isShortcutsModalOpen })
  },
}))

// Keyboard shortcut definitions
export const KEYBOARD_SHORTCUTS = [
  {
    id: 'start-stop',
    shortcut: 'Ctrl+Shift+S',
    title: 'Start/Stop Session',
    description: 'Begin or end recording and transcription (global)',
    category: 'session',
  },
  {
    id: 'toggle-widget',
    shortcut: 'Ctrl+Shift+H',
    title: 'Toggle Widget',
    description: 'Show or hide the overlay widget (global)',
    category: 'widget',
  },
  {
    id: 'clear-context',
    shortcut: 'Ctrl+Shift+R',
    title: 'Clear Context',
    description: 'Reset the conversation context and AI history (global)',
    category: 'session',
  },
  {
    id: 'run-tab',
    shortcut: 'Enter',
    title: 'Run selected tab',
    description: 'In the widget input: ask the selected tab, or send your typed question',
    category: 'ai',
  },
] as const

export type ShortcutCategory = 'session' | 'widget' | 'ai'

export const SHORTCUT_CATEGORIES: Record<ShortcutCategory, string> = {
  session: 'Session Controls',
  widget: 'Widget Controls',
  ai: 'AI Features',
}
