# Queen Mama LITE

Cross-platform AI coaching assistant built with Tauri v2, React, and TypeScript.

## Features

- **Real-time Transcription**: Live speech-to-text via Deepgram Nova-3
- **AI Assistance**: Multiple response types (Assist, What to Say, Follow-up, Recap)
- **Floating Overlay**: Always-on-top widget with expand/collapse
- **Global Shortcuts**: System-wide keyboard shortcuts
- **Session Management**: Record and review past sessions
- **Cross-Platform**: Works on macOS, Windows, and Linux

## Limitations vs Native App

- ❌ Undetectable overlay (visible in screen share)
- ❌ System audio capture (microphone only)
- ✅ All other features

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: `webkit2gtk` and build essentials

### Installation

```bash
# Clone and navigate to web_app
cd web_app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Project Structure

```
web_app/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── lib.rs       # Main library
│   │   ├── shortcuts.rs # Global hotkeys
│   │   ├── tray.rs      # System tray
│   │   └── window.rs    # Window management
│   └── tauri.conf.json  # Tauri configuration
│
├── src/                 # React frontend
│   ├── components/
│   │   ├── ui/          # Base UI components
│   │   ├── overlay/     # Overlay window
│   │   ├── dashboard/   # Dashboard views
│   │   ├── auth/        # Authentication
│   │   └── shared/      # Shared components
│   ├── services/        # API & audio services
│   ├── stores/          # Zustand state stores
│   ├── styles/          # CSS & design tokens
│   └── types/           # TypeScript types
│
└── index.html           # Dashboard entry
└── overlay.html         # Overlay entry
```

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle Overlay | ⌘\\ | Ctrl+\\ |
| AI Assist | ⌘↩ | Ctrl+Enter |
| Start/Stop Session | ⌘⇧S | Ctrl+Shift+S |
| Clear Context | ⌘R | Ctrl+R |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |

### API Endpoints Used

- `POST /api/auth/device/code` - Device code flow
- `GET /api/auth/device/poll` - Poll authorization
- `POST /api/proxy/ai/stream` - AI streaming (SSE)
- `POST /api/proxy/transcription/token` - Deepgram token

## Development

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State**: Zustand with persistence
- **Backend**: Tauri 2, Rust
- **Styling**: Design tokens from macOS app

### Key Files

| File | Purpose |
|------|---------|
| `src/stores/authStore.ts` | Authentication state |
| `src/stores/sessionStore.ts` | Session management |
| `src/services/audio/AudioCaptureService.ts` | Microphone capture |
| `src/components/overlay/OverlayWindow.tsx` | Main overlay |
| `src-tauri/src/shortcuts.rs` | Global shortcuts |

## Building

```bash
# macOS (Universal)
npm run tauri build -- --target universal-apple-darwin

# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## License

Proprietary - Queen Mama Team
