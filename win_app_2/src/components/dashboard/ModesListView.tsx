import { useState } from 'react'
import { Plus, Edit, Trash2, Check } from 'lucide-react'
import { BUILT_IN_MODES, BUILT_IN_MODE_NAMES, type Mode } from '@/types/models'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { ModeEditor } from './ModeEditor'

export function ModesListView() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const [customModes, setCustomModes] = useState<Mode[]>([])
  const [editingMode, setEditingMode] = useState<Mode | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const allModes: Mode[] = [
    ...BUILT_IN_MODES.map((m, i) => ({
      ...m,
      id: `builtin-${i}`,
      createdAt: new Date().toISOString(),
    })),
    ...customModes,
  ]

  const handleSelect = (mode: Mode) => {
    setSelectedMode(mode)
  }

  const handleSave = (mode: Mode) => {
    if (customModes.find((m) => m.id === mode.id)) {
      setCustomModes(customModes.map((m) => (m.id === mode.id ? mode : m)))
    } else {
      setCustomModes([...customModes, mode])
    }
    setEditingMode(null)
    setIsCreating(false)
  }

  const handleDelete = (id: string) => {
    setCustomModes(customModes.filter((m) => m.id !== id))
    if (selectedMode?.id === id) setSelectedMode(null)
  }

  if (editingMode || isCreating) {
    return (
      <ModeEditor
        mode={editingMode}
        onSave={handleSave}
        onCancel={() => {
          setEditingMode(null)
          setIsCreating(false)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-title-sm font-semibold text-qm-text-primary">Modes</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-shadow"
        >
          <Plus size={14} /> New Mode
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {allModes.map((mode) => {
          const isBuiltIn = BUILT_IN_MODE_NAMES.includes(
            mode.name as (typeof BUILT_IN_MODE_NAMES)[number],
          )
          const isSelected = selectedMode?.name === mode.name

          return (
            <div
              key={mode.id}
              onClick={() => handleSelect(mode)}
              className={cn(
                'flex items-center gap-4 p-4 rounded-qm-lg cursor-pointer transition-all group',
                isSelected
                  ? 'bg-qm-accent/10 border border-qm-accent/30'
                  : 'bg-qm-surface-medium hover:bg-qm-surface-hover border border-transparent',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-body-md font-medium text-qm-text-primary">{mode.name}</h3>
                  {isSelected && <Check size={14} className="text-qm-accent" />}
                  {isBuiltIn && (
                    <span className="text-caption-sm text-qm-text-tertiary bg-qm-surface-light px-1.5 py-0.5 rounded">
                      Built-in
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-qm-text-secondary mt-1 line-clamp-2">
                  {mode.systemPrompt.slice(0, 120)}...
                </p>
              </div>

              {!isBuiltIn && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingMode(mode)
                    }}
                    className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-tertiary"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(mode.id)
                    }}
                    className="p-2 rounded-qm-md hover:bg-qm-error-light text-qm-text-tertiary hover:text-qm-error"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
