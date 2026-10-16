import { create } from 'zustand'
import type { MomentRelay } from '@/types/relay'

const MOMENT_VISIBLE_MS = 8000

/** Latest proactive moment detected by the host, shown briefly in the overlay pill. */
interface MomentStoreState {
  current: MomentRelay | null
  visible: boolean
  show: (moment: MomentRelay) => void
  hide: () => void
}

let hideTimer: ReturnType<typeof setTimeout> | null = null

export const useMomentStore = create<MomentStoreState>((set) => ({
  current: null,
  visible: false,
  show: (moment) => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ current: moment, visible: true })
    hideTimer = setTimeout(() => set({ visible: false }), MOMENT_VISIBLE_MS)
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
    set({ visible: false })
  },
}))
