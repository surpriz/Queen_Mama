/**
 * Meeting Detection Service (Main Process)
 *
 * Detects active meeting/call applications while no session is running and
 * asks the user to start one (30-minute cooldown per app).
 *
 * Cost model (the previous version spawned `powershell.exe Get-Process` every
 * 15–60 s, ~1 s of CPU per scan and a frequent antivirus trigger):
 *  - Process scan: `tasklist /FO CSV /NH` every 20 s — a native tool with no
 *    runtime start-up, ~50 ms. Enough for apps where "running" ≈ "in a call"
 *    (Zoom, WebEx) and to know whether Teams / Slack / Discord / a browser is
 *    running at all.
 *  - Window-title scan (PowerShell, the only way to read titles without a
 *    native module): only when one of the title-based apps is running, at most
 *    every 30 s.
 *  - Nothing runs while a session is active or when the user disabled the
 *    feature (`config.meetingDetectionEnabled` in electron-store).
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import Store from 'electron-store'
import { IPC_CHANNELS } from '../ipc/channels'
import { safeSendToAllWindows } from '../utils/ipcUtils'

const execAsync = promisify(exec)
const store = new Store()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WindowInfo {
  processName: string
  windowTitle: string
}

interface MeetingApp {
  /** Human-readable name shown in the reminder */
  displayName: string
  /** Process names to match (lowercase, without .exe) */
  processNames: string[]
  /**
   * Optional function to further validate by window title.
   * If not provided, the process name match alone is sufficient.
   */
  titleMatcher?: (title: string) => boolean
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROCESS_SCAN_INTERVAL_MS = 20_000
const TITLE_SCAN_MIN_INTERVAL_MS = 30_000
const COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Meeting app definitions.
 * Order matters: first match wins for a given poll cycle.
 */
const MEETING_APPS: MeetingApp[] = [
  {
    displayName: 'Zoom',
    processNames: ['zoom'],
    // Zoom running = meeting in progress (users rarely leave it open idle)
  },
  {
    displayName: 'WebEx',
    processNames: ['webexmta', 'ciscocollabhost', 'atmgr', 'webex'],
    // The meeting host processes only exist during a call
  },
  {
    displayName: 'Microsoft Teams',
    processNames: ['teams', 'ms-teams'],
    titleMatcher: (title: string) => {
      // Teams is often open in the background. Only trigger for likely meeting windows.
      const lower = title.toLowerCase()
      const idlePrefixes = [
        'microsoft teams',
        'chat ',
        'conversation ',
        'activity',
        'calendar',
        'files',
        'calls',
        'teams',
        'people',
        'settings',
        'notifications',
      ]
      if (idlePrefixes.some((p) => lower.startsWith(p)) || lower === '' || lower === 'microsoft teams') {
        return false
      }
      return true
    },
  },
  {
    displayName: 'Google Meet',
    // Detected via browser window titles, not a standalone process
    processNames: ['chrome', 'msedge', 'firefox', 'brave', 'arc'],
    titleMatcher: (title: string) => {
      const lower = title.toLowerCase()
      return (
        lower.includes('google meet') ||
        lower.includes('meet.google.com') ||
        // Google Meet tab titles: "Meet - <name>" or "Meet – <name>"
        /\bmeet\s*[-–—]/.test(lower)
      )
    },
  },
  {
    displayName: 'Slack Huddle',
    processNames: ['slack'],
    titleMatcher: (title: string) => title.toLowerCase().includes('huddle'),
  },
  {
    displayName: 'Discord',
    processNames: ['discord'],
    titleMatcher: (title: string) => {
      const lower = title.toLowerCase()
      return lower.includes('voice connected') || lower.includes('screen share')
    },
  },
]

const TITLE_BASED_PROCESSES = new Set(
  MEETING_APPS.filter((a) => a.titleMatcher).flatMap((a) => a.processNames),
)

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** `tasklist /FO CSV /NH` → "Image Name","PID","Session Name","Session#","Mem Usage" */
const TASKLIST_COMMAND = 'tasklist /FO CSV /NH'

/** PowerShell window-title enumeration (only for apps that need titles). */
const PS_TITLES_COMMAND = [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object { $_.ProcessName + '|' + $_.MainWindowTitle }`,
].join(' ')

// ---------------------------------------------------------------------------
// Service State
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setTimeout> | null = null
let isMonitoring = false
let isSessionActive = false
let lastTitleScanAt = 0
let onMeetingDetectedCallback: ((appName: string) => void) | null = null

export function setOnMeetingDetected(cb: (appName: string) => void): void {
  onMeetingDetectedCallback = cb
}

/** Per-app cooldown map: displayName -> last triggered timestamp */
const cooldowns = new Map<string, number>()

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

/** Lowercase process names (without .exe) of everything running. */
async function getRunningProcesses(): Promise<Set<string>> {
  if (process.platform !== 'win32') return new Set()
  try {
    const { stdout } = await execAsync(TASKLIST_COMMAND, {
      encoding: 'utf-8',
      timeout: 8_000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    })
    const names = new Set<string>()
    for (const line of stdout.split('\n')) {
      // First CSV field, quoted: "zoom.exe"
      const match = line.match(/^"([^"]+)"/)
      if (!match) continue
      names.add(match[1].toLowerCase().replace(/\.exe$/, ''))
    }
    return names
  } catch (error) {
    console.error('[MeetingDetection] tasklist failed:', error)
    return new Set()
  }
}

async function getVisibleWindows(): Promise<WindowInfo[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execAsync(PS_TITLES_COMMAND, {
      encoding: 'utf-8',
      timeout: 10_000,
      windowsHide: true,
    })
    const lines = stdout.trim().split('\n').filter(Boolean)
    return lines.map((line) => {
      const pipeIndex = line.indexOf('|')
      if (pipeIndex === -1) {
        return { processName: line.trim().toLowerCase(), windowTitle: '' }
      }
      return {
        processName: line.substring(0, pipeIndex).trim().toLowerCase(),
        windowTitle: line.substring(pipeIndex + 1).trim(),
      }
    })
  } catch (error) {
    console.error('[MeetingDetection] Failed to enumerate windows:', error)
    return []
  }
}

function processMatches(app: MeetingApp, name: string): boolean {
  return app.processNames.some((pn) => name === pn || name.startsWith(pn))
}

// ---------------------------------------------------------------------------
// Detection Logic
// ---------------------------------------------------------------------------

async function scanForMeetings(): Promise<void> {
  if (!isMonitoring || isSessionActive) return

  const running = await getRunningProcesses()
  if (running.size === 0) return

  // 1. Process-only apps (Zoom, WebEx): running means in a call
  for (const app of MEETING_APPS) {
    if (app.titleMatcher) continue
    if ([...running].some((name) => processMatches(app, name))) {
      console.log(`[MeetingDetection] Meeting app detected: ${app.displayName} (process running)`)
      triggerIfEligible(app.displayName)
      return
    }
  }

  // 2. Title-based apps: only pay for the PowerShell scan when one is running
  const needsTitles = [...running].some((name) => [...TITLE_BASED_PROCESSES].some((pn) => name === pn || name.startsWith(pn)))
  if (!needsTitles) return
  const now = Date.now()
  if (now - lastTitleScanAt < TITLE_SCAN_MIN_INTERVAL_MS) return
  lastTitleScanAt = now

  const windows = await getVisibleWindows()
  if (windows.length === 0) return

  for (const app of MEETING_APPS) {
    if (!app.titleMatcher) continue
    const matching = windows.filter((w) => processMatches(app, w.processName) && app.titleMatcher!(w.windowTitle))
    if (matching.length > 0) {
      console.log(`[MeetingDetection] Active call detected in ${app.displayName}: ${JSON.stringify(matching.map((w) => w.windowTitle))}`)
      triggerIfEligible(app.displayName)
      return
    }
  }
}

function triggerIfEligible(appName: string): void {
  const lastTriggered = cooldowns.get(appName) ?? 0
  const now = Date.now()
  if (now - lastTriggered < COOLDOWN_MS) {
    return
  }

  cooldowns.set(appName, now)
  console.log(`[MeetingDetection] Triggering reminder for: ${appName}`)

  // Show notification window before IPC arrives at renderer
  onMeetingDetectedCallback?.(appName)

  // Send IPC to all renderer windows
  safeSendToAllWindows(IPC_CHANNELS.MEETING_DETECTED, { appName })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** User preference (Settings → meeting reminders); defaults to enabled. */
export function isDetectionEnabledByUser(): boolean {
  return store.get('config.meetingDetectionEnabled') !== false
}

/**
 * Start monitoring for meeting applications (no-op when the user disabled it).
 * Performs an immediate scan and then polls every 20 seconds.
 */
export function startMonitoring(): void {
  if (isMonitoring) {
    console.log('[MeetingDetection] Already monitoring')
    return
  }
  if (!isDetectionEnabledByUser()) {
    console.log('[MeetingDetection] Disabled by user setting')
    return
  }

  isMonitoring = true
  console.log('[MeetingDetection] Started monitoring (tasklist every 20s, titles ≤ every 30s, cooldown: 30min)')
  void runScanLoop()
}

async function runScanLoop(): Promise<void> {
  if (!isMonitoring) return

  await scanForMeetings()

  if (!isMonitoring) return
  pollTimer = setTimeout(() => void runScanLoop(), PROCESS_SCAN_INTERVAL_MS)
}

/**
 * Stop monitoring for meeting applications.
 */
export function stopMonitoring(): void {
  if (!isMonitoring) return

  isMonitoring = false

  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }

  console.log('[MeetingDetection] Stopped monitoring')
}

/**
 * Update the session active state so the service knows whether to skip detection.
 * Called from the main process when session state changes.
 */
export function setSessionActive(active: boolean): void {
  isSessionActive = active
  console.log(`[MeetingDetection] Session active state updated: ${active}`)
}

/**
 * Clear all cooldowns (e.g., for testing or settings reset).
 */
export function resetCooldowns(): void {
  cooldowns.clear()
  console.log('[MeetingDetection] Cooldowns reset')
}

/**
 * Check whether monitoring is currently active.
 */
export function getIsMonitoring(): boolean {
  return isMonitoring
}
