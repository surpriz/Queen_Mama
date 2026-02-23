import { useState, useEffect, useRef, useCallback } from 'react'
import { DisplaySelector } from './DisplaySelector'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { SignInChoice } from '@/components/auth/SignInChoice'
import {
  performFullSync,
  getPendingCount,
  getLastSyncTime,
  isNetworkOnline,
} from '@/services/sync/syncManager'

export function SettingsView() {
  const config = useConfigStore()
  const license = useLicenseStore()
  const { currentUser, logout } = useAuth()
  const { isAuthenticated } = useAuthStore()
  const [showSignIn, setShowSignIn] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  useEffect(() => {
    // Fetch app version on mount
    const api = (window as unknown as { electronAPI: {
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<boolean>
      onUpdaterStatus: (cb: (payload: { status: string; data?: unknown }) => void) => () => void
    } }).electronAPI
    if (api?.getVersion) {
      api.getVersion().then((v) => setAppVersion(v)).catch(() => {})
    }
    // Listen for updater status events
    let cleanup: (() => void) | undefined
    if (api?.onUpdaterStatus) {
      cleanup = api.onUpdaterStatus((payload) => {
        setIsCheckingUpdate(false)
        switch (payload.status) {
          case 'checking-for-update':
            setUpdateStatus('Checking for updates...')
            setIsCheckingUpdate(true)
            break
          case 'update-available':
            setUpdateStatus('Update available! Downloading...')
            break
          case 'update-not-available':
            setUpdateStatus('You are on the latest version.')
            break
          case 'download-progress': {
            const progress = payload.data as { percent?: number } | undefined
            const pct = progress?.percent ? Math.round(progress.percent) : 0
            setUpdateStatus(`Downloading update... ${pct}%`)
            break
          }
          case 'update-downloaded':
            setUpdateStatus('Update downloaded. It will be installed on restart.')
            break
          case 'update-error':
            setUpdateStatus('Update check failed.')
            break
          default:
            break
        }
      })
    }
    return () => cleanup?.()
  }, [])

  const handleCheckForUpdates = () => {
    const api = (window as unknown as { electronAPI: {
      checkForUpdates: () => Promise<boolean>
    } }).electronAPI
    if (api?.checkForUpdates) {
      setIsCheckingUpdate(true)
      setUpdateStatus('Checking for updates...')
      api.checkForUpdates().catch(() => {
        setIsCheckingUpdate(false)
        setUpdateStatus('Update check failed.')
      })
    }
  }

  const handleToggle = (key: keyof typeof config, value: boolean) => {
    config.updateConfig({ [key]: value })
  }

  const handleSyncNow = async () => {
    setIsSyncing(true)
    try {
      await performFullSync()
    } catch {
      // sync errors are logged internally
    } finally {
      setIsSyncing(false)
    }
  }

  const pendingCount = getPendingCount()
  const lastSync = getLastSyncTime()
  const online = isNetworkOnline()

  // Determine sync status: green = synced, yellow = pending, gray = not synced
  let syncColor = 'bg-gray-500' // not synced / offline
  let syncLabel = 'Not synced'
  if (online && pendingCount === 0 && lastSync) {
    syncColor = 'bg-green-500'
    syncLabel = 'Synced'
  } else if (online && pendingCount > 0) {
    syncColor = 'bg-yellow-500'
    syncLabel = `${pendingCount} pending`
  } else if (!online) {
    syncLabel = 'Offline'
  }

  return (
    <div className="flex flex-col h-full p-6 pr-8 overflow-y-auto">
      <h2 className="text-title-sm font-semibold text-qm-text-primary mb-6">Settings</h2>

      <div className="space-y-8 max-w-2xl">
        {/* Account */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Account</h3>
          {!isAuthenticated ? (
            showSignIn ? (
              <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
                <SignInChoice />
              </div>
            ) : (
              <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
                <p className="text-body-sm text-qm-text-secondary">
                  You are not signed in. Sign in to enable transcription and AI features.
                </p>
                <button
                  onClick={() => setShowSignIn(true)}
                  className="w-full px-4 py-2 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-all"
                >
                  Sign In
                </button>
              </div>
            )
          ) : (
            <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-body-sm text-qm-text-secondary">Email</span>
                <span className="text-body-sm text-qm-text-primary">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-body-sm text-qm-text-secondary">Plan</span>
                <span className="text-body-sm text-qm-accent font-medium capitalize">
                  {license.currentLicense.plan}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="w-full mt-2 px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-error-light text-body-sm text-qm-text-secondary hover:text-qm-error transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </section>

        {/* Language */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Language</h3>
          <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-body-sm text-qm-text-primary">App Language</p>
                <p className="text-caption text-qm-text-tertiary">
                  Language for transcription and AI responses
                </p>
              </div>
              <select
                value={config.primaryLanguage}
                onChange={(e) => config.updateConfig({ primaryLanguage: e.target.value })}
                className="text-body-sm rounded-qm-md px-3 py-1.5 border border-qm-border-subtle outline-none focus:border-qm-accent"
                style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}
              >
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="fr">Fran&#231;ais</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="en">English</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="es">Espa&#241;ol</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="de">Deutsch</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="it">Italiano</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="pt">Portugu&#234;s</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="nl">Nederlands</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="ja">&#26085;&#26412;&#35486;</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="zh">&#20013;&#25991;</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="ko">&#54620;&#44397;&#50612;</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="ar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="ru">&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="multi">Auto-detect (multilingual)</option>
              </select>
            </div>
          </div>
        </section>

        {/* General */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">General</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Smart Mode"
              description="Enhanced AI reasoning (Enterprise)"
              enabled={config.smartModeEnabled}
              onToggle={(v) => handleToggle('smartModeEnabled', v)}
            />
            <ToggleRow
              label="Undetectable Overlay"
              description="Hide overlay from screen sharing (Enterprise)"
              enabled={config.isUndetectabilityEnabled}
              onToggle={(v) => handleToggle('isUndetectabilityEnabled', v)}
            />
            <ToggleRow
              label="Auto Screen Capture"
              description="Automatically capture screenshots"
              enabled={config.autoScreenCapture}
              onToggle={(v) => handleToggle('autoScreenCapture', v)}
            />
            {config.autoScreenCapture && (
              <>
                <SliderRow
                  label="Capture Interval"
                  description="Time between automatic screen captures"
                  value={config.screenCaptureIntervalSeconds}
                  min={1}
                  max={30}
                  step={1}
                  displayValue={`${config.screenCaptureIntervalSeconds}s`}
                  onChange={(v) => config.updateConfig({ screenCaptureIntervalSeconds: v })}
                />
                <DisplaySelector />
              </>
            )}
          </div>
        </section>

        {/* Audio */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Audio</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Capture Microphone"
              description="Record your voice during sessions"
              enabled={config.captureMicrophone}
              onToggle={(v) => handleToggle('captureMicrophone', v)}
            />
            <ToggleRow
              label="Capture System Audio"
              description="Record other participants' audio"
              enabled={config.captureSystemAudio}
              onToggle={(v) => handleToggle('captureSystemAudio', v)}
            />
            <AudioLevelTest />
          </div>
        </section>

        {/* Auto-Answer */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Auto-Answer</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Enable Auto-Answer"
              description="Automatically trigger AI based on conversation flow (Enterprise)"
              enabled={config.autoAnswerEnabled}
              onToggle={(v) => handleToggle('autoAnswerEnabled', v)}
            />
            <SliderRow
              label="Silence Threshold"
              description="Duration of silence before auto-answer triggers"
              value={config.autoAnswerSilenceThreshold}
              min={1.0}
              max={5.0}
              step={0.5}
              displayValue={`${config.autoAnswerSilenceThreshold}s`}
              onChange={(v) => config.updateConfig({ autoAnswerSilenceThreshold: v })}
            />
            <SliderRow
              label="Cooldown"
              description="Minimum time between auto-answer triggers"
              value={config.autoAnswerCooldown}
              min={5}
              max={30}
              step={1}
              displayValue={`${config.autoAnswerCooldown}s`}
              onChange={(v) => config.updateConfig({ autoAnswerCooldown: v })}
            />
            <div className="flex items-start justify-between py-2 gap-4">
              <div className="flex-1">
                <p className="text-body-sm text-qm-text-primary">Response Type</p>
                <p className="text-caption text-qm-text-tertiary">
                  Which response type auto-answer triggers
                </p>
              </div>
              <select
                value={config.autoAnswerResponseType || 'assist'}
                onChange={(e) => config.updateConfig({ autoAnswerResponseType: e.target.value })}
                className="text-body-sm rounded-qm-md px-3 py-1.5 border border-qm-border-subtle outline-none focus:border-qm-accent"
                style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}
              >
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="assist">Assist</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="what_should_i_say">What Should I Say</option>
                <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="follow_up">Follow-up</option>
              </select>
            </div>
          </div>
        </section>

        {/* Proactive Suggestions */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">
            Proactive Suggestions
          </h3>
          <div className="space-y-3">
            <ToggleRow
              label="Enable Proactive Mode"
              description="Detect conversation moments and suggest responses automatically"
              enabled={config.proactiveEnabled}
              onToggle={(v) => handleToggle('proactiveEnabled', v)}
            />
            {config.proactiveEnabled && (
              <>
                <SliderRow
                  label="Detection Sensitivity"
                  description="How sensitive the proactive detection is"
                  value={config.proactiveSensitivity}
                  min={0.5}
                  max={1.0}
                  step={0.05}
                  displayValue={`${Math.round(config.proactiveSensitivity * 100)}%`}
                  onChange={(v) => config.updateConfig({ proactiveSensitivity: v })}
                />
                <SliderRow
                  label="Cooldown Between Suggestions"
                  description="Minimum time between proactive suggestions"
                  value={config.proactiveCooldown}
                  min={5}
                  max={60}
                  step={5}
                  displayValue={`${config.proactiveCooldown}s`}
                  onChange={(v) => config.updateConfig({ proactiveCooldown: v })}
                />
                <ToggleRow
                  label="Objection Detection"
                  description="Detect sales objections and suggest counter-arguments"
                  enabled={config.proactiveObjectionsEnabled}
                  onToggle={(v) => handleToggle('proactiveObjectionsEnabled', v)}
                />
                <ToggleRow
                  label="Question Detection"
                  description="Detect technical/expertise questions"
                  enabled={config.proactiveQuestionsEnabled}
                  onToggle={(v) => handleToggle('proactiveQuestionsEnabled', v)}
                />
                <ToggleRow
                  label="Hesitation Detection"
                  description="Detect when you hesitate and suggest talking points"
                  enabled={config.proactiveHesitationsEnabled}
                  onToggle={(v) => handleToggle('proactiveHesitationsEnabled', v)}
                />
                <ToggleRow
                  label="Closing Opportunity"
                  description="Detect closing signals and suggest next steps"
                  enabled={config.proactiveClosingEnabled}
                  onToggle={(v) => handleToggle('proactiveClosingEnabled', v)}
                />
              </>
            )}
          </div>
        </section>

        {/* Sync */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Sync</h3>
          <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${syncColor}`} />
                <span className="text-body-sm text-qm-text-primary">Cloud Sync</span>
              </div>
              <span className="text-body-sm text-qm-text-secondary">{syncLabel}</span>
            </div>
            {lastSync && (
              <p className="text-caption text-qm-text-tertiary">
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}
            <p className="text-caption text-qm-text-tertiary">
              Sync is available for Pro subscribers
            </p>
            {isAuthenticated && (
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="w-full px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-pressed text-body-sm text-qm-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        </section>

        {/* Updates */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Updates</h3>
          <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
            <div className="flex items-start justify-between py-2 gap-4">
              <div className="flex-1">
                <p className="text-body-sm text-qm-text-primary">App Version</p>
                <p className="text-caption text-qm-text-tertiary">Currently installed version</p>
              </div>
              <span className="text-body-sm text-qm-accent font-medium">
                {appVersion || '...'}
              </span>
            </div>
            {updateStatus && (
              <p className="text-caption text-qm-text-tertiary">{updateStatus}</p>
            )}
            <button
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate}
              className="w-full px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-pressed text-body-sm text-qm-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">
            Keyboard Shortcuts
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Start/Stop Session</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Shift+S" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Toggle Widget</span>
              <KeyboardShortcutBadge shortcut="Ctrl+\\" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Trigger AI Assist</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Enter" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Clear Context</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Shift+R" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between py-2 gap-4">
      <div className="flex-1">
        <p className="text-body-sm text-qm-text-primary">{label}</p>
        <p className="text-caption text-qm-text-tertiary">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-11 h-6 mt-0.5 rounded-full transition-colors outline-none focus:outline-none flex-shrink-0 overflow-hidden ${
          enabled ? 'bg-qm-accent' : 'bg-qm-surface-pressed'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-start justify-between py-2 gap-4">
      <div className="flex-1">
        <p className="text-body-sm text-qm-text-primary">{label}</p>
        {description && <p className="text-caption text-qm-text-tertiary">{description}</p>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 h-1.5 accent-qm-accent bg-qm-surface-pressed rounded-full appearance-none cursor-pointer"
        />
        <span className="text-body-sm text-qm-accent font-medium w-12 text-right">{displayValue}</span>
      </div>
    </div>
  )
}

const LEVEL_SEGMENTS = 20
const SEGMENT_COLORS = [
  // Green (0-12)
  ...Array(12).fill('bg-emerald-500'),
  // Yellow (13-16)
  ...Array(4).fill('bg-yellow-500'),
  // Red (17-20)
  ...Array(4).fill('bg-red-500'),
]

function AudioLevelTest() {
  const [isTesting, setIsTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)

  const stopTest = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    contextRef.current?.close()
    streamRef.current = null
    contextRef.current = null
    setLevel(0)
    setIsTesting(false)
  }, [])

  const startTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      streamRef.current = stream
      const ctx = new AudioContext()
      contextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / dataArray.length)
        // Scale to 0-1 with some amplification
        setLevel(Math.min(1, rms * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
      setIsTesting(true)
    } catch {
      setIsTesting(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      contextRef.current?.close()
    }
  }, [])

  const activeSegments = Math.round(level * LEVEL_SEGMENTS)

  return (
    <div className="pt-3 border-t border-qm-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-body-sm text-qm-text-primary">Audio Level Test</p>
          <p className="text-caption text-qm-text-tertiary">Check your microphone input</p>
        </div>
        <button
          onClick={isTesting ? stopTest : startTest}
          className={`px-3 py-1.5 rounded-qm-md text-caption font-medium transition-colors ${
            isTesting
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-qm-accent/20 text-qm-accent hover:bg-qm-accent/30'
          }`}
        >
          {isTesting ? 'Stop Test' : 'Start Test'}
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: LEVEL_SEGMENTS }).map((_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 rounded-sm transition-opacity ${SEGMENT_COLORS[i]} ${
              i < activeSegments ? 'opacity-100' : 'opacity-15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
