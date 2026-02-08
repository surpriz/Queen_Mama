// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "enterprise";

export interface FeatureStep {
  action: string;
  result: string;
}

export interface KeyboardShortcutDef {
  keys: string;
  label: string;
  context?: string;
}

export interface Feature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  whatItIs: string;
  howToUse: FeatureStep[];
  whatHappens: string;
  whyValuable: string;
  shortcuts: KeyboardShortcutDef[];
  planRequired: PlanTier;
  icon: string;
  accentColor: string;
  subTypes?: { id: string; label: string; description: string; steps: FeatureStep[] }[];
}

export interface FeatureCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
  features: Feature[];
}

// ─── Feature Data ────────────────────────────────────────────────────────────

const coreFeatures: Feature[] = [
  {
    id: "session-recording",
    title: "Session Recording",
    subtitle: "Capture every word, identify every speaker",
    description:
      "Real-time audio transcription with speaker detection that turns any conversation into a searchable, actionable transcript.",
    whatItIs:
      "A live transcription engine that captures both your microphone and system audio, identifies different speakers, and displays a scrolling real-time transcript.",
    howToUse: [
      { action: "Press Cmd+Shift+S or click the Record button", result: "Recording starts — microphone and system audio are captured" },
      { action: "Speak naturally during your conversation", result: "Live transcript appears with speaker labels and timestamps" },
      { action: "Press Cmd+Shift+S again to stop", result: "Session is saved with full transcript, summary, and action items" },
      { action: "Click the transcript to copy or export", result: "Full conversation text copied to clipboard" },
    ],
    whatHappens:
      "Audio is transcribed in real-time using state-of-the-art speech recognition. Speaker diarization distinguishes between participants. The transcript scrolls live as people speak.",
    whyValuable:
      "Never miss a detail in meetings, interviews, or sales calls. Searchable transcripts let you find exactly what was said, while AI-generated summaries and action items save hours of note-taking.",
    shortcuts: [
      { keys: "cmd+shift+s", label: "Start/Stop Recording", context: "Global" },
    ],
    planRequired: "free",
    icon: "🎙️",
    accentColor: "var(--qm-purple)",
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    subtitle: "Five response types for every situation",
    description:
      "Context-aware AI that understands your conversation and provides real-time coaching through multiple response modes.",
    whatItIs:
      "An AI assistant with five specialized response types that analyzes your live transcript and provides tailored help — from quick answers to full conversation recaps.",
    howToUse: [
      { action: "During a recording, press Cmd+Enter or click Assist", result: "AI analyzes the conversation context and provides relevant guidance" },
      { action: 'Select a response type from the overlay', result: "AI adapts its response style to match your need" },
    ],
    whatHappens:
      "The AI reads your transcript, understands the conversation flow, and generates a response tailored to the selected mode. Responses appear in the overlay widget.",
    whyValuable:
      "Like having a brilliant advisor whispering in your ear during every conversation. Get instant, context-aware help without leaving your meeting.",
    shortcuts: [
      { keys: "cmd+enter", label: "Request AI Assist", context: "During recording" },
    ],
    planRequired: "free",
    icon: "🤖",
    accentColor: "var(--qm-blue)",
    subTypes: [
      {
        id: "assist",
        label: "Assist",
        description: "General-purpose help based on conversation context",
        steps: [
          { action: "Press Cmd+Enter", result: "AI provides contextual guidance based on the full conversation" },
        ],
      },
      {
        id: "what-should-i-say",
        label: "What Should I Say?",
        description: "Suggests exactly what to say next",
        steps: [
          { action: 'Click "What should I say?"', result: "AI drafts a response you can use verbatim or adapt" },
        ],
      },
      {
        id: "follow-up",
        label: "Follow-up Questions",
        description: "Generates smart follow-up questions",
        steps: [
          { action: 'Click "Follow-up questions"', result: "AI suggests 3-5 insightful questions to deepen the conversation" },
        ],
      },
      {
        id: "recap",
        label: "Recap",
        description: "Summarizes the conversation so far",
        steps: [
          { action: 'Click "Recap"', result: "AI provides a structured summary of key points discussed" },
        ],
      },
      {
        id: "custom",
        label: "Custom",
        description: "Ask the AI anything about the conversation",
        steps: [
          { action: "Type a custom prompt and press Enter", result: "AI responds to your specific question with conversation context" },
        ],
      },
    ],
  },
  {
    id: "overlay-widget",
    title: "Overlay Widget",
    subtitle: "Your invisible coaching dashboard",
    description:
      "A floating, always-on-top widget that keeps AI assistance accessible without switching windows.",
    whatItIs:
      "A compact, draggable overlay window with three tabs — Assist, Talk Time, and History — that floats above your other applications during sessions.",
    howToUse: [
      { action: "Press Cmd+\\ to toggle the overlay", result: "Widget appears floating above your current window" },
      { action: "Drag the widget to reposition it", result: "Widget stays where you place it, always on top" },
      { action: "Switch between Assist, Talk Time, and History tabs", result: "Each tab shows different real-time information" },
      { action: "Use Cmd+Arrow keys to snap position", result: "Widget moves to screen edges for quick repositioning" },
    ],
    whatHappens:
      "The overlay provides a persistent HUD during conversations. The Assist tab shows AI responses, Talk Time tracks speaker balance, and History stores previous responses for review.",
    whyValuable:
      "Stay in your meeting app while getting AI coaching. No window switching, no context loss — the information you need is always one glance away.",
    shortcuts: [
      { keys: "cmd+\\", label: "Toggle Overlay", context: "Global" },
      { keys: "cmd+up", label: "Move Up", context: "Overlay visible" },
      { keys: "cmd+down", label: "Move Down", context: "Overlay visible" },
      { keys: "cmd+left", label: "Move Left", context: "Overlay visible" },
      { keys: "cmd+right", label: "Move Right", context: "Overlay visible" },
    ],
    planRequired: "free",
    icon: "🪟",
    accentColor: "var(--qm-accent)",
  },
];

const intelligenceFeatures: Feature[] = [
  {
    id: "smart-mode",
    title: "Smart Mode",
    subtitle: "Enhanced reasoning for complex situations",
    description:
      "Unlock advanced AI reasoning that provides deeper analysis and more nuanced responses.",
    whatItIs:
      "A toggle that activates enhanced AI reasoning, providing more thoughtful, detailed, and strategically aware responses during your conversations.",
    howToUse: [
      { action: 'Toggle "Smart Mode" in the session controls', result: "AI switches to enhanced reasoning model" },
      { action: "Continue your conversation normally", result: "Responses become more detailed and strategically nuanced" },
    ],
    whatHappens:
      "The AI uses a more powerful reasoning engine that takes more context into account, considers multiple angles, and provides more sophisticated guidance.",
    whyValuable:
      "For high-stakes conversations — investor pitches, executive negotiations, technical interviews — Smart Mode provides the depth of analysis that can make the difference.",
    shortcuts: [],
    planRequired: "pro",
    icon: "🧠",
    accentColor: "#3B82F6",
  },
  {
    id: "conversation-modes",
    title: "Conversation Modes",
    subtitle: "AI personality tailored to your context",
    description:
      "Pre-built and custom conversation modes that shape how the AI responds to match your situation.",
    whatItIs:
      "A set of contextual presets — Default, Professional, Interview, Sales, Developer Exam — plus custom modes with file attachments that tune the AI's behavior and vocabulary.",
    howToUse: [
      { action: "Open the Modes selector before or during a session", result: "Available modes are displayed with descriptions" },
      { action: "Select a pre-built mode (e.g., Sales, Interview)", result: "AI adapts its tone, vocabulary, and coaching style" },
      { action: "Create a custom mode with instructions and file attachments", result: "AI uses your documents as additional context" },
    ],
    whatHappens:
      "The selected mode shapes the AI's system prompt, adjusting how it interprets the conversation and what kind of responses it provides. File attachments are ingested as reference material.",
    whyValuable:
      "A sales call needs different coaching than a technical interview. Modes ensure the AI speaks your language and focuses on what matters for each situation.",
    shortcuts: [],
    planRequired: "free",
    icon: "🎭",
    accentColor: "#8B5CF6",
  },
  {
    id: "screen-capture",
    title: "Screen Capture",
    subtitle: "Give your AI eyes on your screen",
    description:
      "Share visual context with the AI so it can see what you see and provide more relevant assistance.",
    whatItIs:
      "A screenshot capture feature that sends visual context to the AI. Smart filtering skips video-call faces and detects empty screens to avoid unnecessary captures.",
    howToUse: [
      { action: "Press Cmd+Shift+K during a recording", result: "A screenshot is captured and sent to the AI" },
      { action: "The AI analyzes the visual context", result: "Responses incorporate what's visible on screen" },
    ],
    whatHappens:
      "The screenshot is analyzed by the AI alongside the conversation transcript. Smart filtering avoids capturing just video-call participant faces or empty screens.",
    whyValuable:
      "When someone shares their screen in a meeting, or you're looking at a document together, the AI can now reference what you're both seeing — making its advice far more specific.",
    shortcuts: [
      { keys: "cmd+shift+k", label: "Capture Screen", context: "During recording" },
    ],
    planRequired: "free",
    icon: "📸",
    accentColor: "#06B6D4",
  },
];

const automationFeatures: Feature[] = [
  {
    id: "auto-answer",
    title: "Auto-Answer",
    subtitle: "AI that jumps in when you need it",
    description:
      "Automatic AI responses triggered by silence, detected questions, or hesitation patterns.",
    whatItIs:
      "An automation layer that monitors the conversation for signals — a 2.5-second silence, a direct question, or hesitation patterns — and automatically triggers an AI response.",
    howToUse: [
      { action: "Enable Auto-Answer in session settings", result: "AI begins monitoring conversation patterns" },
      { action: "Continue your conversation naturally", result: "AI automatically responds when it detects you need help" },
      { action: "Adjust cooldown and sensitivity settings", result: "Fine-tune how often and when AI intervenes" },
    ],
    whatHappens:
      "The system analyzes conversation dynamics in real-time. When it detects silence after a question, a direct query, or hesitation patterns, it automatically generates a relevant response.",
    whyValuable:
      "No more fumbling for the assist button when you're caught off-guard. Auto-Answer ensures you always have backup, especially during rapid-fire Q&A sessions.",
    shortcuts: [],
    planRequired: "pro",
    icon: "⚡",
    accentColor: "#F97316",
  },
  {
    id: "proactive-suggestions",
    title: "Proactive Suggestions",
    subtitle: "AI that anticipates before you ask",
    description:
      "Enterprise-grade conversation intelligence that detects objections, expertise questions, hesitation, and closing opportunities.",
    whatItIs:
      "An advanced analysis layer that identifies conversation moments — objections being raised, expertise being questioned, hesitation patterns, and closing opportunities — and proactively suggests timely interventions.",
    howToUse: [
      { action: "Enable Proactive Mode in Enterprise settings", result: "AI begins deep conversation analysis" },
      { action: "Adjust sensitivity for each detection type", result: "Control which moments trigger suggestions" },
      { action: "Review suggestions as they appear in the overlay", result: "Use or dismiss each suggestion as needed" },
    ],
    whatHappens:
      "The AI continuously analyzes conversation tone, content, and patterns. When it identifies a critical moment, it generates a contextual suggestion with recommended actions.",
    whyValuable:
      "The best salespeople and negotiators anticipate objections. Proactive Mode gives everyone that sixth sense, surfacing the right response at the right moment.",
    shortcuts: [],
    planRequired: "enterprise",
    icon: "🔮",
    accentColor: "#EC4899",
  },
];

const relationshipFeatures: Feature[] = [
  {
    id: "memory-palace",
    title: "Memory Palace",
    subtitle: "Your AI-powered mini-CRM",
    description:
      "Automatic contact extraction, relationship tracking, and pre-meeting briefings from your conversations.",
    whatItIs:
      "A contact management system that automatically extracts people mentioned in your transcripts, builds relationship profiles with conversation history, and syncs across devices.",
    howToUse: [
      { action: "Record sessions as usual — contacts are extracted automatically", result: "New contacts appear in your Memory Palace with extracted details" },
      { action: "Open the Contacts tab to browse your network", result: "See all contacts with last-seen dates and session links" },
      { action: "Add notes to any contact for personal context", result: "Notes are synced and included in future AI briefings" },
      { action: "Start a new session — AI briefs you on known participants", result: "AI uses the last 3 sessions and notes for each contact" },
    ],
    whatHappens:
      "After each session, the AI scans the transcript for contact information (names, roles, companies) with a confidence threshold. Contacts are created or updated, linked to sessions, and enriched over time.",
    whyValuable:
      "Never walk into a meeting unprepared. Memory Palace ensures you remember every detail about the people you talk to, building stronger professional relationships automatically.",
    shortcuts: [],
    planRequired: "pro",
    icon: "🏛️",
    accentColor: "#10B981",
  },
  {
    id: "talk-time",
    title: "Talk Time Analytics",
    subtitle: "Know when to listen, know when to speak",
    description:
      "Real-time speaker balance tracking that helps you maintain effective conversation dynamics.",
    whatItIs:
      "A live analytics panel in the overlay widget that tracks speaking time percentages for each participant, with color-coded health indicators.",
    howToUse: [
      { action: "Switch to the Talk Time tab in the overlay widget", result: "Live speaker balance bars appear" },
      { action: "Monitor the percentage indicators during conversation", result: "Colors indicate balance: green (40-60%), orange (30-70%), red (outside 30-70%)" },
    ],
    whatHappens:
      "Speaker diarization data feeds into real-time percentage calculations. Visual indicators update continuously, showing each participant's share of the conversation.",
    whyValuable:
      "Research shows the best conversations have balanced participation. Talk Time ensures you're not dominating or being sidelined — especially critical in sales and interviews.",
    shortcuts: [],
    planRequired: "free",
    icon: "📊",
    accentColor: "#14B8A6",
  },
];

const powerUserFeatures: Feature[] = [
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    subtitle: "Control everything without leaving your flow",
    description:
      "Nine global keyboard shortcuts that let you control Queen Mama without switching windows or clicking buttons.",
    whatItIs:
      "A comprehensive set of global keyboard shortcuts that work from any application, giving you instant control over recording, AI assistance, overlay positioning, and context management.",
    howToUse: [
      { action: "Learn the core shortcuts: Cmd+Shift+S (record), Cmd+Enter (assist), Cmd+\\\\ (overlay)", result: "Master the three most-used actions" },
      { action: "Use Cmd+R to clear context when switching topics", result: "AI starts fresh without previous conversation confusion" },
      { action: "Use Cmd+Arrow keys to reposition the overlay", result: "Keep the widget visible without blocking your content" },
    ],
    whatHappens:
      "Shortcuts are registered globally and work regardless of which application is in focus. Each shortcut triggers its corresponding action immediately.",
    whyValuable:
      "Speed is everything in live conversations. Keyboard shortcuts eliminate the friction of finding and clicking buttons, keeping your focus where it belongs — on the conversation.",
    shortcuts: [
      { keys: "cmd+shift+s", label: "Start/Stop Recording", context: "Global" },
      { keys: "cmd+enter", label: "AI Assist", context: "During recording" },
      { keys: "cmd+\\", label: "Toggle Overlay", context: "Global" },
      { keys: "cmd+r", label: "Clear Context", context: "During recording" },
      { keys: "cmd+up", label: "Move Overlay Up", context: "Overlay visible" },
      { keys: "cmd+down", label: "Move Overlay Down", context: "Overlay visible" },
      { keys: "cmd+left", label: "Move Overlay Left", context: "Overlay visible" },
      { keys: "cmd+right", label: "Move Overlay Right", context: "Overlay visible" },
      { keys: "cmd+shift+k", label: "Screen Capture", context: "During recording" },
    ],
    planRequired: "free",
    icon: "⌨️",
    accentColor: "#F472B6",
  },
  {
    id: "settings-configuration",
    title: "Settings & Configuration",
    subtitle: "Make Queen Mama truly yours",
    description:
      "Comprehensive settings for AI providers, audio configuration, auto-launch, sync, and personalization.",
    whatItIs:
      "A full settings panel covering AI provider selection (OpenAI, Anthropic, Gemini, Grok), audio input/output configuration, auto-launch behavior, cloud sync preferences, and keyboard shortcut customization.",
    howToUse: [
      { action: "Open Settings from the menu bar or app", result: "Settings panel opens with organized categories" },
      { action: "Select your preferred AI provider and model", result: "All AI features use your chosen provider" },
      { action: "Configure audio inputs for microphone and system audio", result: "Transcription captures exactly what you need" },
      { action: "Enable cloud sync for cross-device access", result: "Sessions, contacts, and settings sync automatically" },
    ],
    whatHappens:
      "Settings are applied immediately and persist across sessions. AI provider changes take effect on the next response. Audio settings are tested with a live preview.",
    whyValuable:
      "Every workflow is different. Settings let you tailor Queen Mama to your specific tools, preferences, and security requirements — from AI provider choice to audio routing.",
    shortcuts: [],
    planRequired: "free",
    icon: "⚙️",
    accentColor: "#A78BFA",
  },
];

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories: FeatureCategory[] = [
  {
    id: "core-experience",
    label: "Core Experience",
    description: "The essential tools you'll use every session",
    icon: "🎯",
    accentColor: "#7C3AED",
    features: coreFeatures,
  },
  {
    id: "ai-intelligence",
    label: "AI Intelligence",
    description: "Advanced AI capabilities that adapt to your needs",
    icon: "💡",
    accentColor: "#3B82F6",
    features: intelligenceFeatures,
  },
  {
    id: "automation",
    label: "Automation",
    description: "Let AI work for you in real-time",
    icon: "🔄",
    accentColor: "#F97316",
    features: automationFeatures,
  },
  {
    id: "relationship-intelligence",
    label: "Relationship Intelligence",
    description: "Build stronger connections through conversation data",
    icon: "🤝",
    accentColor: "#10B981",
    features: relationshipFeatures,
  },
  {
    id: "power-user",
    label: "Power User",
    description: "Shortcuts and settings for maximum efficiency",
    icon: "⚡",
    accentColor: "#F472B6",
    features: powerUserFeatures,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getFeaturesByCategory(categoryId: string): Feature[] {
  return categories.find((c) => c.id === categoryId)?.features ?? [];
}

export function getFeatureById(featureId: string): Feature | undefined {
  for (const category of categories) {
    const found = category.features.find((f) => f.id === featureId);
    if (found) return found;
  }
  return undefined;
}

export const allShortcuts: KeyboardShortcutDef[] = [
  { keys: "cmd+shift+s", label: "Start/Stop Recording", context: "Global" },
  { keys: "cmd+enter", label: "AI Assist", context: "During recording" },
  { keys: "cmd+\\", label: "Toggle Overlay", context: "Global" },
  { keys: "cmd+r", label: "Clear Context", context: "During recording" },
  { keys: "cmd+shift+k", label: "Screen Capture", context: "During recording" },
  { keys: "cmd+up", label: "Move Overlay Up", context: "Overlay visible" },
  { keys: "cmd+down", label: "Move Overlay Down", context: "Overlay visible" },
  { keys: "cmd+left", label: "Move Overlay Left", context: "Overlay visible" },
  { keys: "cmd+right", label: "Move Overlay Right", context: "Overlay visible" },
];
