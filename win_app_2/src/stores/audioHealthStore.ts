import { create } from 'zustand'
import type { AudioHealthRelay } from '@/types/relay'

/**
 * UI mirror of the host's audio health: which sources are live. Drives the
 * "Mic only" / "No mic" pill badges (mac `SystemAudioHealthBadge` parity).
 */
interface AudioHealthState extends AudioHealthRelay {
  apply: (data: AudioHealthRelay) => void
}

export const useAudioHealthStore = create<AudioHealthState>((set) => ({
  micAvailable: true,
  systemAudioAvailable: true,
  systemAudioReceiving: true,
  apply: (data) => set({ ...data }),
}))
