import { useState } from 'react'
import { Plus, Edit, Trash2, Check, Copy } from 'lucide-react'
import { BUILT_IN_MODE_NAMES, type Mode } from '@/types/models'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { ModeEditor } from './ModeEditor'
import { useModes } from '@/hooks/useModes'
import { v4 as uuidv4 } from 'uuid'

export function ModesListView() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const { modes, loading, saveMode, deleteMode } = useModes()
  const [editingMode, setEditingMode] = useState<Mode | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleSelect = (mode: Mode) => {
    setSelectedMode(mode)
  }

  const handleSave = async (mode: Mode) => {
    await saveMode(mode)
    setEditingMode(null)
    setIsCreating(false)
  }

  const handleDelete = async (id: string) => {
    await deleteMode(id)
    if (selectedMode?.id === id) setSelectedMode(null)
  }

  const handleDuplicate = async (mode: Mode) => {
    const duplicate: Mode = {
      ...mode,
      id: uuidv4(),
      name: `${mode.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    }
    await saveMode(duplicate)
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

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-body-sm text-qm-text-tertiary">Loading modes...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {modes.map((mode) => {
            const isBuiltIn = BUILT_IN_MODE_NAMES.includes(
              mode.name as (typeof BUILT_IN_MODE_NAMES)[number],
            )
            const isSelected = selectedMode?.id === mode.id || selectedMode?.name === mode.name

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

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isBuiltIn && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingMode(mode)
                        }}
                        className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-tertiary"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicate(mode)
                        }}
                        className="p-2 rounded-qm-md hover:bg-qm-surface-hover text-qm-text-tertiary"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(mode.id)
                        }}
                        className="p-2 rounded-qm-md hover:bg-qm-error-light text-qm-text-tertiary hover:text-qm-error"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
