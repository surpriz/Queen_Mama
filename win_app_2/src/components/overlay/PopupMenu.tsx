import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Move, Settings, Trash2, Monitor, ChevronRight, Zap, Brain, Camera, Layers } from 'lucide-react'
import { useOverlayStore } from '@/stores/overlayStore'
import type { OverlayPosition } from '@/types/electron.d'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import { BUILT_IN_MODES } from '@/types/models'
import { cn } from '@/lib/utils'

const POSITIONS: { value: OverlayPosition; label: string }[] = [
  { value: 'topLeft', label: 'Top Left' },
  { value: 'topCenter', label: 'Top Center' },
  { value: 'topRight', label: 'Top Right' },
  { value: 'bottomLeft', label: 'Bottom Left' },
  { value: 'bottomCenter', label: 'Bottom Center' },
  { value: 'bottomRight', label: 'Bottom Right' },
]

export function PopupMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [showPositions, setShowPositions] = useState(false)
  const [showModes, setShowModes] = useState(false)
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowPositions(false)
        setShowModes(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

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

  const handleSelectMode = (mode: (typeof BUILT_IN_MODES)[number]) => {
    setSelectedMode({
      id: `builtin-${mode.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: mode.name,
      systemPrompt: mode.systemPrompt,
      isDefault: mode.isDefault,
      createdAt: new Date().toISOString(),
      attachedFiles: [],
    })
    setShowModes(false)
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
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-qm-sm text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-white/5 transition-colors"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-qm-surface-medium border border-qm-border-subtle rounded-qm-md shadow-qm-lg z-50 overflow-hidden">
          {/* Position submenu */}
          <button
            onClick={() => setShowPositions(!showPositions)}
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
            onClick={() => setShowModes(!showModes)}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Layers size={14} />
            <span className="flex-1 text-left">Mode</span>
            <span className="text-caption text-qm-text-tertiary mr-1">{selectedMode?.name ?? 'Default'}</span>
            <ChevronRight size={12} className="text-qm-text-tertiary" />
          </button>

          {showModes && (
            <div className="border-t border-qm-border-subtle bg-qm-surface-dark">
              {BUILT_IN_MODES.map((mode) => (
                <button
                  key={mode.name}
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

          {/* Settings */}
          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 w-full px-3 py-2 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Settings size={14} />
            Settings
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
