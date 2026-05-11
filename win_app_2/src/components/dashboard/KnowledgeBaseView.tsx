import { useState, useEffect, useCallback } from 'react'
import { Search, Brain, Trash2, RefreshCw, WifiOff, AlertCircle } from 'lucide-react'
import { fetchKnowledgeAtoms, deleteKnowledgeAtom, type KnowledgeAtom } from '@/services/proxy/proxyApiClient'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuthStore } from '@/stores/authStore'
import { Feature } from '@/types/auth'
import { Skeleton } from '@/components/common/Skeleton'
import { toast } from '@/stores/toastStore'

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
      toast.success('Atom deleted')
    } catch (err) {
      console.error('Failed to delete atom:', err)
      toast.error('Failed to delete atom', err instanceof Error ? err.message : undefined)
    }
  }, [])

  const filtered = atoms.filter((a) =>
    a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (canUseKB.type !== 'allowed') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-10 text-center">
        <div className="relative w-28 h-28 mb-2 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-20 blur-2xl animate-qm-pulse" />
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-35 blur-lg" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
            <Brain size={26} strokeWidth={1.5} className="text-white" />
          </div>
        </div>
        <h2 className="font-display text-title-md font-semibold text-qm-text-primary tracking-tight">Knowledge Base</h2>
        <p className="text-body-sm text-qm-text-tertiary text-center max-w-md leading-relaxed">
          Knowledge Base is available on Enterprise plans. Upgrade to unlock AI-powered contextual intelligence.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow">
            <Brain size={15} strokeWidth={1.75} className="text-white" />
          </div>
          <h2 className="font-display text-title-sm font-semibold text-qm-text-primary tracking-tight">Knowledge Base</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-qm-text-tertiary tabular-nums">
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
          className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-medium text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:outline-none transition-all focus:shadow-qm-glow"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-qm-lg bg-qm-bg-tertiary/60 shadow-qm-elev-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-[80%]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            {(() => {
              const info = getErrorInfo(error)
              const Icon = info.icon === 'network' ? WifiOff : AlertCircle
              return (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center shadow-[0_0_0_1px_rgba(239,68,68,0.2),0_4px_16px_-2px_rgba(239,68,68,0.25)]">
                    <Icon size={22} strokeWidth={1.75} className="text-red-400" />
                  </div>
                  <p className="font-display text-body-lg font-semibold text-qm-text-primary tracking-tight">{info.title}</p>
                  <p className="text-caption text-qm-text-tertiary max-w-sm leading-relaxed">{info.description}</p>
                  <button
                    onClick={loadAtoms}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow-strong hover-scale transition-all"
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                </>
              )
            })()}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-10 text-center">
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-20 blur-2xl animate-qm-pulse" />
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-35 blur-lg" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
                <Brain size={22} strokeWidth={1.5} className="text-white" />
              </div>
            </div>
            <h3 className="font-display text-title-sm font-semibold text-qm-text-primary mb-2 tracking-tight">
              {searchQuery ? 'No matching atoms' : 'No knowledge atoms yet'}
            </h3>
            <p className="text-caption text-qm-text-tertiary max-w-sm leading-relaxed">
              {searchQuery ? 'Try a different query' : 'Atoms accumulate as sessions complete'}
            </p>
          </div>
        ) : (
          filtered.map((atom) => (
            <div
              key={atom.id}
              className="qm-card-hover flex items-start gap-3 p-4 rounded-qm-lg bg-qm-bg-tertiary/60 shadow-qm-elev-1 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[atom.type] || 'bg-gray-500/20 text-gray-400'}`}>
                    {atom.type.replace(/_/g, ' ')}
                  </span>
                  {atom.usageCount > 0 && (
                    <span className="text-caption-sm text-qm-text-tertiary tabular-nums">
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
