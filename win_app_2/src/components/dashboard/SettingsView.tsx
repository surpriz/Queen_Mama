import { useState, useEffect, useRef, useCallback } from 'react'
import { User, Settings as SettingsIcon, Zap, Volume2, Cloud, Keyboard, Download, MessageSquareText, Crosshair } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DisplaySelector } from './DisplaySelector'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { SignInChoice } from '@/components/auth/SignInChoice'
import { cn } from '@/lib/utils'
import {
  performFullSync,
  getPendingCount,
  getLastSyncTime,
  isNetworkOnline,
} from '@/services/sync/syncManager'

type SettingsTab = 'account' | 'general' | 'autoAnswer' | 'proactive' | 'audio' | 'sync' | 'shortcuts' | 'updates'

export function SettingsView() {
  const { t } = useTranslation('dashboard')
  const config = useConfigStore()
  const license = useLicenseStore()
  const { currentUser, logout } = useAuth()
  const { isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [showSignIn, setShowSignIn] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  const TABS: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'account', label: t('settings.tabs.account'), icon: User },
    { id: 'general', label: t('settings.tabs.general'), icon: SettingsIcon },
    { id: 'autoAnswer', label: t('settings.tabs.autoAnswer'), icon: Zap },
    { id: 'proactive', label: t('settings.tabs.proactive'), icon: Crosshair },
    { id: 'audio', label: t('settings.tabs.audio'), icon: Volume2 },
    { id: 'sync', label: t('settings.tabs.sync'), icon: Cloud },
    { id: 'shortcuts', label: t('settings.tabs.shortcuts'), icon: Keyboard },
    { id: 'updates', label: t('settings.tabs.updates'), icon: Download },
  ]

  useEffect(() => {
    const api = (window as unknown as { electronAPI: {
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<boolean>
      onUpdaterStatus: (cb: (payload: { status: string; data?: unknown }) => void) => () => void
    } }).electronAPI
    if (api?.getVersion) {
      api.getVersion().then((v) => setAppVersion(v)).catch(() => {})
    }
    let cleanup: (() => void) | undefined
    if (api?.onUpdaterStatus) {
      cleanup = api.onUpdaterStatus((payload) => {
        setIsCheckingUpdate(false)
        switch (payload.status) {
          case 'checking-for-update':
            setUpdateStatus(t('settings.updates.checkingForUpdate'))
            setIsCheckingUpdate(true)
            break
          case 'update-available':
            setUpdateStatus(t('settings.updates.updateAvailable'))
            break
          case 'update-not-available':
            setUpdateStatus(t('settings.updates.upToDate'))
            break
          case 'download-progress': {
            const progress = payload.data as { percent?: number } | undefined
            const pct = progress?.percent ? Math.round(progress.percent) : 0
            setUpdateStatus(t('settings.updates.downloadProgress', { percent: pct }))
            break
          }
          case 'update-downloaded':
            setUpdateStatus(t('settings.updates.updateDownloaded'))
            setUpdateReady(true)
            break
          case 'update-error':
            setUpdateStatus(t('settings.updates.updateError'))
            break
          default:
            break
        }
      })
    }
    return () => cleanup?.()
  }, [t])

  const handleCheckForUpdates = () => {
    const api = (window as unknown as { electronAPI: {
      checkForUpdates: () => Promise<boolean>
    } }).electronAPI
    if (api?.checkForUpdates) {
      setIsCheckingUpdate(true)
      setUpdateStatus(t('settings.updates.checkingForUpdate'))
      api.checkForUpdates().catch(() => {
        setIsCheckingUpdate(false)
        setUpdateStatus(t('settings.updates.updateError'))
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

  let syncColor = 'bg-gray-500'
  let syncLabel = t('status.notSynced', { ns: 'common' })
  if (online && pendingCount === 0 && lastSync) {
    syncColor = 'bg-green-500'
    syncLabel = t('status.synced', { ns: 'common' })
  } else if (online && pendingCount > 0) {
    syncColor = 'bg-yellow-500'
    syncLabel = t('status.nPending', { ns: 'common', count: pendingCount })
  } else if (!online) {
    syncLabel = t('status.offline', { ns: 'common' })
  }

  return (
    <div className="flex h-full">
      {/* Left tab sidebar */}
      <div className="w-[200px] flex flex-col border-r border-qm-border-subtle py-4">
        <h2 className="text-title-sm font-semibold text-qm-text-primary px-4 mb-4">{t('settings.title')}</h2>
        <nav className="flex-1 px-2 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-qm-md text-body-sm transition-colors',
                activeTab === id
                  ? 'bg-qm-accent/10 text-qm-accent border border-qm-accent/30'
                  : 'text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary border border-transparent',
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Version + Feedback at bottom */}
        <div className="px-4 pt-3 border-t border-qm-border-subtle space-y-2">
          {appVersion && (
            <p className="text-caption-sm text-qm-text-tertiary">v{appVersion}</p>
          )}
          <button
            onClick={() => window.open('https://queenmama.co/feedback', '_blank')}
            className="flex items-center gap-1 text-caption-sm text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
          >
            <MessageSquareText size={10} />
            {t('giveFeedback', { ns: 'common' })}
          </button>
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 overflow-y-auto p-6 pr-8">
        <div className="max-w-2xl space-y-6">
          {activeTab === 'account' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.account.title')}</h3>
              {!isAuthenticated ? (
                showSignIn ? (
                  <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
                    <SignInChoice />
                  </div>
                ) : (
                  <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
                    <p className="text-body-sm text-qm-text-secondary">
                      {t('auth.notSignedIn', { ns: 'common' })}
                    </p>
                    <button
                      onClick={() => setShowSignIn(true)}
                      className="w-full px-4 py-2 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow hover-scale transition-all"
                    >
                      {t('auth.signIn', { ns: 'common' })}
                    </button>
                  </div>
                )
              ) : (
                <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-body-sm text-qm-text-secondary">{t('auth.email', { ns: 'common' })}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm text-qm-text-primary">{currentUser?.email}</span>
                      {currentUser?.authMethod && (
                        <span className="text-caption text-qm-text-tertiary px-2 py-0.5 rounded-full bg-qm-surface-medium">
                          {t('auth.via', { ns: 'common', method: currentUser.authMethod === 'google' ? 'Google' : 'Email' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-body-sm text-qm-text-secondary">{t('auth.plan', { ns: 'common' })}</span>
                    <span className={cn(
                      "text-body-sm font-medium capitalize",
                      license.isPro() ? "text-qm-warning" : "text-qm-accent"
                    )}>
                      {license.currentLicense.plan}
                    </span>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="w-full mt-2 px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-error-light text-body-sm text-qm-text-secondary hover:text-qm-error transition-colors"
                  >
                    {t('auth.signOut', { ns: 'common' })}
                  </button>
                </div>
              )}

            </section>
          )}

          {activeTab === 'general' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.general.title')}</h3>
              <div className="space-y-3">
                <ToggleRow
                  label={t('settings.general.smartMode')}
                  description={t('settings.general.smartModeDescription')}
                  enabled={config.smartModeEnabled}
                  onToggle={(v) => handleToggle('smartModeEnabled', v)}
                />
                <ToggleRow
                  label={t('settings.general.undetectableOverlay')}
                  description={t('settings.general.undetectableOverlayDescription')}
                  enabled={config.isUndetectabilityEnabled}
                  onToggle={(v) => handleToggle('isUndetectabilityEnabled', v)}
                />
                <ToggleRow
                  label={t('settings.general.autoScreenCapture')}
                  description={t('settings.general.autoScreenCaptureDescription')}
                  enabled={config.autoScreenCapture}
                  onToggle={(v) => handleToggle('autoScreenCapture', v)}
                />
                {config.autoScreenCapture && (
                  <>
                    <SliderRow
                      label={t('settings.general.captureInterval')}
                      description={t('settings.general.captureIntervalDescription')}
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
          )}

          {activeTab === 'autoAnswer' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.autoAnswer.title')}</h3>
              <div className="space-y-3">
                <ToggleRow
                  label={t('settings.autoAnswer.enable')}
                  description={t('settings.autoAnswer.enableDescription')}
                  enabled={config.autoAnswerEnabled}
                  onToggle={(v) => handleToggle('autoAnswerEnabled', v)}
                />
                <SliderRow
                  label={t('settings.autoAnswer.silenceThreshold')}
                  description={t('settings.autoAnswer.silenceThresholdDescription')}
                  value={config.autoAnswerSilenceThreshold}
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  displayValue={`${config.autoAnswerSilenceThreshold}s`}
                  onChange={(v) => config.updateConfig({ autoAnswerSilenceThreshold: v })}
                />
                <SliderRow
                  label={t('settings.autoAnswer.cooldown')}
                  description={t('settings.autoAnswer.cooldownDescription')}
                  value={config.autoAnswerCooldown}
                  min={5}
                  max={30}
                  step={1}
                  displayValue={`${config.autoAnswerCooldown}s`}
                  onChange={(v) => config.updateConfig({ autoAnswerCooldown: v })}
                />
                <div className="flex items-start justify-between py-2 gap-4">
                  <div className="flex-1">
                    <p className="text-body-sm text-qm-text-primary">{t('settings.autoAnswer.responseType')}</p>
                    <p className="text-caption text-qm-text-tertiary">
                      {t('settings.autoAnswer.responseTypeDescription')}
                    </p>
                  </div>
                  <select
                    value={config.autoAnswerResponseType || 'assist'}
                    onChange={(e) => config.updateConfig({ autoAnswerResponseType: e.target.value })}
                    className="text-body-sm rounded-qm-md px-3 py-1.5 border border-qm-border-subtle outline-none focus:border-qm-accent"
                    style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}
                  >
                    <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="assist">{t('settings.autoAnswer.responseTypes.assist')}</option>
                    <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="what_should_i_say">{t('settings.autoAnswer.responseTypes.whatShouldISay')}</option>
                    <option style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }} value="follow_up">{t('settings.autoAnswer.responseTypes.followUp')}</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'proactive' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">
                {t('settings.proactive.title')}
              </h3>
              <div className="space-y-3">
                <ToggleRow
                  label={t('settings.proactive.enable')}
                  description={t('settings.proactive.enableDescription')}
                  enabled={config.proactiveEnabled}
                  onToggle={(v) => handleToggle('proactiveEnabled', v)}
                />
                {config.proactiveEnabled && (
                  <>
                    <SliderRow
                      label={t('settings.proactive.sensitivity')}
                      description={t('settings.proactive.sensitivityDescription')}
                      value={config.proactiveSensitivity}
                      min={0.5}
                      max={1.0}
                      step={0.05}
                      displayValue={`${Math.round(config.proactiveSensitivity * 100)}%`}
                      onChange={(v) => config.updateConfig({ proactiveSensitivity: v })}
                    />
                    <SliderRow
                      label={t('settings.proactive.cooldown')}
                      description={t('settings.proactive.cooldownDescription')}
                      value={config.proactiveCooldown}
                      min={5}
                      max={60}
                      step={5}
                      displayValue={`${config.proactiveCooldown}s`}
                      onChange={(v) => config.updateConfig({ proactiveCooldown: v })}
                    />
                    <ToggleRow
                      label={t('settings.proactive.objections')}
                      description={t('settings.proactive.objectionsDescription')}
                      enabled={config.proactiveObjectionsEnabled}
                      onToggle={(v) => handleToggle('proactiveObjectionsEnabled', v)}
                    />
                    <ToggleRow
                      label={t('settings.proactive.questions')}
                      description={t('settings.proactive.questionsDescription')}
                      enabled={config.proactiveQuestionsEnabled}
                      onToggle={(v) => handleToggle('proactiveQuestionsEnabled', v)}
                    />
                    <ToggleRow
                      label={t('settings.proactive.hesitations')}
                      description={t('settings.proactive.hesitationsDescription')}
                      enabled={config.proactiveHesitationsEnabled}
                      onToggle={(v) => handleToggle('proactiveHesitationsEnabled', v)}
                    />
                    <ToggleRow
                      label={t('settings.proactive.closing')}
                      description={t('settings.proactive.closingDescription')}
                      enabled={config.proactiveClosingEnabled}
                      onToggle={(v) => handleToggle('proactiveClosingEnabled', v)}
                    />
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === 'audio' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.audio.title')}</h3>
              <div className="space-y-3">
                <ToggleRow
                  label={t('settings.audio.captureMicrophone')}
                  description={t('settings.audio.captureMicrophoneDescription')}
                  enabled={config.captureMicrophone}
                  onToggle={(v) => handleToggle('captureMicrophone', v)}
                />
                <ToggleRow
                  label={t('settings.audio.captureSystemAudio')}
                  description={t('settings.audio.captureSystemAudioDescription')}
                  enabled={config.captureSystemAudio}
                  onToggle={(v) => handleToggle('captureSystemAudio', v)}
                />
                <AudioLevelTest />
              </div>
            </section>
          )}

          {activeTab === 'sync' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.sync.title')}</h3>
              <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${syncColor}`} />
                    <span className="text-body-sm text-qm-text-primary">{t('settings.sync.cloudSync')}</span>
                  </div>
                  <span className="text-body-sm text-qm-text-secondary">{syncLabel}</span>
                </div>
                {lastSync && (
                  <p className="text-caption text-qm-text-tertiary">
                    {t('settings.sync.lastSynced', { time: new Date(lastSync).toLocaleString() })}
                  </p>
                )}
                <p className="text-caption text-qm-text-tertiary">
                  {t('license.proSyncAvailable', { ns: 'common' })}
                </p>
                {isAuthenticated && (
                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="w-full px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-pressed text-body-sm text-qm-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? t('settings.sync.syncing') : t('settings.sync.syncNow')}
                  </button>
                )}
              </div>
            </section>
          )}

          {activeTab === 'shortcuts' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">
                {t('settings.shortcuts.title')}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-body-sm text-qm-text-secondary">{t('settings.shortcuts.startStop')}</span>
                  <KeyboardShortcutBadge shortcut="Ctrl+Shift+S" />
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body-sm text-qm-text-secondary">{t('settings.shortcuts.toggleWidget')}</span>
                  <KeyboardShortcutBadge shortcut="Ctrl+\\" />
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body-sm text-qm-text-secondary">{t('settings.shortcuts.triggerAssist')}</span>
                  <KeyboardShortcutBadge shortcut="Ctrl+Enter" />
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-body-sm text-qm-text-secondary">{t('settings.shortcuts.clearContext')}</span>
                  <KeyboardShortcutBadge shortcut="Ctrl+Shift+R" />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'updates' && (
            <section>
              <h3 className="text-headline font-semibold text-qm-text-primary mb-4">{t('settings.updates.title')}</h3>
              <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
                <div className="flex items-start justify-between py-2 gap-4">
                  <div className="flex-1">
                    <p className="text-body-sm text-qm-text-primary">{t('settings.updates.appVersion')}</p>
                    <p className="text-caption text-qm-text-tertiary">{t('settings.updates.appVersionDescription')}</p>
                  </div>
                  <span className="text-body-sm text-qm-accent font-medium">
                    {appVersion || '...'}
                  </span>
                </div>
                {updateStatus && (
                  <p className="text-caption text-qm-text-tertiary">{updateStatus}</p>
                )}
                {updateReady ? (
                  <button
                    onClick={() => {
                      const api = (window as unknown as { electronAPI: { installUpdate: () => Promise<boolean> } }).electronAPI
                      api?.installUpdate?.()
                    }}
                    className="w-full px-4 py-2 rounded-qm-md bg-qm-accent hover:bg-qm-accent/80 text-body-sm text-white font-medium transition-colors"
                  >
                    {t('settings.updates.restartAndUpdate')}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="w-full px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-pressed text-body-sm text-qm-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCheckingUpdate ? t('settings.updates.checking') : t('settings.updates.checkForUpdates')}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
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
  ...Array(12).fill('bg-emerald-500'),
  ...Array(4).fill('bg-yellow-500'),
  ...Array(4).fill('bg-red-500'),
]

function AudioLevelTest() {
  const { t } = useTranslation('dashboard')
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
          <p className="text-body-sm text-qm-text-primary">{t('settings.audio.audioLevelTest')}</p>
          <p className="text-caption text-qm-text-tertiary">{t('settings.audio.audioLevelTestDescription')}</p>
        </div>
        <button
          onClick={isTesting ? stopTest : startTest}
          className={`px-3 py-1.5 rounded-qm-md text-caption font-medium transition-colors ${
            isTesting
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-qm-accent/20 text-qm-accent hover:bg-qm-accent/30'
          }`}
        >
          {isTesting ? t('settings.audio.stopTest') : t('settings.audio.startTest')}
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
