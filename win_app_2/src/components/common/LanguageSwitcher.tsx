import { useTranslation } from 'react-i18next'
import { useConfigStore } from '@/stores/configStore'
import { SUPPORTED_LANGUAGES, SYSTEM_LANGUAGE } from '@/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { t } = useTranslation('dashboard')
  const uiLanguage = useConfigStore((s) => s.uiLanguage)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  // configStore resolves 'system' and syncs i18next + the tray
  const handleChange = (lang: string) => {
    if (lang === uiLanguage) return
    updateConfig({ uiLanguage: lang })
  }

  const OPTIONS = [{ code: SYSTEM_LANGUAGE, label: t('settings.language.system') }, ...SUPPORTED_LANGUAGES]

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {OPTIONS.map(({ code, label }, idx) => (
        <span key={code} className="flex items-center gap-1">
          <button
            onClick={() => handleChange(code)}
            className={cn(
              'text-caption font-semibold transition-colors px-1',
              uiLanguage === code
                ? 'text-qm-accent'
                : 'text-qm-text-tertiary hover:text-qm-text-secondary',
            )}
          >
            {label}
          </button>
          {idx < OPTIONS.length - 1 && (
            <span className="text-qm-text-disabled text-caption">|</span>
          )}
        </span>
      ))}
    </div>
  )
}
