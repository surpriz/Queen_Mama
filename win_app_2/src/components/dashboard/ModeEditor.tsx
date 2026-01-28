import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Mode } from '@/types/models'

interface ModeEditorProps {
  mode: Mode | null
  onSave: (mode: Mode) => void
  onCancel: () => void
}

export function ModeEditor({ mode, onSave, onCancel }: ModeEditorProps) {
  const [name, setName] = useState(mode?.name || '')
  const [systemPrompt, setSystemPrompt] = useState(mode?.systemPrompt || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) return

    onSave({
      id: mode?.id || uuidv4(),
      name: name.trim(),
      systemPrompt: systemPrompt.trim(),
      isDefault: false,
      createdAt: mode?.createdAt || new Date().toISOString(),
      attachedFiles: mode?.attachedFiles || [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-title-sm font-semibold text-qm-text-primary">
          {mode ? 'Edit Mode' : 'Create Mode'}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-qm-md bg-qm-surface-medium text-qm-text-secondary text-body-sm hover:bg-qm-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-shadow"
          >
            Save
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-label-md text-qm-text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Technical Interview"
            required
            className="w-full px-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>

        <div className="flex-1">
          <label className="block text-label-md text-qm-text-secondary mb-1.5">
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Describe how the AI should behave in this mode..."
            required
            rows={12}
            className="w-full px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none resize-y"
          />
        </div>
      </div>
    </form>
  )
}
