import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Move, Settings, Trash2, Monitor, EyeOff, Eye, Keyboard } from 'lucide-react'
import { useOverlayStore, type OverlayPosition } from '@/stores/overlayStore'
import { useConfigStore } from '@/stores/configStore'
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
  const menuRef = useRef<HTMLDivElement>(null)
  const position = useOverlayStore((s) => s.position)
  const setPosition = useOverlayStore((s) => s.setPosition)
  const clearHistory = useOverlayStore((s) => s.clearHistory)
  const isUndetectabilityEnabled = useConfigStore((s) => s.isUndetectabilityEnabled)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowPositions(false)
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

  const handleToggleHiddenMode = () => {
    updateConfig({ isUndetectabilityEnabled: !isUndetectabilityEnabled })
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-qm-surface-light text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-qm-bg-elevated border border-qm-border-subtle rounded-qm-lg shadow-qm-lg z-50 overflow-hidden">
          {/* Hidden Mode Toggle */}
          <button
            onClick={handleToggleHiddenMode}
            className="flex items-center justify-between w-full px-3 py-2.5 text-body-sm hover:bg-qm-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              {isUndetectabilityEnabled ? (
                <EyeOff size={14} className="text-qm-accent" />
              ) : (
                <Eye size={14} className="text-qm-text-secondary" />
              )}
              <span className={isUndetectabilityEnabled ? 'text-qm-accent' : 'text-qm-text-secondary'}>
                Hidden Mode
              </span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1 py-0.5 rounded bg-qm-surface-light text-qm-text-disabled text-[9px] font-mono">
                Ctrl+H
              </kbd>
              {/* Toggle indicator */}
              <div
                className={cn(
                  'w-8 h-4 rounded-full transition-colors relative',
                  isUndetectabilityEnabled ? 'bg-qm-accent' : 'bg-qm-surface-medium',
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                    isUndetectabilityEnabled ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </div>
            </div>
          </button>

          <div className="border-t border-qm-border-subtle" />

          {/* Position submenu */}
          <button
            onClick={() => setShowPositions(!showPositions)}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Move size={14} />
            Position
            <span className="ml-auto text-qm-text-disabled">▸</span>
          </button>

          {showPositions && (
            <div className="border-t border-qm-border-subtle bg-qm-bg-secondary">
              {POSITIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handlePositionChange(value)}
                  className={cn(
                    'flex items-center gap-2 w-full px-4 py-2 text-caption transition-colors',
                    position === value
                      ? 'text-qm-accent bg-qm-accent/10'
                      : 'text-qm-text-tertiary hover:bg-qm-surface-hover',
                  )}
                >
                  <Monitor size={12} />
                  {label}
                  {position === value && <span className="ml-auto">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Settings */}
          <button
            onClick={handleOpenSettings}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>

          {/* Keyboard shortcuts */}
          <button
            onClick={() => {
              // TODO: Open keyboard shortcuts modal
              setIsOpen(false)
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <Keyboard size={14} />
            Shortcuts
          </button>

          <div className="border-t border-qm-border-subtle" />

          {/* Clear context */}
          <button
            onClick={handleClearContext}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-body-sm text-qm-error hover:bg-qm-error/10 transition-colors"
          >
            <Trash2 size={14} />
            Clear Context
          </button>
        </div>
      )}
    </div>
  )
}
