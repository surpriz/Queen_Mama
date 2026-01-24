// Queen Mama LITE - AI Store
// Manages AI responses and streaming state

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AIResponse, AIResponseType, AIProvider } from '../types';
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
      const { accessToken, isAuthenticated } = useAuthStore.getState();
      console.log('[AI] Auth state - isAuthenticated:', isAuthenticated, 'accessToken:', accessToken ? `${accessToken.slice(0, 20)}...` : 'NULL');

      if (!accessToken) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const transcript = useSessionStore.getState().getFullTranscript();
      const { smartModeEnabled } = useSettingsStore.getState();

      // Truncate transcript if too long
      const truncatedTranscript = transcript.slice(-MAX_TRANSCRIPT_LENGTH);

      // Build system prompt based on response type
      const systemPrompts: Record<AIResponseType, string> = {
        assist: `You are Queen Mama, an AI coaching assistant. Analyze the conversation transcript and provide helpful, actionable advice. Be concise and professional. Respond in the same language as the transcript.`,
        whatToSay: `You are a communication coach. Based on the conversation, suggest what the user should say next. Provide 2-3 options with different tones (professional, friendly, assertive). Respond in the same language as the transcript.`,
        followUp: `You are a conversation analyst. Based on the transcript, suggest 3-5 follow-up questions the user could ask to deepen the conversation or clarify important points. Respond in the same language as the transcript.`,
        recap: `You are a meeting summarizer. Provide a concise summary of the conversation including: key topics discussed, decisions made, action items, and next steps. Respond in the same language as the transcript.`,
        custom: customPrompt || 'Analyze the following conversation and provide helpful insights.',
      };

      const systemPrompt = systemPrompts[type];
      const userMessage = truncatedTranscript || 'No transcript available yet.';

      // Build request body matching backend AIStreamRequestBody interface
      const body: Record<string, unknown> = {
        systemPrompt,
        userMessage,
        smartMode: smartModeEnabled,
      };

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
