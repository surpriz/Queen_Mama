// Queen Mama LITE - Proxy API Service
// Handles proxy endpoints for AI and transcription

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ProxyConfig {
  deepgramEnabled: boolean;
  aiStreamingEnabled: boolean;
  availableProviders: string[];
  maxTranscriptLength: number;
  maxImageSize: number;
}

export interface AIStreamRequest {
  type: 'assist' | 'whatToSay' | 'followUp' | 'recap' | 'custom';
  transcript: string;
  modeId?: string;
  smartMode?: boolean;
  customPrompt?: string;
  screenshot?: string; // Base64 encoded
}

// Get proxy configuration
export async function getProxyConfig(accessToken: string): Promise<ProxyConfig> {
  const response = await fetch(`${API_BASE_URL}/api/proxy/config`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get proxy config');
  }

  return response.json();
}

// Get Deepgram transcription token
export async function getTranscriptionToken(
  accessToken: string
): Promise<{ token: string }> {
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

  return response.json();
}

// Stream AI response
export async function streamAIResponse(
  accessToken: string,
  request: AIStreamRequest,
  onChunk: (chunk: { content?: string; provider?: string; error?: string }) => void,
  onDone: () => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/proxy/ai/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'AI request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            onChunk(parsed);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone();
}

// Sync sessions
export async function syncSessions(
  accessToken: string,
  sessions: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime?: string;
    duration?: number;
  }>
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ sessions }),
  });

  if (!response.ok) {
    throw new Error('Session sync failed');
  }
}

export default {
  getProxyConfig,
  getTranscriptionToken,
  streamAIResponse,
  syncSessions,
};
