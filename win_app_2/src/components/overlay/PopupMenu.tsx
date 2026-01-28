import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Move, Settings, Trash2, Monitor } from 'lucide-react'
import { useOverlayStore, type OverlayPosition } from '@/stores/overlayStore'
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
