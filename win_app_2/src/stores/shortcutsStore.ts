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
    description: 'Begin or end recording and transcription',
    category: 'session',
  },
  {
    id: 'toggle-widget',
    shortcut: 'Ctrl+\\',
    title: 'Toggle Widget',
    description: 'Show or hide the overlay widget',
    category: 'widget',
  },
  {
    id: 'trigger-assist',
    shortcut: 'Ctrl+Enter',
    title: 'Ask AI',
    description: 'Get AI assistance based on current context',
    category: 'ai',
  },
  {
    id: 'clear-context',
    shortcut: 'Ctrl+R',
    title: 'Clear Context',
    description: 'Reset transcript and start fresh',
    category: 'session',
  },
  {
    id: 'move-widget-up',
    shortcut: 'Ctrl+↑',
    title: 'Move Widget Up',
    description: 'Move the widget up on screen',
    category: 'widget',
  },
  {
    id: 'move-widget-down',
    shortcut: 'Ctrl+↓',
    title: 'Move Widget Down',
    description: 'Move the widget down on screen',
    category: 'widget',
  },
  {
    id: 'move-widget-left',
    shortcut: 'Ctrl+←',
    title: 'Move Widget Left',
    description: 'Move the widget left on screen',
    category: 'widget',
  },
  {
    id: 'move-widget-right',
    shortcut: 'Ctrl+→',
    title: 'Move Widget Right',
    description: 'Move the widget right on screen',
    category: 'widget',
  },
  {
    id: 'screenshot',
    shortcut: 'Ctrl+Shift+C',
    title: 'Screen Capture',
    description: 'Capture screenshot for AI context',
    category: 'ai',
  },
] as const

export type ShortcutCategory = 'session' | 'widget' | 'ai'

export const SHORTCUT_CATEGORIES: Record<ShortcutCategory, string> = {
  session: 'Session Controls',
  widget: 'Widget Controls',
  ai: 'AI Features',
}
