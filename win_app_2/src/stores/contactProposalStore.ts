import { create } from 'zustand'
import type { ContactProposalRelay } from '@/types/relay'

/** Pending contact proposal (from post-session extraction) shown by the dashboard sheet. */
interface ContactProposalState {
  proposal: ContactProposalRelay | null
  propose: (proposal: ContactProposalRelay) => void
  clear: () => void
}

export const useContactProposalStore = create<ContactProposalState>((set) => ({
  proposal: null,
  propose: (proposal) => set({ proposal }),
  clear: () => set({ proposal: null }),
}))
