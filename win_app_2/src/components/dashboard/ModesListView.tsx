import { useState } from 'react'
import { Plus, Edit, Trash2, Check, Copy, Briefcase, Users, TrendingUp, Sparkles, GraduationCap } from 'lucide-react'
import { BUILT_IN_MODE_NAMES, type Mode } from '@/types/models'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { ModeEditor } from './ModeEditor'
import { useModes } from '@/hooks/useModes'
import { v4 as uuidv4 } from 'uuid'

const MODE_ICONS: Record<string, typeof Briefcase> = {
  Professional: Briefcase,
  Interview: Users,
  Sales: TrendingUp,
  Default: Sparkles,
  DevExam: GraduationCap,
}

function getModeIcon(name: string) {
  return MODE_ICONS[name] ?? Sparkles
}

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

  const builtInModes = modes.filter((m) =>
    BUILT_IN_MODE_NAMES.includes(m.name as (typeof BUILT_IN_MODE_NAMES)[number]),
  )
  const customModes = modes.filter(
    (m) => !BUILT_IN_MODE_NAMES.includes(m.name as (typeof BUILT_IN_MODE_NAMES)[number]),
  )

  // For split view: show editor on the right
  const detailMode = editingMode || (isCreating ? null : selectedMode ? modes.find((m) => m.id === selectedMode.id || m.name === selectedMode.name) : null)

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

  const renderModeItem = (mode: Mode) => {
    const isBuiltIn = BUILT_IN_MODE_NAMES.includes(
      mode.name as (typeof BUILT_IN_MODE_NAMES)[number],
    )
    const isSelected = selectedMode?.id === mode.id || selectedMode?.name === mode.name
    const isDefault = mode.isDefault
    const ModeIcon = getModeIcon(mode.name)

    return (
      <div
        key={mode.id}
        onClick={() => handleSelect(mode)}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-qm-lg cursor-pointer transition-all group',
          isSelected
            ? 'bg-qm-accent/10 border border-qm-accent/30'
            : 'hover:bg-qm-surface-light border border-transparent',
        )}
      >
        {/* Mode icon */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
            isSelected
              ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end'
              : 'bg-qm-surface-light',
          )}
        >
          <ModeIcon size={14} className={isSelected ? 'text-white' : 'text-qm-text-secondary'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-body-sm font-medium text-qm-text-primary truncate">{mode.name}</h3>
            {isDefault && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                Active
              </span>
            )}
            {isSelected && <Check size={12} className="text-qm-accent flex-shrink-0" />}
          </div>
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isBuiltIn && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingMode(mode)
                }}
                className="p-1.5 rounded-qm-sm hover:bg-qm-surface-hover text-qm-text-tertiary"
                title="Edit"
              >
                <Edit size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDuplicate(mode)
                }}
                className="p-1.5 rounded-qm-sm hover:bg-qm-surface-hover text-qm-text-tertiary"
                title="Duplicate"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(mode.id)
                }}
                className="p-1.5 rounded-qm-sm hover:bg-qm-error-light text-qm-text-tertiary hover:text-qm-error"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Mode list */}
      <div className="w-[320px] flex flex-col border-r border-qm-border-subtle">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-title-sm font-semibold text-qm-text-primary">Modes</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-caption font-medium hover:shadow-qm-glow hover-scale transition-all"
          >
            <Plus size={12} /> New Mode
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-body-sm text-qm-text-tertiary">Loading modes...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
            {/* Built-in section */}
            {builtInModes.length > 0 && (
              <div>
                <span className="px-3 text-caption-sm font-semibold text-qm-text-tertiary uppercase tracking-wider">
                  Built-in
                </span>
                <div className="mt-1.5 space-y-0.5">
                  {builtInModes.map(renderModeItem)}
                </div>
              </div>
            )}

            {/* Custom section */}
            {customModes.length > 0 && (
              <div>
                <span className="px-3 text-caption-sm font-semibold text-qm-text-tertiary uppercase tracking-wider">
                  Custom
                </span>
                <div className="mt-1.5 space-y-0.5">
                  {customModes.map(renderModeItem)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel - Mode detail */}
      <div className="flex-1 flex flex-col">
        {detailMode ? (
          <div className="flex flex-col h-full p-6 overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-qm-gradient-start/10 to-qm-gradient-end/10 rounded-qm-lg mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end">
                  {(() => {
                    const ModeIcon = getModeIcon(detailMode.name)
                    return <ModeIcon size={18} className="text-white" />
                  })()}
                </div>
                <div>
                  <h3 className="text-title-sm font-semibold text-qm-text-primary">{detailMode.name}</h3>
                  <p className="text-caption text-qm-text-tertiary">
                    {BUILT_IN_MODE_NAMES.includes(detailMode.name as (typeof BUILT_IN_MODE_NAMES)[number]) ? 'Built-in mode' : 'Custom mode'}
                    {detailMode.isDefault && ' · Active'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
              <h4 className="text-label-md text-qm-text-secondary mb-2">System Prompt</h4>
              <p className="text-body-sm text-qm-text-primary leading-relaxed whitespace-pre-wrap">
                {detailMode.systemPrompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-qm-xl bg-qm-surface-light flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-qm-accent" />
            </div>
            <h3 className="text-title-sm font-semibold text-qm-text-primary mb-2">
              No Mode Selected
            </h3>
            <p className="text-body-sm text-qm-text-tertiary">
              Select a mode to view its details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
