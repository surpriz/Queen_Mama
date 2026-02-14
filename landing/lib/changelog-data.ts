export interface Change {
  id: string;
  title: string;
  description?: string;
}

export interface ChangelogSection {
  category: 'features' | 'improvements' | 'fixes' | 'technical';
  changes: Change[];
}

export interface ChangelogRelease {
  date: string;
  isNew?: boolean;
  sections: ChangelogSection[];
}

export const changelogData: ChangelogRelease[] = [
  {
    date: "February 2026",
    isNew: true,
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "voiceDictation",
            title: "Voice Dictation Mode",
            description: "Standalone voice dictation for quick AI queries without starting a full session"
          },
          {
            id: "meetingDetection",
            title: "Meeting Detection & Reminders",
            description: "Automatic detection of active meetings with smart reminders to start recording"
          },
          {
            id: "contactManagement",
            title: "Contact Management",
            description: "Full contact management with notes, sync, and relationship tracking in Memory Palace"
          },
          {
            id: "bulkSessionDeletion",
            title: "Bulk Session Deletion",
            description: "Select and delete multiple sessions at once from the dashboard"
          },
          {
            id: "memoryPalace",
            title: "Memory Palace",
            description: "AI-powered mini-CRM that automatically extracts and manages contacts from your conversations"
          },
          {
            id: "displaySelection",
            title: "Display Selection",
            description: "Choose which display to use for screen capture in multi-monitor setups"
          },
          {
            id: "internationalisation",
            title: "Internationalized Landing Site",
            description: "Full French and English support across the entire website with locale-based routing"
          }
        ]
      },
      {
        category: "improvements",
        changes: [
          {
            id: "transcriptionReconnection",
            title: "Improved Transcription Reliability",
            description: "Enhanced WebSocket reconnection logic and more robust error recovery for uninterrupted transcription"
          },
          {
            id: "overlayRefinements",
            title: "Refined Overlay Appearance",
            description: "More transparent and polished overlay widget for a less intrusive experience"
          },
          {
            id: "aiResponseClarity",
            title: "Enhanced AI Response Quality",
            description: "Improved prompt engineering and context handling for clearer, more actionable AI suggestions"
          },
          {
            id: "healthMonitoring",
            title: "Proactive Health Monitoring",
            description: "Background service health checks to detect and recover from issues before they impact your session"
          }
        ]
      },
      {
        category: "fixes",
        changes: [
          {
            id: "authPersistence",
            title: "Authentication Persistence Fix",
            description: "Resolved an issue where authentication state could be lost between app restarts"
          },
          {
            id: "dashboardUrl",
            title: "Web Dashboard URL Fix",
            description: "Fixed the Web Dashboard button redirecting to the wrong domain"
          }
        ]
      },
      {
        category: "technical",
        changes: [
          {
            id: "schemaVersioning",
            title: "Schema Versioning",
            description: "Versioned data migration system for safe and seamless SwiftData schema updates"
          },
          {
            id: "orphanedSessionCleanup",
            title: "Orphaned Session Cleanup",
            description: "Automatic detection and cleanup of incomplete sessions left behind after crashes"
          }
        ]
      }
    ]
  },
  {
    date: "January 2026",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "subscriptionSystem",
            title: "4-Tier Subscription System",
            description: "Introduced FREE, PRO, and ENTERPRISE plans with tailored features for every use case"
          },
          {
            id: "licenseManagement",
            title: "Advanced License Management",
            description: "Feature gating and license status badges throughout the application"
          },
          {
            id: "deviceCodeAuth",
            title: "Device Code Authentication",
            description: "Seamless authentication flow with automatic session synchronization between macOS app and web dashboard"
          },
          {
            id: "adminDashboard",
            title: "Admin Dashboard",
            description: "Comprehensive user management, role assignment, and usage statistics for administrators"
          },
          {
            id: "usageTracking",
            title: "Server-Side Usage Tracking",
            description: "Real-time monitoring of AI requests and feature usage for better insights"
          }
        ]
      },
      {
        category: "improvements",
        changes: [
          {
            id: "stripeIntegration",
            title: "Enhanced Stripe Integration",
            description: "Dynamic checkout supporting multiple subscription tiers with automated plan assignment"
          },
          {
            id: "webhookAutomation",
            title: "Webhook Automation",
            description: "Automatic subscription plan association and license updates via Stripe webhooks"
          }
        ]
      }
    ]
  },
  {
    date: "December 2025",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "licenseBadges",
            title: "License Status Badges",
            description: "Visual indicators in the dashboard showing your current subscription tier"
          },
          {
            id: "markdownSupport",
            title: "Markdown Support",
            description: "Rich text rendering for AI responses with formatting, lists, and code blocks"
          }
        ]
      },
      {
        category: "improvements",
        changes: [
          {
            id: "authErrorHandling",
            title: "Authentication Error Handling",
            description: "Improved error messages and recovery flows for authentication issues"
          },
          {
            id: "stripeRefinements",
            title: "Stripe Integration Refinements",
            description: "More reliable payment processing and subscription management"
          }
        ]
      }
    ]
  },
  {
    date: "November 2025",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "multiProviderAI",
            title: "Multi-Provider AI Support",
            description: "Choose from OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini 2.0, and more"
          },
          {
            id: "smartMode",
            title: "Smart Mode",
            description: "Automatic AI model selection based on context and task complexity"
          },
          {
            id: "cachingSystem",
            title: "Intelligent Caching System",
            description: "30-50% cost reduction through smart response caching and optimization"
          },
          {
            id: "tokenTracking",
            title: "Token Usage Tracking",
            description: "Real-time monitoring of API usage with cost estimates"
          }
        ]
      },
      {
        category: "technical",
        changes: [
          {
            id: "screenshotDedup",
            title: "Screenshot Deduplication",
            description: "Optimized visual context handling to reduce redundant API calls"
          },
          {
            id: "dynamicTokenLimits",
            title: "Dynamic Token Limits",
            description: "Adaptive token management for cost-efficient AI interactions"
          }
        ]
      }
    ]
  },
  {
    date: "October 2025",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "multiLanguage",
            title: "Multi-Language Transcription",
            description: "Automatic language detection supporting French, English, and more"
          },
          {
            id: "multiTranscription",
            title: "Multiple Transcription Providers",
            description: "Support for Deepgram and AssemblyAI with automatic fallback"
          },
          {
            id: "responseHistory",
            title: "Response History",
            description: "View and navigate through AI responses directly in the overlay"
          }
        ]
      },
      {
        category: "improvements",
        changes: [
          {
            id: "enhancedVisual",
            title: "Enhanced Visual Context",
            description: "Improved screenshot integration in AI prompts for better understanding"
          },
          {
            id: "autoScrollHistory",
            title: "Auto-Scroll History",
            description: "Automatic scrolling to latest responses in the overlay"
          }
        ]
      }
    ]
  },
  {
    date: "September 2025",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "realtimeTranscription",
            title: "Real-Time Audio Transcription",
            description: "Live speech-to-text powered by Deepgram Nova-3"
          },
          {
            id: "contextualAI",
            title: "Contextual AI Assistance",
            description: "Intelligent suggestions based on conversation context and screen content"
          },
          {
            id: "screenContext",
            title: "Screen Context Analysis",
            description: "AI understands what's on your screen to provide relevant advice"
          },
          {
            id: "undetectableOverlay",
            title: "Undetectable Overlay",
            description: "Privacy-focused overlay that stays invisible to screen sharing and recording tools"
          },
          {
            id: "secureKeyStorage",
            title: "Secure API Key Storage",
            description: "Military-grade encryption using macOS Keychain for your API keys"
          },
          {
            id: "multipleAIModes",
            title: "Multiple AI Modes",
            description: "Pre-configured modes for Professional meetings, Interviews, Sales calls, and more"
          }
        ]
      }
    ]
  }
];
