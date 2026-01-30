import { useState, useEffect, useCallback } from 'react'
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authApiClient } from '@/services/auth/authApiClient'
import { getApiBaseUrl } from '@/services/config/appEnvironment'

interface DeviceCodeAuthProps {
  onBack: () => void
}

export function DeviceCodeAuth({ onBack }: DeviceCodeAuthProps) {
  const [userCode, setUserCode] = useState<string | null>(null)
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const login = useAuthStore((s) => s.login)

  const startFlow = useCallback(async () => {
    try {
      setError(null)
      const deviceInfo = await window.electronAPI?.device.getInfo()

      const result = await authApiClient.requestDeviceCode({
        deviceId: deviceInfo?.deviceId ?? 'unknown',
        deviceName: deviceInfo?.deviceName ?? 'Windows PC',
        platform: 'windows',
        osVersion: deviceInfo?.osVersion ?? '',
        appVersion: deviceInfo?.appVersion ?? '1.0.0',
      })

      setUserCode(result.userCode)
      setDeviceCode(result.deviceCode)
      setVerificationUrl(result.verificationUrl || `${getApiBaseUrl()}/device`)
      setIsPolling(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start device code flow')
    }
  }, [])

  // Start flow on mount
  useEffect(() => {
    startFlow()
  }, [startFlow])

  // Poll for authorization
  useEffect(() => {
    if (!isPolling || !deviceCode) return

    const interval = setInterval(async () => {
      try {
        const result = await authApiClient.pollDeviceCode(deviceCode)

        if (result.status === 'authorized' && result.tokens && result.user) {
          setIsPolling(false)
          login(result.user, result.tokens)
        } else if (result.status === 'expired') {
          setIsPolling(false)
          setError('Device code expired. Please try again.')
        }
        // status === 'pending' → keep polling
      } catch {
        // Silent failure, keep polling
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isPolling, deviceCode, login])

  const handleCopyCode = () => {
    if (userCode) {
      navigator.clipboard.writeText(userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenBrowser = () => {
    if (verificationUrl) {
      window.electronAPI?.openExternal(verificationUrl)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h2 className="text-title-md font-semibold text-qm-text-primary">Sign in with Device Code</h2>

      {error ? (
        <div className="text-center">
          <p className="text-body-sm text-qm-error mb-4">{error}</p>
          <button
            onClick={startFlow}
            className="px-4 py-2 rounded-qm-md bg-qm-accent text-white text-body-sm hover:bg-qm-accent/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : !userCode ? (
        <div className="flex items-center gap-2 text-qm-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-body-sm">Generating code...</span>
        </div>
      ) : (
        <>
          <p className="text-body-sm text-qm-text-secondary text-center max-w-sm">
            Enter this code on the verification page to sign in:
          </p>

          {/* Code display */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-3 px-6 py-4 rounded-qm-lg bg-qm-surface-medium border-2 border-qm-accent/30 hover:border-qm-accent/50 transition-colors group"
          >
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-qm-text-primary">
              {userCode}
            </span>
            {copied ? (
              <Check size={18} className="text-qm-success" />
            ) : (
              <Copy
                size={18}
                className="text-qm-text-tertiary group-hover:text-qm-text-secondary"
              />
            )}
          </button>

          {/* Open browser button */}
          <button
            onClick={handleOpenBrowser}
            className="flex items-center gap-2 px-4 py-2 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-shadow"
          >
            <ExternalLink size={14} />
            Open Verification Page
          </button>

          {/* Polling indicator */}
          {isPolling && (
            <div className="flex items-center gap-2 text-qm-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-caption">Waiting for authorization...</span>
            </div>
          )}
        </>
      )}

      <button
        onClick={onBack}
        className="text-body-sm text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
      >
        Back
      </button>
    </div>
  )
}
