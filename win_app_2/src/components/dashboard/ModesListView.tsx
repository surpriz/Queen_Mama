import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Check, Copy, Briefcase, Users, TrendingUp, Sparkles, Brain, Code } from 'lucide-react'
import { BUILT_IN_MODE_NAMES, type Mode } from '@/types/models'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { ModeEditor } from './ModeEditor'
import { useModes } from '@/hooks/useModes'
import { v4 as uuidv4 } from 'uuid'

const MODE_ICONS: Record<string, typeof Briefcase> = {
  Default: Sparkles,
  Limitless: Brain,
  Professional: Briefcase,
  Interview: Users,
  Sales: TrendingUp,
  'Developer Exam': Code,
}

/** Public descriptions for built-in modes (hides actual system prompts) */
const BUILT_IN_DESCRIPTIONS: Record<string, string> = {
  Default:
    'General-purpose real-time coaching assistant. Adapts to any situation — meetings, exams, workflows — with actionable, context-aware advice. Matches the language of the conversation automatically.',
  Limitless:
    'Enhanced cognitive mode providing deep analysis, instant pattern recognition, and encyclopedic knowledge across all domains. Thinks several steps ahead and connects information from multiple fields.',
  Professional:
    'Optimized for corporate environments — meetings, negotiations, presentations, and strategy sessions. Delivers executive-level insights, business acumen, and professional communication guidance.',
  Interview:
    'Specialized coaching for job interviews. Helps craft compelling, structured answers using proven methodologies. Adapts to technical, behavioral, and situational questions in real time.',
  Sales:
    'Sales-focused coaching for closing deals with confidence. Provides real-time objection handling, persuasion techniques, and strategic negotiation guidance tailored to the conversation flow.',
  'Developer Exam':
    'Coding assessment companion for online exams (CodinGame, LeetCode, HackerRank, etc.). Provides optimal algorithmic approaches, complexity analysis, and clean implementation guidance.',
}

function getModeIcon(name: string) {
  return MODE_ICONS[name] ?? Sparkles
}

export function ModesListView() {
  const activeMode = useAppStore((s) => s.selectedMode)
  const setActiveMode = useAppStore((s) => s.setSelectedMode)
  const { modes, loading, saveMode, deleteMode } = useModes()
  const [editingMode, setEditingMode] = useState<Mode | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewingMode, setViewingMode] = useState<Mode | null>(null)

  // Auto-select Default mode on first load if no mode is active
  useEffect(() => {
    if (!loading && modes.length > 0 && !activeMode) {
      const defaultMode = modes.find((m) => m.name === 'Default')
      if (defaultMode) setActiveMode(defaultMode)
    }
  }, [loading, modes, activeMode, setActiveMode])

  const handleSelect = (mode: Mode) => {
    setViewingMode(mode)
    setActiveMode(mode)
  }

  const handleSave = async (mode: Mode) => {
    await saveMode(mode)
    setEditingMode(null)
    setIsCreating(false)
  }

  const handleDelete = async (id: string) => {
    await deleteMode(id)
    if (activeMode?.id === id) {
      const defaultMode = modes.find((m) => m.name === 'Default')
      setActiveMode(defaultMode ?? null)
    }
    if (viewingMode?.id === id) setViewingMode(null)
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

  // For split view: show editor on the right. Use viewingMode if set, otherwise show activeMode
  const currentView = viewingMode ?? activeMode
  const detailMode = editingMode || (isCreating ? null : currentView ? modes.find((m) => m.id === currentView.id || m.name === currentView.name) : null)

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
    const isActive = activeMode?.id === mode.id || activeMode?.name === mode.name
    const isViewing = currentView?.id === mode.id || currentView?.name === mode.name
    const ModeIcon = getModeIcon(mode.name)

    return (
      <div
        key={mode.id}
        onClick={() => handleSelect(mode)}
        className={cn(
          'flex items-center gap-3 px-3 py-3 rounded-qm-lg cursor-pointer transition-all group',
          isViewing
            ? 'bg-qm-accent/10 border border-qm-accent/30'
            : isActive
              ? 'bg-emerald-500/5 border border-emerald-500/20'
              : 'hover:bg-qm-surface-light border border-transparent',
        )}
      >
        {/* Mode icon */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
            isViewing
              ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end'
              : isActive
                ? 'bg-emerald-500/15'
                : 'bg-qm-surface-light',
          )}
        >
          <ModeIcon size={14} className={isViewing ? 'text-white' : isActive ? 'text-emerald-400' : 'text-qm-text-secondary'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-body-sm font-medium text-qm-text-primary truncate">{mode.name}</h3>
            {isActive && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                Active
              </span>
            )}
            {isActive && <Check size={12} className="text-emerald-400 flex-shrink-0" />}
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
                    {(activeMode?.id === detailMode.id || activeMode?.name === detailMode.name) && ' · Active'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
              <h4 className="text-label-md text-qm-text-secondary mb-2">
                {BUILT_IN_DESCRIPTIONS[detailMode.name] ? 'Description' : 'System Prompt'}
              </h4>
              <p className="text-body-sm text-qm-text-primary leading-relaxed whitespace-pre-wrap">
                {BUILT_IN_DESCRIPTIONS[detailMode.name] ?? detailMode.systemPrompt}
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
