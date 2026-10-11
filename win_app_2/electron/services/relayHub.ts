import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'
import { IPC_CHANNELS } from '../ipc/channels'
import { getSessionWindow } from '../windows/sessionWindow'
import { safeSendToWindow } from '../utils/ipcUtils'

/**
 * Relay hub: single fan-out point for cross-window state.
 *
 * - `relay:broadcast` from any renderer is forwarded to every other window.
 * - Snapshot channels are cached (with a monotonic `seq`) so a window that
 *   boots late can catch up through `relay:get-snapshot`, and so consumers can
 *   discard out-of-order deliveries.
 * - `session:invoke` is a request/response RPC from UI windows to the hidden
 *   session window.
 */

const SNAPSHOT_CHANNELS = new Set<string>([
  'relay:auth',
  'relay:license',
  'relay:session-state',
  'relay:ai-state',
  'relay:transcript',
  'relay:dictation',
  'relay:mode',
  'relay:audio-health',
])

/**
 * Channels a visible (UI) window is allowed to publish. Everything else is
 * host-only state: accepting it from any renderer would let a compromised
 * overlay/dashboard page spoof the license, the session state or AI output.
 */
const UI_PUBLISHABLE_CHANNELS = new Set<string>(['relay:auth', 'relay:config', 'relay:mode'])

function isSessionSender(sender: Electron.WebContents): boolean {
  const host = getSessionWindow()
  return !!host && !host.isDestroyed() && host.webContents.id === sender.id
}

interface CachedRelay {
  data: unknown
  seq: number
}

const cache = new Map<string, CachedRelay>()
let seqCounter = 0

type SessionStateListener = (state: { isSessionActive: boolean }) => void
const sessionStateListeners = new Set<SessionStateListener>()

export function onSessionStateRelayed(listener: SessionStateListener): () => void {
  sessionStateListeners.add(listener)
  return () => sessionStateListeners.delete(listener)
}

export function getRelaySnapshot(): Record<string, CachedRelay> {
  return Object.fromEntries(cache)
}

function fanOut(channel: string, data: unknown, seq: number, exclude?: Electron.WebContents): number {
  let count = 0
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (exclude && win.webContents.id === exclude.id) continue
    if (safeSendToWindow(win, channel, data, seq)) count++
  }
  return count
}

export function broadcastFromMain(channel: string, data: unknown): void {
  const seq = ++seqCounter
  if (SNAPSHOT_CHANNELS.has(channel)) cache.set(channel, { data, seq })
  fanOut(channel, data, seq)
}

interface PendingInvoke {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingInvokes = new Map<string, PendingInvoke>()
let invokeCounter = 0
const INVOKE_TIMEOUT_MS = 60_000

export function invokeSession(cmd: string, payload: unknown): Promise<unknown> {
  const target = getSessionWindow()
  if (!target || target.isDestroyed()) {
    return Promise.reject(new Error('Session window unavailable'))
  }

  const id = `inv-${++invokeCounter}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingInvokes.delete(id)
      reject(new Error(`Session command timed out: ${cmd}`))
    }, INVOKE_TIMEOUT_MS)
    pendingInvokes.set(id, { resolve, reject, timer })
    const sent = safeSendToWindow(target, IPC_CHANNELS.SESSION_INVOKE_REQUEST, { id, cmd, payload })
    if (!sent) {
      clearTimeout(timer)
      pendingInvokes.delete(id)
      reject(new Error('Session window unavailable'))
    }
  })
}

export function sendToSessionWindow(channel: string, ...args: unknown[]): boolean {
  return safeSendToWindow(getSessionWindow(), channel, ...args)
}

export function registerRelayHub(): void {
  ipcMain.on(IPC_CHANNELS.RELAY_BROADCAST, (event: IpcMainEvent, channel: string, data: unknown) => {
    if (typeof channel !== 'string' || !channel.startsWith('relay:')) return
    if (!isSessionSender(event.sender) && !UI_PUBLISHABLE_CHANNELS.has(channel)) {
      console.warn(`[RelayHub] Dropped ${channel} from non-host renderer ${event.sender.id}`)
      return
    }
    const seq = ++seqCounter
    if (SNAPSHOT_CHANNELS.has(channel)) cache.set(channel, { data, seq })
    fanOut(channel, data, seq, event.sender)

    if (channel === 'relay:session-state' && data && typeof data === 'object') {
      const state = data as { isSessionActive?: boolean }
      if (typeof state.isSessionActive === 'boolean') {
        for (const listener of sessionStateListeners) {
          try {
            listener({ isSessionActive: state.isSessionActive })
          } catch (err) {
            console.error('[RelayHub] session-state listener failed:', err)
          }
        }
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.RELAY_GET_SNAPSHOT, () => getRelaySnapshot())

  ipcMain.handle(IPC_CHANNELS.SESSION_INVOKE, async (event, cmd: string, payload: unknown) => {
    if (isSessionSender(event.sender)) {
      return { ok: false, error: 'Session window cannot invoke itself' }
    }
    if (typeof cmd !== 'string') {
      return { ok: false, error: 'Invalid command' }
    }
    try {
      const result = await invokeSession(cmd, payload)
      return { ok: true, result }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.on(
    IPC_CHANNELS.SESSION_INVOKE_RESPONSE,
    (event, response: { id: string; ok: boolean; result?: unknown; error?: string }) => {
      // Only the session window may answer commands (prevents response spoofing)
      if (!isSessionSender(event.sender)) {
        console.warn(`[RelayHub] Dropped invoke response from non-host renderer ${event.sender.id}`)
        return
      }
      if (!response || typeof response.id !== 'string') return
      const pending = pendingInvokes.get(response.id)
      if (!pending) return
      clearTimeout(pending.timer)
      pendingInvokes.delete(response.id)
      if (response.ok) {
        pending.resolve(response.result)
      } else {
        pending.reject(new Error(response.error || 'Session command failed'))
      }
    },
  )
}
