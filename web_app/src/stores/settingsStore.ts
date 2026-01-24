// Queen Mama LITE - Settings Store
// Manages application settings with persistence

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Settings, OverlayPosition, Mode } from '../types';
import { DEFAULT_MODES } from '../types';

interface SettingsStore extends Settings {
  // Modes
  modes: Mode[];

  // Actions
  setEnableScreenCapture: (enabled: boolean) => void;
  setSmartModeEnabled: (enabled: boolean) => void;
  setAutoAnswerEnabled: (enabled: boolean) => void;
  setSelectedMode: (modeId: string) => void;
  setOverlayPosition: (position: OverlayPosition) => void;
  setAutoStartOnLaunch: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  addCustomMode: (mode: Mode) => void;
  removeMode: (modeId: string) => void;
  resetToDefaults: () => void;
  getSelectedMode: () => Mode | undefined;
}

const DEFAULT_SETTINGS: Settings = {
  enableScreenCapture: true,
  smartModeEnabled: false,
  autoAnswerEnabled: false,
  selectedModeId: 'default',
  overlayPosition: 'topRight',
  autoStartOnLaunch: false,
  language: 'auto',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_SETTINGS,
      modes: DEFAULT_MODES,

      // Settings actions
      setEnableScreenCapture: (enabled) => set({ enableScreenCapture: enabled }),
      setSmartModeEnabled: (enabled) => set({ smartModeEnabled: enabled }),
      setAutoAnswerEnabled: (enabled) => set({ autoAnswerEnabled: enabled }),
      setSelectedMode: (modeId) => set({ selectedModeId: modeId }),
      setOverlayPosition: (position) => set({ overlayPosition: position }),
      setAutoStartOnLaunch: (enabled) => set({ autoStartOnLaunch: enabled }),
      setLanguage: (language) => set({ language }),

      // Mode management
      addCustomMode: (mode) =>
        set((state) => ({
          modes: [...state.modes, mode],
        })),

      removeMode: (modeId) =>
        set((state) => ({
          modes: state.modes.filter((m) => m.id !== modeId),
          // Reset to default if removing selected mode
          selectedModeId: state.selectedModeId === modeId ? 'default' : state.selectedModeId,
        })),

      // Reset all settings
      resetToDefaults: () =>
        set({
          ...DEFAULT_SETTINGS,
          modes: DEFAULT_MODES,
        }),

      // Get currently selected mode
      getSelectedMode: () => {
        const { modes, selectedModeId } = get();
        return modes.find((m) => m.id === selectedModeId);
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
