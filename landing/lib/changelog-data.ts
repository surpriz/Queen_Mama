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
    date: "May 2026",
    isNew: true,
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "aiModelSelector",
            title: "Choose Your AI Model",
            description: "Pick which AI model powers your standard responses — select directly from Settings to match your speed and reasoning preferences"
          },
          {
            id: "liveTranscriptToggle",
            title: "Live Transcript Toggle",
            description: "Show or hide the real-time transcript from Settings — useful when you want the overlay focused on AI responses only"
          },
          {
            id: "inAppPricingModal",
            title: "In-App Pricing Modal",
            description: "Browse plans and upgrade directly from the app without leaving your workflow"
          },
          {
            id: "windowsAutoUpdate",
            title: "Windows Auto-Updates",
            description: "The Windows app now updates itself automatically with clear notifications when a new version is ready"
          },
          {
            id: "windowsUIRedesign",
            title: "Refined Windows UI",
            description: "The Windows app gets a deeper visual identity with a more cohesive and polished interface"
          },
        ],
      },
      {
        category: "improvements",
        changes: [
          {
            id: "languageOverride",
            title: "Manual Language Override",
            description: "Force AI responses into a specific language using the LANG_OVERRIDE directive in your mode prompt, bypassing automatic detection"
          },
          {
            id: "frenchTranscriptionStability",
            title: "Stabler French Transcription",
            description: "Transcription now stays locked on French when set as primary language, preventing drift to English mid-meeting"
          },
          {
            id: "aiCascadeMode",
            title: "AI Cascade Fallback",
            description: "If the primary AI model fails, Queen Mama now automatically cascades through backup providers so you never lose a response"
          },
          {
            id: "centralToastSystem",
            title: "Unified Notifications (Windows)",
            description: "Notifications now route through a single central toast system for a more consistent and less noisy experience"
          },
        ],
      },
      {
        category: "fixes",
        changes: [
          {
            id: "promptDifferentiation",
            title: "Sharper Tab Specialization",
            description: "What to Say and Follow-up now have distinct prompts from Assist, giving each tab a clearer purpose and more targeted output"
          },
          {
            id: "knowledgeExtractionDedup",
            title: "No More Duplicate Knowledge",
            description: "Knowledge extraction now deduplicates atoms, enforces a cap, and throttles re-extraction to prevent the same fact from being saved twice"
          },
          {
            id: "manualTriggerCache",
            title: "Fresh Manual Triggers",
            description: "Manual tab triggers now always generate a fresh response instead of returning stale cached output"
          },
        ],
      },
    ],
  },
  {
    date: "April 2026",
    sections: [
      {
        category: "features",
        changes: [
          {
            id: "speakerDiarization",
            title: "Speaker Identification (macOS)",
            description: "Queen Mama now distinguishes between you and your interlocutor using dual-stream audio analysis with intelligent bleed filtering"
          },
          {
            id: "coachingAssist",
            title: "Coaching-Style Assist",
            description: "The Assist mode now gives direct, actionable coaching — concrete points to mention instead of generic advice"
          },
          {
            id: "smartModeAllTabs",
            title: "Smart Mode for All Tabs",
            description: "What to Say and Follow-Up now work correctly in Smart Mode with deep reasoning from Sonnet 4.6"
          },
          {
            id: "freePlanUpgrade",
            title: "10 Daily AI Requests (Free)",
            description: "Free plan now includes 10 AI requests per day instead of 1, making it much more useful for getting started"
          },
          {
            id: "windowsDiarization",
            title: "Speaker Identification (Windows)",
            description: "Speaker identification with dual-stream audio analysis is now available on Windows"
          },
          {
            id: "singleStreamFallback",
            title: "Single-Stream Fallback",
            description: "Automatic fallback to single-stream transcription when system audio capture is unavailable"
          },
          {
            id: "meetingCostTracking",
            title: "Meeting Cost Tracking",
            description: "See real-time AI spend per meeting and configure custom cost thresholds from Settings"
          },
        ],
      },
      {
        category: "improvements",
        changes: [
          {
            id: "fasterStreaming",
            title: "Faster AI Responses",
            description: "GPT-5.4-mini as primary model with prompt caching reduces response time by up to 44%"
          },
          {
            id: "transcriptFreshness",
            title: "Real-Time Transcript Context",
            description: "Assist now captures the very latest speech including words being spoken right now for more relevant responses"
          },
          {
            id: "focusedContext",
            title: "Laser-Focused Context",
            description: "Assist responses now focus strictly on the current topic being discussed, ignoring older conversation"
          },
          {
            id: "languageDetection",
            title: "Improved Language Detection",
            description: "Responses now consistently match the transcript language — French transcript always gets a French response"
          },
          {
            id: "markdownBullets",
            title: "Better Response Formatting",
            description: "Bullet points now render correctly on separate lines regardless of the AI model used"
          },
          {
            id: "overlaySessionReset",
            title: "Clean Overlay Between Sessions",
            description: "The overlay now automatically clears previous session's AI responses when starting a new session"
          },
          {
            id: "responsivePricing",
            title: "Responsive Pricing Modal",
            description: "The pricing modal now adapts properly to the overlay widget size"
          },
          {
            id: "windowsStreamingParity",
            title: "Windows Streaming Performance",
            description: "Windows app now matches macOS streaming performance and AI response quality"
          },
          {
            id: "perspectiveAwareAssist",
            title: "Speaker-Aware Coaching",
            description: "Assist no longer puts your interlocutor's words in your mouth, and shifts to insight mode when you're silently listening instead of forcing a reply"
          },
          {
            id: "modeFileDragDrop",
            title: "Mode File Attachments",
            description: "Drag and drop files directly into a mode, remove attachments, and keep them across sessions"
          },
          {
            id: "windowsAIGuardsParity",
            title: "Windows AI Coaching Parity",
            description: "The Windows app now applies the same language lock and speaker perspective guards as macOS for more reliable coaching"
          },
        ],
      },
      {
        category: "fixes",
        changes: [
          {
            id: "smartModeError",
            title: "Smart Mode Error Fixed",
            description: "Fixed an issue where Smart Mode returned empty responses due to incompatible API parameters"
          },
          {
            id: "tokenRefreshRace",
            title: "Token Refresh Stability",
            description: "Fixed a race condition in token refresh that could cause authentication failures"
          },
          {
            id: "windowsLicenseDesync",
            title: "Windows License Sync Fix",
            description: "Fixed license status mismatch between dashboard and overlay on Windows"
          },
        ],
      },
    ],
  },
  {
    date: "March 2026",
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
          },
          {
            id: "liveTranscriptOverlay",
            title: "Live Transcript in Overlay (macOS)",
            description: "See your meeting transcript in real time directly in the overlay widget — recent spoken text scrolls automatically as you speak"
          },
          {
            id: "fileSaveElectron",
            title: "Save Transcript to File (Windows)",
            description: "Export your session transcript as a text file directly from the Windows app"
          },
          {
            id: "restartUpdateButton",
            title: "Instant Update Installation (Windows)",
            description: "A Restart & Update button now appears in the overlay as soon as a new version is downloaded, so you can update without leaving your session"
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
            id: "prioritizedTranscriptContext",
            title: "Smarter Transcript Context",
            description: "AI now prioritizes recent conversation over older background, ensuring responses reference what's being discussed right now"
          },
          {
            id: "speakerAttributionFix",
            title: "Accurate Speaker References",
            description: "AI no longer incorrectly attributes statements to named individuals — responses now use generic references unless attribution is certain"
          },
          {
            id: "temporalReasoning",
            title: "Date-Aware AI Responses",
            description: "AI now knows the current date, enabling accurate temporal reasoning for scheduling and deadline discussions"
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
            id: "freeTierUpgradeUX",
            title: "FREE Plan Upgrade Prompts (Windows)",
            description: "Clear upgrade prompts with pricing comparison when FREE plan limits are reached, including dashboard banner and overlay counter"
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
          },
          {
            id: "autoDetectLanguage",
            title: "Auto-Detect Transcription Language",
            description: "The transcription engine now automatically detects your spoken language — no manual language selection required"
          },
          {
            id: "winTranscriptDisplay",
            title: "Cleaner Transcript Display (Windows)",
            description: "The overlay transcript panel now shows only the most recent lines for a less cluttered, easier-to-read experience"
          }
        ]
      },
      {
        category: "fixes",
        changes: [
          {
            id: "winAutoUpdateFix",
            title: "Windows Auto-Update Fix",
            description: "Fixed an issue where the Windows app always reported 'up to date' even when newer versions were available"
          },
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
          },
          {
            id: "windowsAutoUpdaterFix",
            title: "Windows Auto-Updater Reliability",
            description: "Resolved an issue where the Windows updater sometimes failed to detect available updates due to incorrect file path handling after code signing"
          },
          {
            id: "sentryErrorFiltering",
            title: "Reduced Error Noise (Windows)",
            description: "Expected transient errors like WebSocket reconnections and auth validation are no longer reported as crashes, improving issue visibility"
          },
          {
            id: "updaterUrlRewriting",
            title: "Auto-Updater Path Fix (Windows)",
            description: "Fixed an issue where the auto-updater could fail with a file not found error due to incorrect URL-to-path conversion on Windows"
          },
          {
            id: "aiLanguageBiasFix",
            title: "AI Language Matching Fix (Windows)",
            description: "AI responses now correctly match the transcript language — previously, French examples in system prompts biased all responses toward French regardless of the meeting language"
          },
          {
            id: "taskbarVisibility",
            title: "Taskbar Icon Visibility (Windows)",
            description: "The Queen Mama icon now stays visible in the Windows taskbar when the dashboard is closed, making it easy to see the app is running"
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
