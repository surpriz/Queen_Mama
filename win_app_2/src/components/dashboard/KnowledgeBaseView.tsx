import { useState, useEffect, useCallback } from 'react'
import { Search, Brain, Trash2, RefreshCw, WifiOff, AlertCircle } from 'lucide-react'
import { fetchKnowledgeAtoms, deleteKnowledgeAtom, type KnowledgeAtom } from '@/services/proxy/proxyApiClient'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { Feature } from '@/types/auth'

const TYPE_COLORS: Record<string, string> = {
  fact: 'bg-blue-500/20 text-blue-400',
  preference: 'bg-purple-500/20 text-purple-400',
  instruction: 'bg-amber-500/20 text-amber-400',
  context: 'bg-emerald-500/20 text-emerald-400',
  OBJECTION_RESPONSE: 'bg-red-500/20 text-red-400',
  TALKING_POINT: 'bg-blue-500/20 text-blue-400',
  QUESTION: 'bg-amber-500/20 text-amber-400',
  CLOSING_TECHNIQUE: 'bg-emerald-500/20 text-emerald-400',
  TOPIC_EXPERTISE: 'bg-purple-500/20 text-purple-400',
}

function getErrorInfo(errorMessage: string): { title: string; description: string; icon: 'network' | 'error' } {
  const msg = errorMessage.toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network')) {
    return {
      title: 'Unable to connect to server',
      description: 'Make sure the backend server is running and accessible.',
      icon: 'network',
    }
  }
  if (msg.includes('not authenticated') || msg.includes('401')) {
    return {
      title: 'Authentication required',
      description: 'Please log in to access the Knowledge Base.',
      icon: 'error',
    }
  }
  if (msg.includes('enterprise_required') || msg.includes('403')) {
    return {
      title: 'Enterprise plan required',
      description: 'Knowledge Base is available on Enterprise plans.',
      icon: 'error',
    }
  }
  return {
    title: 'Failed to load Knowledge Base',
    description: errorMessage,
    icon: 'error',
  }
}

export function KnowledgeBaseView() {
  const [atoms, setAtoms] = useState<KnowledgeAtom[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canUseKB = useLicenseStore((s) => s.canUse)(Feature.KnowledgeBase)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const loadAtoms = useCallback(async () => {
    if (!isAuthenticated) {
      setError('not authenticated')
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchKnowledgeAtoms()
      setAtoms(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge base')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (canUseKB.type === 'allowed') {
      loadAtoms()
    } else {
      setIsLoading(false)
    }
  }, [canUseKB.type, loadAtoms])

  const handleDelete = useCallback(async (atomId: string) => {
    try {
      await deleteKnowledgeAtom(atomId)
      setAtoms((prev) => prev.filter((a) => a.id !== atomId))
    } catch (err) {
      console.error('Failed to delete atom:', err)
    }
  }, [])

  const filtered = atoms.filter((a) =>
    a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (canUseKB.type !== 'allowed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Brain size={48} className="text-qm-text-tertiary" />
        <h2 className="text-title-sm font-semibold text-qm-text-primary">Knowledge Base</h2>
        <p className="text-body-sm text-qm-text-secondary text-center max-w-md">
          Knowledge Base is available on Enterprise plans. Upgrade to unlock AI-powered contextual intelligence.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain size={22} className="text-qm-accent" />
          <h2 className="text-title-sm font-semibold text-qm-text-primary">Knowledge Base</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-qm-text-tertiary">
            {filtered.length} atoms
          </span>
          <button
            onClick={loadAtoms}
            className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search knowledge..."
          className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-qm-text-tertiary text-body-sm">
            Loading knowledge base...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            {(() => {
              const info = getErrorInfo(error)
              return (
                <>
                  {info.icon === 'network' ? (
                    <WifiOff size={32} className="text-qm-text-tertiary" />
                  ) : (
                    <AlertCircle size={32} className="text-qm-text-tertiary" />
                  )}
                  <p className="text-body-sm font-medium text-qm-text-secondary">{info.title}</p>
                  <p className="text-caption text-qm-text-tertiary text-center max-w-sm">{info.description}</p>
                  <button
                    onClick={loadAtoms}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-surface-hover text-body-sm text-qm-text-secondary transition-colors"
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                </>
              )
            })()}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-qm-text-tertiary text-body-sm">
            {searchQuery ? 'No matching atoms' : 'No knowledge atoms yet'}
          </div>
        ) : (
          filtered.map((atom) => (
            <div
              key={atom.id}
              className="flex items-start gap-3 p-4 rounded-qm-lg bg-qm-surface-medium hover:bg-qm-surface-hover transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[atom.type] || 'bg-gray-500/20 text-gray-400'}`}>
                    {atom.type.replace(/_/g, ' ')}
                  </span>
                  {atom.usageCount > 0 && (
                    <span className="text-caption-sm text-qm-text-tertiary">
                      Used {atom.usageCount}x
                      {atom.helpfulRatio != null && ` · ${Math.round(atom.helpfulRatio * 100)}% helpful`}
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-qm-text-primary leading-relaxed">
                  {atom.content}
                </p>
                <p className="text-caption-sm text-qm-text-tertiary mt-1">
                  {new Date(atom.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(atom.id)}
                className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
