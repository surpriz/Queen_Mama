import { useState, useEffect, useCallback } from 'react'
import { Mic, Monitor, Keyboard, Check, Loader2, Info, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PermissionsStepProps {
  onContinue: () => void
  onBack: () => void
}

type PermissionStatus = 'checking' | 'granted' | 'not_granted'

interface PermissionState {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  required: boolean
  status: PermissionStatus
}

async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop all tracks immediately — we just needed to check
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

async function checkScreenPermission(): Promise<boolean> {
  try {
    // On Electron, desktopCapturer is always available (no explicit permission needed)
    const sources = await window.electronAPI?.getScreenSources?.()
    return Array.isArray(sources) && sources.length > 0
  } catch {
    return true
  }
}

// Deep link to the Windows microphone privacy page (mac opens System Settings the same way)
const WINDOWS_MIC_SETTINGS = 'ms-settings:privacy-microphone'

export function PermissionsStep({ onContinue, onBack }: PermissionsStepProps) {
  const { t } = useTranslation('onboarding')
  const [permissions, setPermissions] = useState<PermissionState[]>(() => [
    {
      id: 'microphone',
      name: t('permissions.microphone'),
      description: t('permissions.microphoneDescription'),
      icon: <Mic className="w-5 h-5" />,
      required: true,
      status: 'checking',
    },
    {
      id: 'screen',
      name: t('permissions.screen'),
      description: t('permissions.screenDescription'),
      icon: <Monitor className="w-5 h-5" />,
      required: true,
      status: 'checking',
    },
    {
      id: 'keyboard',
      name: t('permissions.keyboard'),
      description: t('permissions.keyboardDescription'),
      icon: <Keyboard className="w-5 h-5" />,
      required: false,
      status: 'granted',
    },
  ])

  const updatePermission = useCallback((id: string, status: PermissionStatus) => {
    setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  useEffect(() => {
    const checkAll = async () => {
      const micOk = await checkMicrophonePermission()
      updatePermission('microphone', micOk ? 'granted' : 'not_granted')

      const screenOk = await checkScreenPermission()
      updatePermission('screen', screenOk ? 'granted' : 'not_granted')
    }
    checkAll()
  }, [updatePermission])

  const handleGrantMicrophone = async () => {
    updatePermission('microphone', 'checking')
    const ok = await checkMicrophonePermission()
    updatePermission('microphone', ok ? 'granted' : 'not_granted')
  }

  const allGranted = permissions.every((p) => p.status === 'granted')

  return (
    <div className="flex flex-col h-full px-8 py-8">
      <div className="text-center mb-6">
        <h2 className="text-title-md font-semibold text-qm-text-primary mb-2">{t('permissions.title')}</h2>
        <p className="text-body-md text-qm-text-secondary max-w-md mx-auto">{t('permissions.subtitle')}</p>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full space-y-3 mb-6">
        {permissions.map((permission) => (
          <PermissionCard
            key={permission.id}
            permission={permission}
            onGrant={permission.id === 'microphone' ? handleGrantMicrophone : undefined}
          />
        ))}
      </div>

      {!allGranted && (
        <div className="max-w-lg mx-auto w-full mb-6">
          <div className="flex items-start gap-3 p-4 rounded-qm-lg bg-qm-info/10 border border-qm-info/20">
            <Info className="w-5 h-5 text-qm-info flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-body-sm text-qm-text-secondary">{t('permissions.info')}</p>
              <button
                onClick={() => window.electronAPI?.openExternal(WINDOWS_MIC_SETTINGS)}
                className="mt-2 inline-flex items-center gap-1 text-caption text-qm-accent hover:underline"
              >
                <ExternalLink size={12} />
                {t('permissions.openSettings')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between max-w-lg mx-auto w-full">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-qm-lg border border-qm-border-medium text-qm-text-primary hover:bg-qm-surface-light transition-colors font-medium"
        >
          {t('nav.back')}
        </button>
        <button
          onClick={onContinue}
          className="px-8 py-2.5 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium hover:scale-105 transition-transform duration-200"
        >
          {t('nav.continue')}
        </button>
      </div>
    </div>
  )
}

interface PermissionCardProps {
  permission: PermissionState
  onGrant?: () => void
}

function PermissionCard({ permission, onGrant }: PermissionCardProps) {
  const { t } = useTranslation('onboarding')

  const statusContent = (() => {
    switch (permission.status) {
      case 'checking':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-qm-sm bg-qm-surface-medium text-qm-text-tertiary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-caption font-medium">{t('permissions.checking')}</span>
          </div>
        )
      case 'granted':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-qm-sm bg-emerald-500/10 text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="text-caption font-medium">{t('permissions.granted')}</span>
          </div>
        )
      case 'not_granted':
        return onGrant ? (
          <button
            onClick={onGrant}
            className="flex items-center gap-1.5 px-3 py-1 rounded-qm-sm bg-qm-gradient-start/15 text-qm-accent hover:bg-qm-gradient-start/25 transition-colors"
          >
            <span className="text-caption font-medium">{t('permissions.grant')}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-qm-sm bg-emerald-500/10 text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="text-caption font-medium">{t('permissions.ready')}</span>
          </div>
        )
    }
  })()

  return (
    <div className="flex items-start gap-4 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div className="flex-shrink-0 w-10 h-10 rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent">
        {permission.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-body-md font-medium text-qm-text-primary">{permission.name}</h3>
          {!permission.required && (
            <span className="px-2 py-0.5 text-caption rounded bg-qm-surface-medium text-qm-text-tertiary">{t('permissions.optional')}</span>
          )}
        </div>
        <p className="text-body-sm text-qm-text-secondary">{permission.description}</p>
      </div>
      {statusContent}
    </div>
  )
}
