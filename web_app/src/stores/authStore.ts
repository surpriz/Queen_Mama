// Queen Mama LITE - Authentication Store
// Manages user authentication state and device code flow

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LazyStore } from '@tauri-apps/plugin-store';
import { platform as getPlatform, hostname } from '@tauri-apps/plugin-os';
import { v4 as uuidv4 } from 'uuid';
import type { User, DeviceCodeResponse, AuthState } from '../types';

// API base URL - configurable for dev/prod
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Tauri store for persistent auth data
let tauriStore: LazyStore | null = null;

const getStore = async () => {
  if (!tauriStore) {
    tauriStore = new LazyStore('auth.json');
  }
  return tauriStore;
};

// Generate or retrieve persistent device ID
const getDeviceId = async (): Promise<string> => {
  const store = await getStore();
  let deviceId = await store.get<string>('deviceId');
  if (!deviceId) {
    deviceId = uuidv4();
    await store.set('deviceId', deviceId);
  }
  return deviceId;
};

interface AuthStore extends AuthState {
  // Device code flow
  deviceCode: DeviceCodeResponse | null;
  pollInterval: number | null;

  // Actions
  initialize: () => Promise<void>;
  startDeviceCodeFlow: () => Promise<DeviceCodeResponse>;
  pollDeviceAuthorization: () => Promise<boolean>;
  cancelDeviceCodeFlow: () => void;
  refreshAccessToken: () => Promise<boolean>;
  logout: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      deviceCode: null,
      pollInterval: null,

      // Initialize auth from stored tokens
      initialize: async () => {
        set({ isLoading: true });
        try {
          const store = await getStore();
          const accessToken = await store.get<string>('accessToken');
          const refreshToken = await store.get<string>('refreshToken');
          const user = await store.get<User>('user');

          if (accessToken && refreshToken && user) {
            // Set tokens temporarily for refresh to work
            set({
              accessToken,
              refreshToken,
              user,
            });

            // Await token refresh before marking as authenticated
            console.log('[Auth] Refreshing access token...');
            const refreshed = await get().refreshAccessToken();

            if (refreshed) {
              console.log('[Auth] Token refresh successful');
              set({
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              // Refresh failed, clear tokens and require re-login
              console.log('[Auth] Token refresh failed, requiring re-login');
              await get().logout();
              set({ isLoading: false });
            }
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('[Auth] Failed to initialize:', error);
          set({ isLoading: false, error: 'Failed to initialize authentication' });
        }
      },

      // Start device code flow
      startDeviceCodeFlow: async () => {
        set({ isLoading: true, error: null });
        try {
          // Get device identification
          const deviceId = await getDeviceId();
          const platformName = await getPlatform();
          let deviceName = 'Queen Mama LITE';
          try {
            deviceName = await hostname() || 'Queen Mama LITE';
          } catch {
            // hostname may not be available on all platforms
          }

          const response = await fetch(`${API_BASE_URL}/api/auth/device/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId,
              deviceName,
              platform: platformName,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to initiate device code flow');
          }

          const data: DeviceCodeResponse = await response.json();
          set({ deviceCode: data, isLoading: false });
          return data;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      // Poll for device authorization
      pollDeviceAuthorization: async () => {
        const { deviceCode } = get();
        if (!deviceCode) return false;

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/device/poll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceCode: deviceCode.deviceCode }),
          });

          if (response.status === 202) {
            // Still pending
            return false;
          }

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Authorization failed');
          }

          const data = await response.json();
          const store = await getStore();

          console.log('[Auth] Poll success, got accessToken:', data.accessToken?.slice(0, 20) + '...');

          // Save tokens
          await store.set('accessToken', data.accessToken);
          await store.set('refreshToken', data.refreshToken);
          await store.set('user', data.user);

          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user: data.user,
            isAuthenticated: true,
            deviceCode: null,
            error: null,
          });

          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          set({ error: message });
          return false;
        }
      },

      // Cancel device code flow
      cancelDeviceCodeFlow: () => {
        set({ deviceCode: null, isLoading: false, error: null });
      },

      // Refresh access token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/macos/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            // Token invalid, logout
            get().logout();
            return false;
          }

          const data = await response.json();
          const store = await getStore();

          await store.set('accessToken', data.accessToken);
          if (data.refreshToken) {
            await store.set('refreshToken', data.refreshToken);
          }

          console.log('[Auth] Token refreshed successfully:', data.accessToken?.slice(0, 20) + '...');
          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
          });

          return true;
        } catch (error) {
          console.error('[Auth] Failed to refresh token:', error);
          return false;
        }
      },

      // Logout
      logout: async () => {
        try {
          const store = await getStore();
          await store.delete('accessToken');
          await store.delete('refreshToken');
          await store.delete('user');
        } catch (error) {
          console.error('[Auth] Failed to clear store:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          deviceCode: null,
          error: null,
        });
      },

      // Set error
      setError: (error) => set({ error }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist minimal state in localStorage as backup
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
