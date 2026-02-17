import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileText, Plus, X } from 'lucide-react'
import type { Mode, AttachedFile } from '@/types/models'
import { AttachedFileType } from '@/types/models'
import { cn } from '@/lib/utils'

interface ModeEditorProps {
  mode: Mode | null
  onSave: (mode: Mode) => void
  onCancel: () => void
}

export function ModeEditor({ mode, onSave, onCancel }: ModeEditorProps) {
  const [name, setName] = useState(mode?.name || '')
  const [systemPrompt, setSystemPrompt] = useState(mode?.systemPrompt || '')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(mode?.attachedFiles || [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) return

    onSave({
      id: mode?.id || uuidv4(),
      name: name.trim(),
      systemPrompt: systemPrompt.trim(),
      isDefault: false,
      createdAt: mode?.createdAt || new Date().toISOString(),
      attachedFiles,
    })
  }

  const handleAddFile = async () => {
    const result = await window.electronAPI?.dialog?.openFile()
    if (!result || result.canceled || result.filePaths.length === 0) return

    const filePath = result.filePaths[0]
    const fileName = filePath.split(/[\\/]/).pop() || 'file'
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    let fileType = AttachedFileType.Document
    if (ext === 'pdf' && fileName.toLowerCase().includes('resume')) {
      fileType = AttachedFileType.Resume
    } else if (ext === 'pdf' && fileName.toLowerCase().includes('pitch')) {
      fileType = AttachedFileType.PitchDeck
    }

    const newFile: AttachedFile = {
      id: uuidv4(),
      name: fileName,
      path: filePath,
      type: fileType,
    }

    setAttachedFiles((prev) => [...prev, newFile])
  }

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
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
            rows={10}
            className="w-full px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none resize-y"
          />
        </div>

        {/* Attached Files */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-label-md text-qm-text-secondary">Attached Files</label>
            <button
              type="button"
              onClick={handleAddFile}
              className="flex items-center gap-1 px-2.5 py-1 rounded-qm-sm bg-qm-accent/10 text-qm-accent text-caption font-medium hover:bg-qm-accent/20 transition-colors"
            >
              <Plus size={12} />
              Add File
            </button>
          </div>

          {attachedFiles.length === 0 ? (
            <div className="rounded-qm-md border border-dashed border-qm-border-subtle p-4 text-center">
              <p className="text-caption text-qm-text-tertiary">
                No files attached. Add PDF, TXT, or RTF files to include in AI context.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-qm-sm bg-qm-surface-light border border-qm-border-subtle group"
                >
                  <FileText size={14} className="text-qm-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-qm-text-primary truncate">{file.name}</p>
                    <p className="text-caption text-qm-text-tertiary truncate">{file.path}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded uppercase',
                    file.type === AttachedFileType.Resume
                      ? 'bg-blue-500/20 text-blue-400'
                      : file.type === AttachedFileType.PitchDeck
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-qm-surface-medium text-qm-text-tertiary',
                  )}>
                    {file.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="p-1 rounded-qm-sm text-qm-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
