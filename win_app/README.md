# Queen Mama - Windows

Real-time AI coaching assistant for Windows. Get contextual suggestions during meetings, interviews, and calls.

## Features

- **Real-time Transcription**: Live speech-to-text via Deepgram Nova-3
- **AI Assistance**: Contextual suggestions powered by GPT-4o, Claude, or Gemini
- **Undetectable Overlay**: Floating widget hidden from screen sharing (Zoom, Teams, etc.)
- **Global Hotkeys**: Control the app from anywhere
- **Multi-language Support**: Automatic language detection

## Requirements

- Windows 10 version 2004 or later (required for undetectable overlay)
- .NET 8 Runtime
- Microphone access
- Screen recording permissions (for visual context)

## Quick Start

### From Source

```bash
# Clone repository
git clone https://github.com/your-org/queen-mama.git
cd queen-mama/win_app

# Restore dependencies
dotnet restore

# Build
dotnet build

# Run
dotnet run --project src/QueenMama.App
```

### Configuration

1. Launch the application
2. Open Settings from system tray
3. Configure API keys:
   - Deepgram (required for transcription)
   - At least one AI provider (OpenAI, Anthropic, or Google)

## Usage

### Starting a Session

1. Click "Start Session" from dashboard or system tray
2. Or press `Ctrl+Shift+S`
3. The overlay will appear and transcription begins

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Start/Stop Session |
| `Ctrl+\` | Toggle Overlay Visibility |
| `Ctrl+Enter` | Trigger AI Assist |
| `Ctrl+R` | Clear Context |
| `Ctrl+Arrow Keys` | Move Overlay |

### AI Response Types

- **Assist**: General contextual help based on conversation
- **What to Say**: Suggested responses for your turn
- **Follow-up**: Questions to keep the conversation going
- **Recap**: Summary of key points discussed

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Queen Mama App                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Overlay   │  │  Dashboard  │  │   System    │     │
│  │   Window    │  │   Window    │  │    Tray     │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│  ┌──────┴────────────────┴────────────────┴──────┐     │
│  │              ViewModels (MVVM)                 │     │
│  └──────────────────────┬────────────────────────┘     │
├─────────────────────────┼───────────────────────────────┤
│  ┌──────────────────────┴────────────────────────┐     │
│  │                  Services                      │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │     │
│  │  │  Audio  │ │Transcr. │ │   AI    │         │     │
│  │  │ Capture │ │ Service │ │ Service │         │     │
│  │  └────┬────┘ └────┬────┘ └────┬────┘         │     │
│  │       │           │           │               │     │
│  │  ┌────┴───────────┴───────────┴────┐         │     │
│  │  │       External Services          │         │     │
│  │  │  Deepgram │ OpenAI │ Anthropic  │         │     │
│  │  └─────────────────────────────────┘         │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
win_app/
├── QueenMama.sln              # Visual Studio solution
├── src/
│   ├── QueenMama.Core/        # Business logic (platform-agnostic)
│   │   ├── Models/            # Data models
│   │   ├── Services/          # Core services
│   │   ├── Data/              # EF Core context
│   │   └── Interfaces/        # Service contracts
│   └── QueenMama.App/         # WPF application
│       ├── ViewModels/        # MVVM ViewModels
│       ├── Views/             # XAML views
│       ├── Services/          # App services
│       └── Themes/            # Styling
└── tests/
    └── QueenMama.Tests/       # Unit tests
```

## Technology Stack

- **.NET 8** - Runtime and SDK
- **WPF** - UI framework
- **NAudio** - Audio capture (WASAPI)
- **Entity Framework Core** - Database (SQLite)
- **CommunityToolkit.Mvvm** - MVVM infrastructure
- **Hardcodet.NotifyIcon.Wpf** - System tray

## Privacy & Security

- Audio is processed locally and streamed directly to Deepgram
- API keys stored in Windows Credential Manager
- Sensitive data encrypted with DPAPI
- Overlay is invisible to screen recording software
- No data stored on our servers

## Troubleshooting

### Overlay not appearing
- Ensure Windows 10 2004+ is installed
- Check if another app is using the hotkey
- Try restarting the application

### No transcription
- Verify Deepgram API key is configured
- Check microphone permissions in Windows Settings
- Ensure microphone is not muted

### AI responses not working
- Verify at least one AI provider API key is configured
- Check internet connectivity
- Review logs for error details

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, please contact support or open an issue on GitHub.
