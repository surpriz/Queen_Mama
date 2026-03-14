import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreVertical, Move, Settings, Trash2, Monitor, ChevronRight, ChevronDown, ChevronUp, Zap, Brain, Camera, Layers, EyeOff, Check } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import type { OverlayPosition } from '@/types/electron.d'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import type { Mode } from '@/types/models'
import { useModes } from '@/hooks/useModes'
import { cn } from '@/lib/utils'

const POSITIONS: { value: OverlayPosition; label: string }[] = [
  { value: 'topLeft', label: 'Top Left' },
  { value: 'topCenter', label: 'Top Center' },
  { value: 'topRight', label: 'Top Right' },
  { value: 'bottomLeft', label: 'Bottom Left' },
  { value: 'bottomCenter', label: 'Bottom Center' },
  { value: 'bottomRight', label: 'Bottom Right' },
]

interface DisplaySource {
  id: string
  name: string
  display_id: string
  thumbnailDataUrl: string
  width: number
  height: number
  isPrimary: boolean
}

export function PopupMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [showPositions, setShowPositions] = useState(false)
  const [showModes, setShowModes] = useState(false)
  const [showDisplays, setShowDisplays] = useState(false)
  const [displaySources, setDisplaySources] = useState<DisplaySource[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const position = useOverlayStore((s) => s.position)
  const setPosition = useOverlayStore((s) => s.setPosition)
  const clearHistory = useOverlayStore((s) => s.clearHistory)

  const autoAnswerEnabled = useConfigStore((s) => s.autoAnswerEnabled)
  const smartModeEnabled = useConfigStore((s) => s.smartModeEnabled)
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const toggleOverlay = useAppStore((s) => s.toggleOverlay)

  const { modes } = useModes()

  // Lazy-load display sources when submenu opens (like macOS)
  const loadDisplaySources = useCallback(async () => {
    try {
      const displays = await window.electronAPI?.screen?.getDisplays()
      if (!displays || displays.length === 0) return
      setDisplaySources(displays)

      // Load persisted selection
      const stored = await window.electronAPI?.store?.get('selectedDisplayId')
      if (stored) setSelectedDisplayId(stored as string)
    } catch (err) {
      console.error('[PopupMenu] Failed to load displays:', err)
    }
  }, [])

  const handleSelectDisplay = useCallback(async (source: DisplaySource) => {
    setSelectedDisplayId(source.id)
    await window.electronAPI?.store?.set('selectedDisplayId', source.id)
    // Flash the selected display
    window.electronAPI?.screen?.flashDisplay(source.display_id, source.name, source.id)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowPositions(false)
        setShowModes(false)
        setShowDisplays(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Load displays when submenu opens
  useEffect(() => {
    if (showDisplays) loadDisplaySources()
  }, [showDisplays, loadDisplaySources])

  // Toggle submenu with mutual exclusion
  const openSubmenu = useCallback((which: 'positions' | 'modes' | 'displays') => {
    setShowPositions(which === 'positions' ? (v) => !v : false)
    setShowModes(which === 'modes' ? (v) => !v : false)
    setShowDisplays(which === 'displays' ? (v) => !v : false)
  }, [])

  const handlePositionChange = (pos: OverlayPosition) => {
    setPosition(pos)
    window.electronAPI?.overlay.setPosition(pos)
    setShowPositions(false)
    setIsOpen(false)
  }

  const handleClearContext = () => {
    clearHistory()
    setIsOpen(false)
  }

  const handleOpenSettings = () => {
    window.electronAPI?.window.show()
    setIsOpen(false)
  }

  const handleSelectMode = (mode: Mode) => {
    setSelectedMode(mode)
    setShowModes(false)
    setIsOpen(false)
  }

  const handleHideWidget = () => {
    toggleOverlay()
    setIsOpen(false)
  }

  const handleToggleAutoAnswer = () => {
    updateConfig({ autoAnswerEnabled: !autoAnswerEnabled })
  }

  const handleToggleSmartMode = () => {
    updateConfig({ smartModeEnabled: !smartModeEnabled })
  }

  const handleToggleScreenCapture = () => {
    updateConfig({ autoScreenCapture: !autoScreenCapture })
  }

  return (
    <div ref={menuRef} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          // Auto-expand widget if collapsed so the dropdown is visible
          const { isExpanded, toggleExpanded } = useOverlayStore.getState()
          if (!isExpanded) toggleExpanded()
          setIsOpen(!isOpen)
        }}
        className="p-1 rounded-qm-sm text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-qm-surface-medium border border-qm-border-subtle rounded-qm-md shadow-qm-lg z-50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Position submenu */}
          <button
            onClick={() => openSubmenu('positions')}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Move size={14} />
            Position
          </button>

          {showPositions && (
            <div className="border-t border-qm-border-subtle bg-qm-surface-dark">
              {POSITIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handlePositionChange(value)}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-1.5 text-caption transition-colors',
                    position === value
                      ? 'text-qm-accent bg-qm-accent/10'
                      : 'text-qm-text-tertiary hover:bg-qm-surface-hover',
                  )}
                >
                  <Monitor size={12} />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Mode selector submenu */}
          <button
            onClick={() => openSubmenu('modes')}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Layers size={14} />
            <span className="flex-1 text-left">Mode</span>
            <span className="text-caption text-qm-text-tertiary mr-1">{selectedMode?.name ?? 'Default'}</span>
            <ChevronRight size={12} className="text-qm-text-tertiary" />
          </button>

          {showModes && (
            <div className="border-t border-qm-border-subtle bg-qm-surface-dark max-h-48 overflow-y-auto">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleSelectMode(mode)}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-1.5 text-caption transition-colors',
                    (selectedMode?.name ?? 'Default') === mode.name
                      ? 'text-qm-accent bg-qm-accent/10'
                      : 'text-qm-text-tertiary hover:bg-qm-surface-hover',
                  )}
                >
                  {mode.name}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-qm-border-subtle" />

          {/* Auto-Answer toggle */}
          <button
            onClick={handleToggleAutoAnswer}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Zap size={14} className={autoAnswerEnabled ? 'text-qm-auto-answer' : ''} />
            <span className="flex-1 text-left">Auto-Answer</span>
            <span className={cn(
              'text-caption-sm font-medium px-1.5 py-0.5 rounded-full',
              autoAnswerEnabled
                ? 'bg-qm-auto-answer/20 text-qm-auto-answer'
                : 'bg-qm-surface-dark text-qm-text-tertiary',
            )}>
              {autoAnswerEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Smart Mode toggle */}
          <button
            onClick={handleToggleSmartMode}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Brain size={14} className={smartModeEnabled ? 'text-purple-400' : ''} />
            <span className="flex-1 text-left">Smart Mode</span>
            <span className={cn(
              'text-caption-sm font-medium px-1.5 py-0.5 rounded-full',
              smartModeEnabled
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-qm-surface-dark text-qm-text-tertiary',
            )}>
              {smartModeEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Screen Capture toggle */}
          <button
            onClick={handleToggleScreenCapture}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Camera size={14} className={autoScreenCapture ? 'text-qm-accent' : ''} />
            <span className="flex-1 text-left">Screen Capture</span>
            <span className={cn(
              'text-caption-sm font-medium px-1.5 py-0.5 rounded-full',
              autoScreenCapture
                ? 'bg-qm-accent/20 text-qm-accent'
                : 'bg-qm-surface-dark text-qm-text-tertiary',
            )}>
              {autoScreenCapture ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="border-t border-qm-border-subtle" />

          {/* Display selector submenu */}
          <button
            onClick={() => openSubmenu('displays')}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Monitor size={14} />
            <div className="flex-1 text-left min-w-0">
              <span className="text-caption-sm text-qm-text-tertiary block leading-tight">Display</span>
              <span className="text-body-sm text-qm-text-primary leading-tight truncate block">
                {(() => {
                  const active = displaySources.length > 0
                    ? (displaySources.find((s) => s.id === selectedDisplayId) ?? displaySources[0])
                    : null
                  if (!active) return 'Primary'
                  return active.width ? `${active.name} · ${active.width}×${active.height}` : active.name
                })()}
              </span>
            </div>
            {showDisplays ? <ChevronUp size={12} className="text-qm-text-tertiary" /> : <ChevronDown size={12} className="text-qm-text-tertiary" />}
          </button>

          {showDisplays && (
            <div className="border-t border-qm-border-subtle bg-qm-surface-dark px-1.5 py-1.5 space-y-1">
              {displaySources.length === 0 ? (
                <p className="text-caption-sm text-qm-text-tertiary text-center py-2">No displays found</p>
              ) : (
                displaySources.map((source) => {
                  const isSelected = selectedDisplayId === source.id || (!selectedDisplayId && displaySources.indexOf(source) === 0)
                  return (
                    <button
                      key={source.id}
                      onClick={() => handleSelectDisplay(source)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 rounded-qm-sm transition-colors',
                        isSelected
                          ? 'bg-emerald-500/15'
                          : 'hover:bg-qm-surface-hover',
                      )}
                    >
                      {source.thumbnailDataUrl ? (
                        <img
                          src={source.thumbnailDataUrl}
                          alt={source.name}
                          className={cn(
                            'w-12 h-7 object-cover rounded-sm border flex-shrink-0',
                            isSelected ? 'border-emerald-500/50' : 'border-white/10',
                          )}
                        />
                      ) : (
                        <div className="w-12 h-7 rounded-sm bg-qm-surface-medium flex items-center justify-center flex-shrink-0">
                          <Monitor size={10} className="text-qm-text-tertiary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <span className={cn(
                          'text-caption truncate block',
                          isSelected ? 'text-emerald-400 font-medium' : 'text-qm-text-secondary',
                        )}>
                          {source.name}
                        </span>
                        {source.width > 0 && (
                          <span className="text-[9px] text-qm-text-tertiary">{source.width}×{source.height}</span>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={10} className="text-emerald-400 flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}

          <div className="border-t border-qm-border-subtle" />

          {/* Settings */}
          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>

          {/* Hide Widget */}
          <button
            onClick={handleHideWidget}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <EyeOff size={14} />
            Hide Widget
          </button>

          {/* Clear context */}
          <button
            onClick={handleClearContext}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-error hover:bg-qm-error/10 transition-colors border-t border-qm-border-subtle"
          >
            <Trash2 size={14} />
            Clear Context
          </button>
        </div>
      )}
    </div>
  )
}
