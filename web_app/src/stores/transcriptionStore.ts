// Queen Mama LITE - Transcription Store
// Manages Deepgram WebSocket connection and transcription state

import { create } from 'zustand';
import { useSessionStore } from './sessionStore';
import { useAuthStore } from './authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';
const KEEPALIVE_INTERVAL = 8000; // 8 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 2000; // 2 seconds

interface TranscriptionStore {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  interimText: string;

  // Internal
  socket: WebSocket | null;
  keepaliveTimer: number | null;
  reconnectAttempts: number;
  intentionalDisconnect: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  sendAudio: (data: ArrayBuffer) => void;
  setError: (error: string | null) => void;
}

export const useTranscriptionStore = create<TranscriptionStore>((set, get) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  error: null,
  interimText: '',
  socket: null,
  keepaliveTimer: null,
  reconnectAttempts: 0,
  intentionalDisconnect: false,

  // Connect to Deepgram
  connect: async () => {
    const { socket, isConnecting, isConnected } = get();
    if (socket || isConnecting || isConnected) return;

    set({ isConnecting: true, error: null, intentionalDisconnect: false });

    try {
      // Get Deepgram token from backend
      const { accessToken } = useAuthStore.getState();
      console.log('[Transcription] Using accessToken:', accessToken ? `${accessToken.slice(0, 20)}...` : 'NULL');
      const response = await fetch(`${API_BASE_URL}/api/proxy/transcription/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get transcription token');
      }

      const { token } = await response.json();

      // Build WebSocket URL with params
      const params = new URLSearchParams({
        model: 'nova-3',
        language: 'multi',
        sample_rate: '16000',
        encoding: 'linear16',
        channels: '1',
        punctuate: 'true',
        interim_results: 'true',
        smart_format: 'true',
      });

      const ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params}`, ['token', token]);

      ws.onopen = () => {
        console.log('[Transcription] WebSocket connected');
        set({ isConnected: true, isConnecting: false, reconnectAttempts: 0 });

        // Start keepalive
        const timer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, KEEPALIVE_INTERVAL);

        set({ keepaliveTimer: timer });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
            const transcript = data.channel.alternatives[0].transcript;
            const isFinal = data.is_final;

            if (transcript) {
              if (isFinal) {
                // Final result - add to session
                useSessionStore.getState().addTranscript(transcript, true);
                set({ interimText: '' });
              } else {
                // Interim result - update display
                set({ interimText: transcript });
              }
            }
          }
        } catch (error) {
          console.error('[Transcription] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Transcription] WebSocket error:', error);
        set({ error: 'Connection error' });
      };

      ws.onclose = (event) => {
        console.log('[Transcription] WebSocket closed:', event.code, event.reason);

        // Clear keepalive
        const { keepaliveTimer } = get();
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
        }

        set({
          isConnected: false,
          isConnecting: false,
          socket: null,
          keepaliveTimer: null,
        });

        // Attempt reconnection if not intentional
        const { intentionalDisconnect, reconnectAttempts } = get();
        if (!intentionalDisconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_DELAY * (reconnectAttempts + 1);
          console.log(`[Transcription] Reconnecting in ${delay}ms...`);
          set({ reconnectAttempts: reconnectAttempts + 1 });

          setTimeout(() => {
            if (!get().intentionalDisconnect) {
              get().connect();
            }
          }, delay);
        }
      };

      set({ socket: ws });
    } catch (error) {
      console.error('[Transcription] Failed to connect:', error);
      set({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Disconnect from Deepgram
  disconnect: () => {
    const { socket, keepaliveTimer } = get();

    set({ intentionalDisconnect: true });

    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
    }

    if (socket) {
      socket.close();
    }

    set({
      socket: null,
      keepaliveTimer: null,
      isConnected: false,
      isConnecting: false,
      interimText: '',
    });

    console.log('[Transcription] Disconnected');
  },

  // Send audio data
  sendAudio: (data) => {
    const { socket, isConnected } = get();
    if (socket && isConnected && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  },

  // Set error
  setError: (error) => set({ error }),
}));
