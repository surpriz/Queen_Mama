/**
 * DisplaySelector - Allows users to select which screen to capture
 * Matches macOS multi-display selection feature
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScreenSource {
  id: string
  name: string
  display_id: string
  thumbnailDataUrl: string
}

export function DisplaySelector() {
  const { t } = useTranslation('dashboard')
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSources = async () => {
    setLoading(true)
    try {
      const screenSources = await window.electronAPI?.screen?.getSources()
      // Only show screens, not individual windows
      const screens = (screenSources || []).filter((s: ScreenSource) =>
        s.id.startsWith('screen:') || s.name.toLowerCase().includes('screen') || s.name.toLowerCase().includes('display') || s.name.match(/^(Screen|Display|Entire)\s?\d*/i)
      )
      setSources(screens.length > 0 ? screens : screenSources || [])

      // Load persisted selection
      const stored = await window.electronAPI?.store?.get('selectedDisplayId')
      if (stored) {
        setSelectedId(stored as string)
      }
    } catch (err) {
      console.error('[DisplaySelector] Failed to load sources:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
  }, [])

  const handleSelect = async (source: ScreenSource) => {
    setSelectedId(source.id)
    await window.electronAPI?.store?.set('selectedDisplayId', source.id)
    // Flash the selected display
    window.electronAPI?.screen?.flashDisplay(source.display_id, source.name, source.id)
  }

  if (sources.length <= 1) {
    // Only one display, no need for selector
    return null
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-body-sm text-qm-text-primary font-medium">{t('settings.general.captureDisplay')}</p>
          <p className="text-caption text-qm-text-tertiary">{t('settings.general.captureDisplayDescription')}</p>
        </div>
        <button
          onClick={loadSources}
          disabled={loading}
          className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:bg-qm-surface-hover transition-colors"
          title={t('settings.general.refreshDisplays')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sources.map((source) => {
          const isSelected = selectedId === source.id || (!selectedId && sources.indexOf(source) === 0)
          return (
            <button
              key={source.id}
              onClick={() => handleSelect(source)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2 rounded-qm-md border transition-all',
                isSelected
                  ? 'border-qm-accent bg-qm-accent/10'
                  : 'border-qm-border-subtle bg-qm-surface-light hover:border-qm-accent/50',
              )}
            >
              {source.thumbnailDataUrl ? (
                <img
                  src={source.thumbnailDataUrl}
                  alt={source.name}
                  className="w-full h-16 object-cover rounded-qm-sm"
                />
              ) : (
                <div className="w-full h-16 bg-qm-surface-medium rounded-qm-sm flex items-center justify-center">
                  <Monitor size={20} className="text-qm-text-tertiary" />
                </div>
              )}
              <span className="text-caption text-qm-text-secondary truncate w-full text-center">
                {source.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
