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
    date: "March 2026",
    isNew: true,
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "windowsApp",
            title: "Windows App Available",
            description: "Queen Mama is now available for Windows 10+ with automatic updates and full feature parity"
          },
          {
            id: "windowsDownload",
            title: "Cross-Platform Downloads",
            description: "The download page now auto-detects your OS and offers the right installer for macOS or Windows"
          },
          {
            id: "frenchLocalization",
            title: "Full French Interface",
            description: "The macOS app is now fully available in French with a comprehensive String Catalog covering all screens"
          },
          {
            id: "appLanguageSelection",
            title: "In-App Language Switching",
            description: "Choose your preferred app language (French, English, or system default) directly from Settings"
          },
          {
            id: "quickLanguageToggle",
            title: "Quick Language Toggle",
            description: "Switch between French and English with a single click from the dashboard sidebar"
          },
          {
            id: "limitlessMode",
            title: "Limitless Mode",
            description: "A new AI mode inspired by NZT for enhanced cognitive pattern recognition, anticipation, and deep knowledge synthesis"
          },
          {
            id: "winOverlayContentProtection",
            title: "Screen Recording Protection (Windows)",
            description: "The overlay widget is now excluded from screen captures and recordings when content protection is enabled on Windows"
          },
          {
            id: "winBulkSessionDeletion",
            title: "Bulk Session Deletion (Windows)",
            description: "Select and delete multiple sessions at once from the Sessions view in the Windows app"
          },
          {
            id: "electronMacDownload",
            title: "Electron macOS App",
            description: "A new macOS version is now available as a universal Electron DMG on the download page"
          }
        ]
      },
      {
        category: "improvements",
        changes: [
          {
            id: "refinedCoachingPrompts",
            title: "Refined AI Coaching Prompts",
            description: "Rewritten system prompts across all AI modes for more natural, concise, and actionable coaching responses"
          },
          {
            id: "sonnet46Upgrade",
            title: "Upgraded to Claude Sonnet 4.6",
            description: "All AI modes now use Anthropic's latest Sonnet 4.6 model for faster, higher-quality responses"
          },
          {
            id: "adaptiveThinking",
            title: "Adaptive Smart Mode",
            description: "Smart Mode now uses adaptive thinking — the AI decides when deep reasoning is needed, improving speed on simple requests"
          },
          {
            id: "recapContextExpansion",
            title: "Comprehensive Meeting Recaps",
            description: "Recaps now capture up to 4x more conversation context for more complete and detailed meeting summaries"
          },
          {
            id: "languageConsistency",
            title: "Consistent Language Detection",
            description: "AI responses now match the transcript language from the very first word, eliminating mixed-language outputs"
          },
          {
            id: "authMethodDisplay",
            title: "Sign-in Method Badge",
            description: "Account settings now display whether you signed in with Google or Email"
          },
          {
            id: "appIcons",
            title: "App Icons Update",
            description: "Updated app icons and asset configurations for a refreshed visual identity"
          },
          {
            id: "autoMoveToApplications",
            title: "Auto-Move to Applications",
            description: "The app now detects when it's running from Downloads or a disk image and offers to move itself to Applications for seamless updates"
          },
          {
            id: "backgroundStartup",
            title: "Faster App Startup",
            description: "Keychain credentials, audio hardware, and update checker now initialize in background, eliminating startup freezes"
          },
          {
            id: "enhancedDiagnostics",
            title: "Enhanced Error Diagnostics",
            description: "Improved error handling and diagnostic logging across authentication, networking, and session management"
          },
          {
            id: "adaptiveResponseDepth",
            title: "Adaptive Response Depth",
            description: "AI responses now dynamically adjust their depth and detail based on conversation complexity and context"
          },
          {
            id: "conciseAssistFormat",
            title: "Streamlined Assist Responses",
            description: "Assist responses during live sessions now use a concise bullet-point format for quick scanning"
          },
          {
            id: "pricingPlanAlignment",
            title: "Accurate Plan Features",
            description: "All three subscription plans now accurately reflect the features available in the apps, including screenshot capture for Pro and proactive suggestions for Enterprise"
          },
          {
            id: "winModeDescriptions",
            title: "Built-in Mode Descriptions (Windows)",
            description: "Built-in mode prompts are now shown as clear capability descriptions instead of raw system prompts"
          },
          {
            id: "winPlanColors",
            title: "Plan Badge Design (Windows)",
            description: "Pro and Enterprise plan badges now use gold/amber colors to visually distinguish paid tiers, matching the macOS design"
          },
          {
            id: "winActiveModeFix",
            title: "Active Mode on Launch (Windows)",
            description: "The Default mode is now auto-selected and shown as active when the Windows app first loads"
          },
          {
            id: "winSmartModeUX",
            title: "Smart Mode Context (Windows)",
            description: "Smart Mode now displays an explanatory tooltip clarifying its slower-but-more-accurate advanced reasoning behavior"
          },
          {
            id: "truthFirstCoaching",
            title: "Honest, Accurate AI Coaching",
            description: "Built-in modes now prioritize factually correct answers over confirmation — if you're wrong, the AI says so clearly and explains why"
          },
          {
            id: "modeDescriptions",
            title: "Built-in Mode Descriptions (macOS)",
            description: "Built-in mode prompts on macOS are now shown as clear capability descriptions instead of raw system prompts"
          },
          {
            id: "processingIndicator",
            title: "AI Processing Indicator",
            description: "A visual indicator now shows when the AI is actively generating a response"
          },
          {
            id: "proactivePatternRecognition",
            title: "Proactive Pattern Recognition",
            description: "AI modes now automatically identify psychological and organizational patterns in conversations and connect them to concrete actions — without waiting for you to introduce the concept"
          }
        ]
      },
      {
        category: "fixes",
        changes: [
          {
            id: "privacyProtectionUx",
            title: "Privacy Protection Messaging",
            description: "Clear, user-friendly explanations when AI safety filters activate instead of generic refusal messages"
          },
          {
            id: "recapScreenshotRefusal",
            title: "Recap Reliability Fix",
            description: "Recaps no longer send screenshots, preventing safety filter false positives during video calls"
          },
          {
            id: "robustStartupAuth",
            title: "Reliable App Startup",
            description: "The app now waits up to 10 seconds for authentication instead of 2, preventing false 'Session Expired' on slow networks"
          },
          {
            id: "keychainTokenStorage",
            title: "Secure Token Persistence",
            description: "Token storage uses a safer update-or-add pattern, preventing accidental token loss after app restarts"
          },
          {
            id: "magicLinkSession",
            title: "Magic Link Session Fix",
            description: "Opening the web dashboard from the app now correctly signs into the right account, even if another user was previously logged in"
          },
          {
            id: "onboardingVisibility",
            title: "Onboarding Button Visibility",
            description: "Navigation buttons are now always visible during the onboarding flow without needing to scroll"
          },
          {
            id: "zombieAuthRecovery",
            title: "Stale Session Auto-Recovery",
            description: "The app now detects and clears expired authentication states instead of silently failing"
          },
          {
            id: "overlayModeSelection",
            title: "Overlay Mode Selection Fix",
            description: "Fixed duplicate selection highlight when custom and built-in modes share the same name"
          },
          {
            id: "builtInModeDefaults",
            title: "Built-in Mode Defaults Fix",
            description: "Fixed built-in mode default flags and filtering to correctly separate built-in and custom modes"
          },
          {
            id: "dualInstanceFix",
            title: "Single Instance Protection",
            description: "Prevents duplicate app instances when switching the UI language between French and English"
          },
          {
            id: "serverRetryLogic",
            title: "Automatic Server Error Recovery",
            description: "Server errors and token refresh failures now retry automatically before failing, reducing forced logouts"
          },
          {
            id: "screenCaptureRecovery",
            title: "Screen Capture Auto-Recovery",
            description: "Automatically recovers screen capture when an external display is disconnected or reconfigured"
          },
          {
            id: "winScreenCaptureCache",
            title: "Screen Capture Refresh Fix (Windows)",
            description: "Fixed a deduplication issue preventing fresh screenshots from being analyzed in Screen-Only AI mode"
          },
          {
            id: "winAiCooldownFix",
            title: "Manual AI Request Fix (Windows)",
            description: "Manual AI requests are no longer blocked by the auto-response cooldown timer"
          }
        ]
      },
      {
        category: "technical",
        changes: [
          {
            id: "authFlowSimplification",
            title: "Streamlined Sign-In Flow",
            description: "Simplified the email authentication UI with clearer navigation between sign-in and sign-up"
          },
          {
            id: "regressionTestSuite",
            title: "Regression Test Suite",
            description: "Added comprehensive tests for authentication error handling, session lifecycle, and service availability checks"
          },
          {
            id: "windowsCiCd",
            title: "Windows CI/CD Pipeline",
            description: "Automated build, test, and release pipeline for the Windows app with platform-specific versioning"
          },
          {
            id: "windowsBuildEnv",
            title: "Windows Build Environment Fix",
            description: "Google Sign-In and environment detection now work correctly in production Windows builds"
          },
          {
            id: "transcriptionProxy",
            title: "Secure Transcription Relay",
            description: "WebSocket proxy that keeps Deepgram API keys on the server, improving security for desktop app audio streaming"
          },
          {
            id: "desktopCorsSupport",
            title: "Desktop App Sync Support",
            description: "CORS and session synchronization infrastructure enabling desktop apps to sync data with the web dashboard"
          },
          {
            id: "ciCdOptimization",
            title: "CI/CD Pipeline Optimization",
            description: "Eliminated duplicate test runs and added concurrency controls across all build and deploy workflows"
          }
        ]
      }
    ]
  },
  {
    date: "February 2026",
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
          },
          {
            id: "customModesOverlay",
            title: "Custom Modes in Overlay",
            description: "Switch between custom AI modes directly from the overlay widget popup menu"
          },
          {
            id: "overlayMarkdownParsing",
            title: "Advanced Markdown Rendering",
            description: "Full Markdown support in overlay responses including code blocks, bullet lists, and ordered lists"
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
          },
          {
            id: "overlayUiPolish",
            title: "Polished Overlay Widget",
            description: "Refined tab buttons, status indicators, and popup menu for a smoother overlay experience"
          },
          {
            id: "aiSuggestionsRefinement",
            title: "Smarter AI Suggestions",
            description: "Improved prompt handling and screenshot integration for more relevant AI responses"
          },
          {
            id: "energyOptimization",
            title: "Energy Optimization",
            description: "Reduced energy consumption by optimizing animations to only run when needed"
          },
          {
            id: "aiStreamEnhancement",
            title: "Enhanced AI Streaming",
            description: "Improved AI response streaming with better Markdown table support via remark-gfm"
          },
          {
            id: "authFlowRefactor",
            title: "Refined Authentication Flow",
            description: "Streamlined sign-in experience with improved session management and smoother transitions"
          },
          {
            id: "dashboardAnimations",
            title: "Polished Dashboard Animations",
            description: "Smoother transitions and refined visual feedback throughout the dashboard interface"
          }
        ]
      },
      {
        category: "fixes",
        changes: [
          {
            id: "websocketRecovery",
            title: "WebSocket Connection Recovery",
            description: "Fixed infinite reconnection loop that could leave transcription stuck on 'Reconnecting' during WiFi disruptions"
          },
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
          },
          {
            id: "deploymentPipeline",
            title: "Deployment Pipeline",
            description: "Separate staging and production environments with test-gated deployments"
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
