import { create } from 'zustand'

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdaterState {
  status: UpdaterStatus
  version: string | null
  percent: number
  errorMessage: string | null
  dismissedForSession: boolean
  setStatus: (status: UpdaterStatus) => void
  setAvailable: (version: string | null) => void
  setProgress: (percent: number) => void
  setDownloaded: (version: string | null) => void
  setError: (message: string) => void
  dismissBanner: () => void
  reset: () => void
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  status: 'idle',
  version: null,
  percent: 0,
  errorMessage: null,
  dismissedForSession: false,
  setStatus: (status) => set({ status }),
  setAvailable: (version) =>
    set({ status: 'downloading', version, percent: 0, errorMessage: null }),
  setProgress: (percent) => set({ percent, status: 'downloading' }),
  setDownloaded: (version) =>
    set({ status: 'downloaded', version, percent: 100, dismissedForSession: false }),
  setError: (errorMessage) => set({ status: 'error', errorMessage }),
  dismissBanner: () => set({ dismissedForSession: true }),
  reset: () => set({ status: 'idle', version: null, percent: 0, errorMessage: null }),
}))
