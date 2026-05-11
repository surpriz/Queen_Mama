import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  show: (input: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string
  dismiss: (id: string) => void
  clear: () => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ variant, title, description, duration = 3000 }) => {
    const id = `t${++nextId}`
    set((s) => ({ toasts: [...s.toasts, { id, variant, title, description, duration }] }))
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/** Imperative helpers — call from anywhere, no React needed */
export const toast = {
  info: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().show({ variant: 'info', title, description, duration }),
  success: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().show({ variant: 'success', title, description, duration }),
  error: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().show({ variant: 'error', title, description, duration: duration ?? 5000 }),
  warning: (title: string, description?: string, duration?: number) =>
    useToastStore.getState().show({ variant: 'warning', title, description, duration }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}
