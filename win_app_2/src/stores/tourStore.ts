import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TourState {
  // Tour visibility
  isTourOpen: boolean
  currentPage: number
  totalPages: number

  // Tour completion tracking
  hasCompletedTour: boolean

  // Actions
  openTour: () => void
  closeTour: () => void
  nextPage: () => void
  previousPage: () => void
  goToPage: (page: number) => void
  completeTour: () => void
  resetTour: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      // Initial state
      isTourOpen: false,
      currentPage: 0,
      totalPages: 5,
      hasCompletedTour: false,

      // Actions
      openTour: () => set({ isTourOpen: true, currentPage: 0 }),

      closeTour: () => set({ isTourOpen: false }),

      nextPage: () => {
        const { currentPage, totalPages } = get()
        if (currentPage < totalPages - 1) {
          set({ currentPage: currentPage + 1 })
        }
      },

      previousPage: () => {
        const { currentPage } = get()
        if (currentPage > 0) {
          set({ currentPage: currentPage - 1 })
        }
      },

      goToPage: (page: number) => {
        const { totalPages } = get()
        if (page >= 0 && page < totalPages) {
          set({ currentPage: page })
        }
      },

      completeTour: () => set({ hasCompletedTour: true, isTourOpen: false }),

      resetTour: () => set({ hasCompletedTour: false, currentPage: 0 }),
    }),
    {
      name: 'qm-tour-storage',
      partialize: (state) => ({
        hasCompletedTour: state.hasCompletedTour,
      }),
    }
  )
)
