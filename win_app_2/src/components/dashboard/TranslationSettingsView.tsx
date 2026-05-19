import { useState } from 'react'
import { Globe, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import { DEEPL_LANGUAGES } from '@/services/translation/deeplLanguage'
import { ProxyTranslationProvider } from '@/services/translation/proxyTranslationProvider'
import { isTranslationEnabled } from '@/services/proxy/proxyConfigManager'
import { TranslationError } from '@/services/translation/translationProvider'
import { UpgradePrompt } from '@/components/license/UpgradePrompt'
import { cn } from '@/lib/utils'

type TestStatus = 'idle' | 'running' | 'success' | 'failure'

export function TranslationSettingsView() {
  const { t } = useTranslation('dashboard')
  const config = useConfigStore()
  const providerEnabled = isTranslationEnabled()
  const translationAccess = useLicenseStore((s) => s.canUse(Feature.LiveTranslation))
  const isLicensed = translationAccess.type === 'allowed'
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState<string>('')

  const handleTest = async () => {
    setTestStatus('running')
    setTestMessage('')
    try {
      const provider = new ProxyTranslationProvider()
      const result = await provider.translate({
        text: 'Bonjour comment allez-vous',
        sourceLang: null,
        targetLang: config.translationTargetLanguage,
        context: null,
      })
      setTestStatus('success')
      setTestMessage(`${result.latencyMs}ms — ${result.translatedText}`)
    } catch (err) {
      setTestStatus('failure')
      if (err instanceof TranslationError) {
        setTestMessage(err.detail ?? err.kind)
      } else {
        setTestMessage(err instanceof Error ? err.message : String(err))
      }
    }
  }

  return (
    <section>
      <h3 className="text-headline font-semibold text-qm-text-primary mb-1">
        {t('settings.translation.title')}
      </h3>
      <p className="text-caption text-qm-text-tertiary mb-4">
        {t('settings.translation.subtitle')}
      </p>

      {!isLicensed && (
        <div className="mb-4">
          <UpgradePrompt access={translationAccess} />
        </div>
      )}

      {/* General */}
      <div className="qm-card p-4 space-y-3 mb-4">
        <div className="text-body-sm font-semibold text-qm-text-primary flex items-center gap-2">
          <Globe size={14} className="text-qm-accent-light" />
          {t('settings.translation.general')}
          {!isLicensed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-qm-accent/10 text-qm-accent text-[10px] font-medium">
              <Lock size={9} />
              Enterprise
            </span>
          )}
        </div>
        <ToggleRow
          label={t('settings.translation.enable')}
          description={`${t('settings.translation.enableDescription')} (BETA)`}
          enabled={config.translationEnabled && isLicensed}
          disabled={!isLicensed}
          onToggle={(v) => config.updateConfig({ translationEnabled: v })}
        />
        <ToggleRow
          label={t('settings.translation.showInOverlay')}
          description={t('settings.translation.showInOverlayDescription')}
          enabled={config.translationShowInOverlay && isLicensed}
          disabled={!isLicensed}
          onToggle={(v) => config.updateConfig({ translationShowInOverlay: v })}
        />
      </div>

      {/* Languages */}
      <div className="qm-card p-4 space-y-3 mb-4">
        <div className="text-body-sm font-semibold text-qm-text-primary">
          {t('settings.translation.languages')}
        </div>
        <PickerRow
          label={t('settings.translation.sourceLanguage')}
          value={config.translationSourceLanguage}
          onChange={(v) => config.updateConfig({ translationSourceLanguage: v })}
          options={[
            { value: 'auto', label: t('settings.translation.sourceLanguageAuto') },
            ...DEEPL_LANGUAGES.map((l) => ({
              value: l.code,
              label: `${l.flag} ${l.displayName}`,
            })),
          ]}
        />
        <PickerRow
          label={t('settings.translation.targetLanguage')}
          value={config.translationTargetLanguage}
          onChange={(v) => config.updateConfig({ translationTargetLanguage: v })}
          options={DEEPL_LANGUAGES.map((l) => ({
            value: l.code,
            label: `${l.flag} ${l.displayName}`,
          }))}
        />
      </div>

      {/* Provider */}
      <div className="qm-card p-4 space-y-3">
        <div className="text-body-sm font-semibold text-qm-text-primary">
          {t('settings.translation.provider')}
        </div>
        <div className="flex items-start gap-2">
          {providerEnabled ? (
            <CheckCircle2 size={16} className="text-qm-accent mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-qm-text-tertiary mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-body-sm text-qm-text-primary">
              {t('settings.translation.providerStatus')}
            </p>
            <p className="text-caption text-qm-text-tertiary">
              {providerEnabled
                ? t('settings.translation.providerActive')
                : t('settings.translation.providerNotConfigured')}
            </p>
          </div>
        </div>
        {providerEnabled && (
          <>
            <button
              onClick={handleTest}
              disabled={testStatus === 'running'}
              className="px-4 py-1.5 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-pressed text-body-sm text-qm-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus === 'running'
                ? t('settings.translation.testing')
                : t('settings.translation.test')}
            </button>
            {testMessage && (
              <p
                className={cn(
                  'text-caption',
                  testStatus === 'success' ? 'text-qm-accent' : 'text-qm-text-tertiary',
                )}
              >
                {testMessage}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  disabled = false,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={cn('flex items-start justify-between py-1 gap-4', disabled && 'opacity-50')}>
      <div className="flex-1">
        <p className="text-body-sm text-qm-text-primary">{label}</p>
        <p className="text-caption text-qm-text-tertiary">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onToggle(!enabled)}
        disabled={disabled}
        className={cn(
          'relative w-11 h-6 mt-0.5 rounded-full transition-colors outline-none focus:outline-none flex-shrink-0 overflow-hidden',
          enabled ? 'bg-qm-accent' : 'bg-qm-surface-pressed',
          disabled && 'cursor-not-allowed',
        )}
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

function PickerRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between py-1 gap-4">
      <p className="text-body-sm text-qm-text-primary flex-1">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-body-sm rounded-qm-md px-3 py-1.5 border border-qm-border-subtle outline-none focus:border-qm-accent max-w-[220px]"
        style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: '#1a1a2e', color: '#ffffff' }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
