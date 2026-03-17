/**
 * Meeting Detection Service (Main Process)
 *
 * Polls running Windows processes every 15 seconds using PowerShell
 * to detect active meeting/call applications. When a meeting is detected
 * and no session is active, sends an IPC message to the renderer.
 *
 * Supported apps:
 * - Zoom (Zoom.exe)
 * - Microsoft Teams (Teams.exe / ms-teams.exe)
 * - Google Meet (browser window title)
 * - Slack Huddle (Slack.exe + "Huddle" in title)
 * - Discord Voice (Discord.exe + "Voice Connected" in title)
 *
 * Uses a 30-minute cooldown per app to avoid spamming reminders.
 */

import { execSync } from 'child_process'
import { IPC_CHANNELS } from '../ipc/channels'
import { safeSendToAllWindows } from '../utils/ipcUtils'

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

const POLL_INTERVAL_MS = 15_000 // 15 seconds
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
    displayName: 'Microsoft Teams',
    processNames: ['teams', 'ms-teams'],
    titleMatcher: (title: string) => {
      // Teams is often open in the background. Only trigger for likely meeting windows.
      const lower = title.toLowerCase()
      // Idle / non-meeting titles to ignore
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
      // Anything else (meeting title, "Meeting with...") is likely an active call
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
        // Google Meet tab titles: "Meet - <name>" or "Meet \u2013 <name>"
        /\bmeet\s*[-\u2013\u2014]/.test(lower)
      )
    },
  },
  {
    displayName: 'Slack Huddle',
    processNames: ['slack'],
    titleMatcher: (title: string) => {
      return title.toLowerCase().includes('huddle')
    },
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

// ---------------------------------------------------------------------------
// PowerShell command to enumerate visible windows with process names + titles
// ---------------------------------------------------------------------------

/**
 * PowerShell script that lists all visible windows with their process name
 * and window title, separated by a pipe delimiter.
 *
 * Output format (one per line):
 *   ProcessName|WindowTitle
 *
 * We use Get-Process with a MainWindowTitle filter to only list processes
 * that have a visible window (avoids background services).
 */
const PS_COMMAND = [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object { $_.ProcessName + '|' + $_.MainWindowTitle }`,
].join(' ')

// ---------------------------------------------------------------------------
// Service State
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setInterval> | null = null
let isMonitoring = false
let isSessionActive = false
let onMeetingDetectedCallback: ((appName: string) => void) | null = null

export function setOnMeetingDetected(cb: (appName: string) => void): void {
  onMeetingDetectedCallback = cb
}

/** Per-app cooldown map: displayName -> last triggered timestamp */
const cooldowns = new Map<string, number>()

// ---------------------------------------------------------------------------
// Window Enumeration
// ---------------------------------------------------------------------------

function getVisibleWindows(): WindowInfo[] {
  try {
    const stdout = execSync(PS_COMMAND, {
      encoding: 'utf-8',
      timeout: 10_000, // 10s timeout to avoid hanging
      windowsHide: true, // hide the PowerShell console window
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
    // PowerShell may fail on non-Windows or if the command times out
    console.error('[MeetingDetection] Failed to enumerate windows:', error)
    return []
  }
}

// ---------------------------------------------------------------------------
// Detection Logic
// ---------------------------------------------------------------------------

function scanForMeetings(): void {
  if (!isMonitoring) return

  // Skip scan if a session is already active
  if (isSessionActive) {
    return
  }

  const windows = getVisibleWindows()
  if (windows.length === 0) return

  for (const app of MEETING_APPS) {
    // Find all windows belonging to this app's processes
    const matchingWindows = windows.filter((w) =>
      app.processNames.some((pn) => w.processName === pn || w.processName.startsWith(pn))
    )

    if (matchingWindows.length === 0) continue

    // If the app has a title matcher, at least one window must pass it
    let detected = false
    if (app.titleMatcher) {
      detected = matchingWindows.some((w) => app.titleMatcher!(w.windowTitle))
      if (detected) {
        const matchedTitles = matchingWindows
          .filter((w) => app.titleMatcher!(w.windowTitle))
          .map((w) => w.windowTitle)
        console.log(
          `[MeetingDetection] Active call detected in ${app.displayName}: ${JSON.stringify(matchedTitles)}`
        )
      }
    } else {
      // Process match alone is enough (e.g., Zoom)
      detected = true
      console.log(
        `[MeetingDetection] Meeting app detected: ${app.displayName} (process running)`
      )
    }

    if (detected) {
      triggerIfEligible(app.displayName)
      // Only trigger for the first detected app per scan cycle
      return
    }
  }
}

function triggerIfEligible(appName: string): void {
  // Check cooldown
  const lastTriggered = cooldowns.get(appName) ?? 0
  const now = Date.now()
  if (now - lastTriggered < COOLDOWN_MS) {
    console.log(
      `[MeetingDetection] ${appName} in cooldown (${Math.round((COOLDOWN_MS - (now - lastTriggered)) / 60_000)}min remaining)`
    )
    return
  }

  // Record cooldown
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

/**
 * Start monitoring for meeting applications.
 * Performs an immediate scan and then polls every 15 seconds.
 */
export function startMonitoring(): void {
  if (isMonitoring) {
    console.log('[MeetingDetection] Already monitoring')
    return
  }

  isMonitoring = true
  console.log('[MeetingDetection] Started monitoring (poll interval: 15s, cooldown: 30min)')

  // Immediate scan
  scanForMeetings()

  // Periodic polling
  pollTimer = setInterval(scanForMeetings, POLL_INTERVAL_MS)
}

/**
 * Stop monitoring for meeting applications.
 */
export function stopMonitoring(): void {
  if (!isMonitoring) return

  isMonitoring = false

  if (pollTimer) {
    clearInterval(pollTimer)
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
