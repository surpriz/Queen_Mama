import { create } from 'zustand'
import type { PreGenRelay } from '@/types/relay'

/** UI mirror of the host's pre-generated Assist buffer ("Ready" pill badge). */
interface PreGenStoreState {
  state: PreGenRelay['state']
  apply: (data: PreGenRelay) => void
}

export const usePreGenStore = create<PreGenStoreState>((set) => ({
  state: 'idle',
  apply: (data) => set({ state: data.state }),
}))
