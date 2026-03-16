import { useTranslation } from 'react-i18next'
import { useConfigStore } from '@/stores/configStore'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { getTrayStrings } from '@/i18n/trayTranslations'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const uiLanguage = useConfigStore((s) => s.uiLanguage)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  const handleChange = (lang: string) => {
    if (lang === uiLanguage) return
    i18n.changeLanguage(lang)
    updateConfig({ uiLanguage: lang })
    window.electronAPI?.notifyLanguageChange?.(lang, getTrayStrings(lang))
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {SUPPORTED_LANGUAGES.map(({ code, label }, idx) => (
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
          {idx < SUPPORTED_LANGUAGES.length - 1 && (
            <span className="text-qm-text-disabled text-caption">|</span>
          )}
        </span>
      ))}
    </div>
  )
}
