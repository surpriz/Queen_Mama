// Queen Mama LITE - AI Store
// Manages AI responses and streaming state

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AIResponse, AIResponseType, AIProvider, Mode } from '../types';
import { useAuthStore } from './authStore';
import { useSessionStore } from './sessionStore';
import { useSettingsStore } from './settingsStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_TRANSCRIPT_LENGTH = 8000;

interface AIStore {
  // State
  responses: AIResponse[];
  currentResponse: string;
  isProcessing: boolean;
  error: string | null;

  // Actions
  triggerAssist: (type: AIResponseType, customPrompt?: string) => Promise<void>;
  dismissResponse: (response: AIResponse) => void;
  clearResponses: () => void;
  exportToMarkdown: () => string;
  setError: (error: string | null) => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  // Initial state
  responses: [],
  currentResponse: '',
  isProcessing: false,
  error: null,

  // Trigger AI assist
  triggerAssist: async (type, customPrompt) => {
    const { isProcessing } = get();
    if (isProcessing) return;

    set({ isProcessing: true, currentResponse: '', error: null });

    try {
      const { accessToken } = useAuthStore.getState();
      const transcript = useSessionStore.getState().getFullTranscript();
      const { selectedModeId, smartModeEnabled, enableScreenCapture } = useSettingsStore.getState();

      // Truncate transcript if too long
      const truncatedTranscript = transcript.slice(-MAX_TRANSCRIPT_LENGTH);

      // Build request body
      const body: Record<string, unknown> = {
        type,
        transcript: truncatedTranscript,
        modeId: selectedModeId,
        smartMode: smartModeEnabled,
      };

      if (customPrompt) {
        body.customPrompt = customPrompt;
      }

      // TODO: Add screenshot if enabled
      // if (enableScreenCapture) {
      //   body.screenshot = await captureScreenshot();
      // }

      // Make streaming request
      const response = await fetch(`${API_BASE_URL}/api/proxy/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let provider: AIProvider = 'openai';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.provider) {
                provider = parsed.provider;
              }

              if (parsed.content) {
                fullContent += parsed.content;
                set({ currentResponse: fullContent });
              }

              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      // Create response object
      const aiResponse: AIResponse = {
        id: uuidv4(),
        type,
        content: fullContent,
        timestamp: new Date().toISOString(),
        provider,
        isAutomatic: false,
      };

      // Add to responses (newest first)
      set((state) => ({
        responses: [aiResponse, ...state.responses],
        currentResponse: '',
        isProcessing: false,
      }));

      console.log('[AI] Response complete:', type, provider);
    } catch (error) {
      console.error('[AI] Request failed:', error);
      set({
        isProcessing: false,
        currentResponse: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Dismiss a response
  dismissResponse: (response) => {
    set((state) => ({
      responses: state.responses.filter((r) => r.id !== response.id),
    }));
  },

  // Clear all responses
  clearResponses: () => {
    set({ responses: [], currentResponse: '' });
    console.log('[AI] Responses cleared');
  },

  // Export responses to Markdown
  exportToMarkdown: () => {
    const { responses } = get();

    const lines = [
      '# Queen Mama AI Responses',
      `Exported: ${new Date().toLocaleString()}`,
      '',
      '---',
      '',
    ];

    for (const response of responses.slice().reverse()) {
      lines.push(`## ${response.type.toUpperCase()}`);
      lines.push(`*${new Date(response.timestamp).toLocaleString()} via ${response.provider}*`);
      lines.push('');
      lines.push(response.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  },

  // Set error
  setError: (error) => set({ error }),
}));
