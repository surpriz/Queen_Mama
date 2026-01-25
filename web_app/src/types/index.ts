// Queen Mama LITE - TypeScript Types

// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
}

export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

// Session Types
export interface Session {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  transcriptCount: number;
  aiResponseCount: number;
  isActive: boolean;
  summary?: string;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  content: string;
  timestamp: string;
  isFinal: boolean;
  speaker?: string;
}

// AI Types
export type AIResponseType = 'assist' | 'whatToSay' | 'followUp' | 'recap' | 'custom';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIResponse {
  id: string;
  type: AIResponseType;
  content: string;
  timestamp: string;
  provider: AIProvider;
  isAutomatic: boolean;
  isStreaming?: boolean;
  hasScreenshot?: boolean;
}

// Mode Types
export interface Mode {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isDefault: boolean;
}

export const DEFAULT_MODES: Mode[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'General-purpose assistance',
    systemPrompt: 'You are a helpful AI assistant. Provide clear, concise responses. Always respond in the SAME LANGUAGE as the transcript.',
    isDefault: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal business communication',
    systemPrompt: 'You are a professional business advisor. Use formal language and focus on actionable insights. Always respond in the SAME LANGUAGE as the transcript.',
    isDefault: false,
  },
  {
    id: 'interview',
    name: 'Interview',
    description: 'Job interview coaching',
    systemPrompt: 'You are an interview coach. Help with answering questions, highlighting achievements, and providing thoughtful responses. Always respond in the SAME LANGUAGE as the transcript.',
    isDefault: false,
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Sales conversation assistance',
    systemPrompt: 'You are a sales coach. Help identify opportunities, handle objections, and close deals. Always respond in the SAME LANGUAGE as the transcript.',
    isDefault: false,
  },
];

// Settings Types
export interface Settings {
  enableScreenCapture: boolean;
  smartModeEnabled: boolean;
  autoAnswerEnabled: boolean;
  selectedModeId: string;
  overlayPosition: OverlayPosition;
  autoStartOnLaunch: boolean;
  language: string;
}

export type OverlayPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

// Audio Types
export interface AudioLevel {
  rms: number;
  peak: number;
  timestamp: number;
}

// Proxy Config Types
export interface ProxyConfig {
  deepgramEnabled: boolean;
  aiStreamingEnabled: boolean;
  availableProviders: AIProvider[];
  maxTranscriptLength: number;
  maxImageSize: number;
}

// Event Types
export type ShortcutAction = 'toggle_overlay' | 'trigger_assist' | 'toggle_session' | 'clear_context';
export type TrayAction = 'start_session' | 'stop_session' | 'feedback';

// Tab Types
export type TabItem = 'assist' | 'whatToSay' | 'followUp' | 'recap';

export const TAB_ITEMS: { id: TabItem; label: string; shortLabel: string; icon: string }[] = [
  { id: 'assist', label: 'Assist', shortLabel: 'Assist', icon: 'sparkles' },
  { id: 'whatToSay', label: 'What to say', shortLabel: 'Say', icon: 'message-circle' },
  { id: 'followUp', label: 'Follow-up', shortLabel: 'Ask', icon: 'help-circle' },
  { id: 'recap', label: 'Recap', shortLabel: 'Recap', icon: 'rotate-ccw' },
];
