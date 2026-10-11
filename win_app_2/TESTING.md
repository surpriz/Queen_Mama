# Queen Mama Windows — Testing Guide

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- **Git**
- macOS or Windows for development

## Setup

```bash
cd win_app_2

# Install dependencies
npm install

# Environment (optional — defaults to staging)
# Set VITE_APP_ENV=development for local backend
```

## Development Mode

```bash
npm run dev
```

This boots the Electron app with React hot-reload. Both the main dashboard window and overlay widget appear.

## Build

```bash
# Production build
npm run build

# Package for distribution
npm run package
```

## Tests

```bash
# Unit tests
npm test

# E2E tests (requires built app)
npm run test:e2e

# Type check only
npx tsc --noEmit

# Lint
npm run lint
```

## What Works on macOS (Development)

Almost everything works identically on macOS and Windows in Electron:

| Feature | macOS | Windows |
|---------|-------|---------|
| Audio capture (Web Audio API) | Yes | Yes |
| Transcription (WebSocket) | Yes | Yes |
| AI streaming (SSE) | Yes | Yes |
| Dashboard UI | Yes | Yes |
| Overlay widget | Yes | Yes |
| Keyboard shortcuts | Yes (Ctrl) | Yes (Ctrl) |
| System tray | Yes | Yes |
| SQLite database | Yes | Yes |
| Secure storage | Yes (Keychain) | Yes (DPAPI) |
| Google OAuth | Yes | Yes |
| Screen capture | Yes (needs permission) | Yes |
| Content protection (undetectable) | Yes (NSWindow) | Yes (SetWindowDisplayAffinity) |
| Auto-updater (NSIS) | No (uses DMG) | Yes |
| File paths (%LocalAppData%) | Different | Native |

## Manual Test Checklist

### Authentication
- [ ] Email login with valid credentials
- [ ] Email login with invalid credentials shows error
- [ ] Registration with new account
- [ ] Device code flow (generates code, polls for auth)
- [ ] Google OAuth (opens browser, returns callback)
- [ ] Logout clears tokens and returns to sign-in
- [ ] Token auto-refresh on expiry

### Session Lifecycle
- [ ] Start session from dashboard
- [ ] Start session via keyboard shortcut (Ctrl+Shift+S)
- [ ] Microphone captures audio (audio level indicator moves)
- [ ] Transcript appears in real-time
- [ ] Stop session stops all services
- [ ] Session title/summary auto-generated on stop
- [ ] Session saved to database
- [ ] Session appears in session list

### AI Responses
- [ ] Trigger Assist (Ctrl+Enter or tab click)
- [ ] Streaming response displays progressively
- [ ] Response renders Markdown correctly
- [ ] Copy response to clipboard
- [ ] Switch between tabs (Assist, Say, Follow-up, Recap)
- [ ] Custom question input works
- [ ] Response history preserved

### Overlay Widget
- [ ] Overlay appears on launch
- [ ] Toggle visibility (Ctrl+\)
- [ ] Expand/collapse animation
- [ ] Tab switching
- [ ] Position menu (6 positions)
- [ ] Settings button opens dashboard
- [ ] Clear context button works
- [ ] Start/stop session from overlay pill

### Modes
- [ ] Built-in modes listed (Default, Professional, Interview, Sales)
- [ ] Switch active mode
- [ ] Create custom mode
- [ ] Edit custom mode name and prompt
- [ ] Delete custom mode
- [ ] Cannot delete built-in modes

### Settings
- [ ] Account section shows user info
- [ ] Toggle undetectable mode
- [ ] Toggle smart mode
- [ ] Toggle auto-answer (if Enterprise)
- [ ] Configure auto-answer sensitivity
- [ ] View keyboard shortcuts
- [ ] Settings persist across restart

### Session History
- [ ] Sessions listed with title, date, duration
- [ ] Search sessions by title
- [ ] View session detail (summary, action items, transcript)
- [ ] Export session as Markdown
- [ ] Export session as Plain Text
- [ ] Export session as JSON
- [ ] Delete session

### Sync
- [ ] Sessions upload to cloud after stop
- [ ] Pull remote sessions from other devices
- [ ] Sync status badges on session cards

### System
- [ ] System tray icon appears
- [ ] Tray menu: Start/Stop, Show/Hide Widget, Dashboard, Quit
- [ ] Tray icon changes when session active
- [ ] App stays in tray when window closed
- [ ] Single instance lock (second launch focuses existing)

## Windows Validation Checklist (parity release)

Everything above can be exercised on macOS in dev mode. The items below only
mean something on Windows (Parallels is fine for all of them except real
multi-display and antivirus behaviour). Use the packaged build, not `npm run
dev`: CSP, sandbox, the bundled worklet and the hidden session window behave
differently in production.

Install: run `release/Queen Mama Setup <version>.exe` (built with
`npm run package:win`, or download the `win/v*-beta.*` pre-release). To get
logs, start it from a terminal: `"%LOCALAPPDATA%\Programs\Queen Mama\Queen Mama.exe"`.
`QM_DEVTOOLS=1` opens DevTools on the dashboard and overlay; the hidden session
window logs its warnings/errors to the main process console with a
`[Session WARN|ERROR]` prefix.

### Backend first
- [ ] Staging backend deployed with the CORS middleware (`landing/middleware.ts`).
      Without it every API call fails with `Refused`/`CORS` errors in the
      renderer because `webSecurity` is now on. Temporary escape hatch for
      diagnosis only: launch with `QM_RELAX_WEB_SECURITY=1`.

### Upgrade from the previous product name
- [ ] Install the old build ("Queen Mama Electron"), sign in, create a session.
- [ ] Install the new build over it: `%APPDATA%\Queen Mama Electron` is renamed
      to `%APPDATA%\Queen Mama`, the account is still signed in and the session
      is still listed. Log line `[UserData] Migrated ...`.
- [ ] `%APPDATA%\QueenMama\device-id` unchanged (device count on the account
      did not increase).
- [ ] The installer removed the old build itself (same `appId`); Programs &
      Features shows a single "Queen Mama" entry.

### Hidden session window
- [ ] Only dashboard + overlay visible; no 1x1 window in the taskbar or Alt+Tab.
- [ ] Start a session from the dashboard, minimise the dashboard, close it to
      tray: transcript keeps flowing in the overlay (no throttling).
- [ ] Kill the session renderer (`QM_DEVTOOLS=1`, Task Manager → the extra
      "Queen Mama" renderer process): it reloads within ~1 s, dashboard/overlay
      recover their state (session shown as stopped, auth kept).
- [ ] Sign out in the dashboard: overlay hides, session stops. Sign in again:
      overlay shows, sessions/contacts of that account only.

### Audio (Windows specific)
- [ ] First start asks for microphone permission (Windows privacy dialog); deny
      → "No mic" badge in overlay + toast, system audio still captured.
- [ ] System audio loopback captured without the user picking a window
      (transcript shows "Interlocuteur" lines from a YouTube video while the
      mic is muted).
- [ ] Speakers (no headphones) + Teams/Zoom call: the other person's words do
      not appear under "Moi" (AEC + dedup). Log `[AEC] ERLE` lines every ~4 s
      with a delay that settles (not stuck at 1600).
- [ ] Console shows the AudioWorklet loaded (no `ScriptProcessor fallback`
      warning) in the packaged build.
- [ ] Unplug/replug the headset mid-session: "Mic only"/"No mic" badges update
      within ~3 s, session continues.
- [ ] Dictation (hold the mic button in the overlay) works during a session and
      outside of one.

### Security hardening
- [ ] DevTools console (dashboard + overlay): no `Refused to connect` /
      `Refused to load` CSP errors during sign-in, a session, an AI answer with
      a mermaid diagram and a KaTeX formula, and a Sentry/PostHog event.
- [ ] Paste in the overlay input an AI-style answer containing
      `<img src=x onerror="alert(1)">` inside a markdown block: rendered as text,
      no dialog.
- [ ] Google sign-in: browser opens on `http://127.0.0.1:<port>/callback`; from
      another machine on the LAN `curl http://<pc-ip>:<port>/` is refused.
- [ ] Overlay hidden in a Teams/Zoom/OBS screen share (content protection) while
      still visible locally.

### Shortcuts and overlay
- [ ] Ctrl+Shift+S starts/stops, Ctrl+Shift+H hides/shows the overlay,
      Ctrl+Shift+R clears context. Ctrl+Enter / Ctrl+Arrows in Word or Teams are
      NOT intercepted by the app.
- [ ] Two monitors: drag the overlay to the second screen, expand it: it stays
      on that screen and inside its bounds.
- [ ] Overlay position, dashboard size/position survive a restart.
- [ ] Meeting detection: open Teams/Zoom, the reminder appears; toggle it off in
      Settings and reopen Teams: nothing. `tasklist` is not spawned more than
      every 15 s (Task Manager → Details).

### Install / update
- [ ] Installer and shortcuts named "Queen Mama"; Programs & Features entry too.
- [ ] Uninstall removes `%APPDATA%\Queen Mama` but not the device id.
- [ ] Auto-update from a beta to the next beta (`latest.yml` on the GitHub
      pre-release) downloads and installs on quit.

## Backend Configuration

The app connects to the backend API for auth, AI proxy, transcription tokens, and sync.

```
# Environments (configured in src/services/config/appEnvironment.ts)
Production:  https://queenmama.app
Staging:     https://staging.queenmama.app
Development: http://localhost:3000
```

To use a local backend:
1. Set `VITE_APP_ENV=development` in `.env`
2. Run the backend locally: `cd ../landing && npm run dev`
3. Restart the Electron app

## Architecture Overview

```
electron/main.ts          → Electron main process entry
electron/preload.ts        → Context bridge (IPC security)
electron/windows/          → BrowserWindow management
electron/services/         → Main process services
electron/ipc/              → IPC handlers + channel constants

src/App.tsx                → React entry + router
src/pages/                 → Page components (Dashboard, Overlay, Onboarding)
src/components/            → UI components (auth, dashboard, overlay, common, license)
src/stores/                → Zustand state management (6 stores)
src/services/              → Business logic (audio, transcription, AI, auth, sync, etc.)
src/hooks/                 → React hooks
src/db/                    → SQLite database (Drizzle ORM)
src/types/                 → TypeScript type definitions
src/workers/               → AudioWorklet processor
```

## Troubleshooting

### Microphone not capturing
- Check system permissions (macOS: System Preferences → Privacy → Microphone)
- Verify input device is available
- Check `[AudioCapture]` console logs

### Transcription not connecting
- Verify network connection
- Check `[Transcription]` logs for WebSocket errors
- Ensure proxy config loaded (requires auth)

### AI not responding
- Verify authenticated and license valid
- Check `[AIService]` logs
- Verify proxy config has enabled providers

### Overlay not visible
- Check if content protection is enabled (may hide from screen sharing)
- Toggle with Ctrl+\ shortcut
- Check overlay window position (may be off-screen)
