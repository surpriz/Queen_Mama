# Queen Mama

AI-powered real-time coaching assistant for meetings, interviews, and sales calls on macOS.

## Project Structure

Ce repository contient deux projets distincts :

### 1. **Application macOS** (`QueenMama/`)
Application Swift native pour macOS avec transcription en temps réel et assistance IA.

### 2. **Landing Page & Dashboard Web** (`landing/`)
Application Next.js fullstack (React + API routes) pour :
- Page d'accueil marketing
- Authentification utilisateurs (credentials + OAuth)
- Tableau de bord de gestion des API keys
- Gestion des abonnements (Stripe)
- Synchronisation des sessions depuis l'app macOS

## Quick Start

### Pour l'Application Web (Landing Page)
```bash
cd landing
npm install
npm run dev
```
Voir [landing/README.md](landing/README.md) pour les instructions complètes.

### Pour l'Application macOS
Voir les instructions ci-dessous.

---

## Application macOS - Features

- **Real-time Transcription**: Uses Deepgram Nova-3 for low-latency speech-to-text
- **AI Assistance**: Multi-provider support (OpenAI, Anthropic, Gemini) with automatic fallback
- **Screen Context**: Vision AI analyzes your screen to provide contextual suggestions
- **Floating Overlay**: Undetectable widget that stays on top during screen sharing
- **Multiple Modes**: Customize AI behavior for different scenarios (Interview, Sales, etc.)

## Requirements

- macOS 14.2 or later (required for Core Audio Taps)
- Xcode 15 or later
- API Keys:
  - Deepgram (for speech-to-text)
  - At least one AI provider: OpenAI, Anthropic, or Google Gemini

## Setup Instructions

### 1. Create Xcode Project

1. Open Xcode
2. Create a new project: **File > New > Project**
3. Select **macOS > App**
4. Configure:
   - Product Name: `QueenMama`
   - Team: Your development team
   - Organization Identifier: `com.yourname`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **SwiftData**
5. Save in the `Queen_Mama` folder (replace the generated `QueenMama` folder)

### 2. Add Source Files

After creating the project, the source files are already in place. You need to:

1. In Xcode, right-click on the `QueenMama` group in the navigator
2. Select **Add Files to "QueenMama"...**
3. Select all the `.swift` files from the `QueenMama` folder
4. Make sure "Copy items if needed" is **unchecked** (files are already in place)
5. Click **Add**

### 3. Configure Entitlements

1. Select the project in the navigator
2. Select the `QueenMama` target
3. Go to **Signing & Capabilities**
4. Click **+ Capability** and add:
   - App Sandbox
   - Hardened Runtime (if not already added)
5. In App Sandbox, enable:
   - Network > Outgoing Connections (Client)
   - Hardware > Audio Input
   - File Access > User Selected File (Read/Write)

### 4. Configure Info.plist

The `Info.plist` file includes required privacy descriptions. Ensure they're properly linked:

1. Select the project
2. Go to **Build Settings**
3. Search for "Info.plist"
4. Set the path to `QueenMama/Info.plist`

### 5. Configure Minimum Deployment

1. Select the project
2. Go to **General**
3. Set **Minimum Deployments** to **macOS 14.2**

### 6. Build and Run

1. Select your Mac as the run destination
2. Press **Cmd + R** to build and run
3. Grant permissions when prompted (Microphone, Screen Recording)

## First Launch

1. Open **Settings** from the dashboard
2. Go to **API Keys** tab
3. Enter your API keys:
   - Deepgram API key (required)
   - At least one AI provider key (OpenAI recommended)
4. Click **Save** for each key

## Usage

### Starting a Session

1. Click **Start Session** in the dashboard or menu bar
2. The floating overlay will appear
3. Speak or share your screen - transcription begins automatically

### Using the Overlay

- **Cmd + \\**: Toggle overlay visibility
- **Cmd + Enter**: Trigger AI Assist
- **Drag**: Move the overlay anywhere on screen
- Click the expand button to access all features

### AI Features

- **Assist**: General guidance based on conversation and screen
- **What should I say?**: Specific phrases you can use immediately
- **Follow-up questions**: Suggested questions to ask
- **Recap**: Summary of the conversation

## Project Structure

```
QueenMama/
├── QueenMamaApp.swift          # App entry point
├── Models/                      # Data models (SwiftData)
│   ├── Session.swift
│   ├── Mode.swift
│   └── AIResponse.swift
├── Services/                    # Core services
│   ├── AudioCaptureService.swift
│   ├── ScreenCaptureService.swift
│   ├── TranscriptionService.swift
│   ├── AIService.swift
│   ├── SessionManager.swift
│   ├── KeychainManager.swift
│   ├── ConfigurationManager.swift
│   └── Providers/              # AI provider implementations
│       ├── AIProvider.swift
│       ├── OpenAIProvider.swift
│       ├── AnthropicProvider.swift
│       └── GeminiProvider.swift
├── Views/
│   ├── Dashboard/              # Main app window
│   │   ├── DashboardView.swift
│   │   ├── SessionListView.swift
│   │   ├── LiveSessionView.swift
│   │   ├── SettingsView.swift
│   │   └── ModesListView.swift
│   └── Overlay/                # Floating widget
│       ├── OverlayWindow.swift
│       └── OverlayContentView.swift
└── Utilities/
    └── KeyboardShortcuts.swift
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd + Shift + S | Start/Stop Session |
| Cmd + \\ | Toggle Widget |
| Cmd + Enter | Trigger Assist |
| Cmd + R | Clear Context |
| Cmd + Arrows | Move Widget |

## Troubleshooting

### Screen Recording Permission

If screen capture doesn't work:
1. Go to **System Settings > Privacy & Security > Screen Recording**
2. Enable Queen Mama
3. Restart the app

### Microphone Permission

If audio capture doesn't work:
1. Go to **System Settings > Privacy & Security > Microphone**
2. Enable Queen Mama
3. Restart the app

### API Errors

- Check that API keys are correctly entered in Settings
- Verify your API accounts have available credits
- The app will automatically try fallback providers if one fails

## License

Private project - not for distribution.
