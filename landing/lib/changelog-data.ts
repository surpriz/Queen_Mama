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
    date: "January 2026",
    isNew: true,
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
