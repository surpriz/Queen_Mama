import { useState, useEffect } from 'react'
import { Activity, List, Users, Settings, Mic, Brain, BookUser, ChevronRight, Globe, Crown, MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GradientText } from '@/components/common/GradientText'
import { StatusIndicator, type StatusType } from '@/components/common/StatusIndicator'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useLicenseStore } from '@/stores/licenseStore'
import type { NavItem } from './DashboardLayout'

interface SidebarProps {
  activeItem: NavItem
  onItemClick: (item: NavItem) => void
}

const NAV_ITEMS: { id: NavItem; label: string; subtitle: string; icon: typeof Activity }[] = [
  { id: 'sessions', label: 'Sessions', subtitle: 'Past recordings', icon: List },
  { id: 'live', label: 'Live Session', subtitle: 'Active session', icon: Activity },
  { id: 'modes', label: 'Modes', subtitle: 'AI personalities', icon: Users },
  { id: 'knowledgeBase', label: 'Knowledge', subtitle: 'AI memory', icon: Brain },
  { id: 'contacts', label: 'Contacts', subtitle: 'People', icon: BookUser },
  { id: 'settings', label: 'Settings', subtitle: 'Configuration', icon: Settings },
]

function formatDuration(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function AudioLevelBar({ level }: { level: number }) {
  const clamped = Math.min(Math.max(level, 0), 1)
  return (
    <div className="w-full h-1.5 rounded-full bg-qm-surface-medium overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-qm-accent to-purple-400 transition-all duration-100"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

function LicenseBadge() {
  const plan = useLicenseStore((s) => s.currentLicense.plan)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isPro = useLicenseStore((s) => s.isPro)

  if (!isAuthenticated) {
    return (
      <div className="px-3 py-2 rounded-qm-md bg-qm-surface-light">
        <span className="text-caption text-qm-text-tertiary">Not Connected</span>
      </div>
    )
  }

  if (isPro()) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-qm-md bg-qm-accent/10">
        <Crown size={12} className="text-qm-accent" />
        <span className="text-caption font-medium text-qm-accent capitalize">{plan}</span>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 rounded-qm-md bg-qm-surface-light">
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold text-qm-accent">FREE</span>
        <span className="text-caption-sm text-qm-text-tertiary">Upgrade for more</span>
      </div>
    </div>
  )
}

export function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const sessionStartedAt = useAppStore((s) => s.sessionStartedAt)
  const audioLevel = useAppStore((s) => s.audioLevel)
  const currentUser = useAuthStore((s) => s.currentUser)

  const sessionStatus: StatusType = isSessionActive ? 'active' : 'idle'

  // Timer that updates every second when session is active
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isSessionActive) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isSessionActive])

  const handleOpenWebDashboard = () => {
    window.open('https://queenmama.co/dashboard', '_blank')
  }

  return (
    <div className="w-[240px] min-w-[220px] max-w-[280px] flex flex-col bg-qm-bg-secondary border-r border-qm-border-subtle pt-12 titlebar-no-drag">
      {/* Logo */}
      <div className="px-5 pb-4">
        <GradientText as="h1" className="text-headline font-bold">
          Queen Mama
        </GradientText>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ id, label, subtitle, icon: Icon }) => {
          const isSelected = activeItem === id
          return (
            <button
              key={id}
              onClick={() => onItemClick(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-qm-md text-body-sm transition-colors',
                isSelected
                  ? 'bg-qm-accent/10 border border-qm-accent/30 text-qm-text-primary'
                  : 'text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary border border-transparent',
              )}
            >
              {/* Icon circle: gradient when selected, transparent when not */}
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-colors',
                  isSelected
                    ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end'
                    : 'bg-qm-surface-light',
                )}
              >
                <Icon size={14} className={isSelected ? 'text-white' : 'text-qm-text-secondary'} />
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span>{label}</span>
                <span className="text-caption-sm text-qm-text-tertiary">{subtitle}</span>
              </div>
              {id === 'live' && (
                <StatusIndicator status={sessionStatus} size={6} className="flex-shrink-0" />
              )}
              {isSelected && (
                <ChevronRight size={14} className="text-qm-text-tertiary flex-shrink-0" />
              )}
            </button>
          )
        })}
      </nav>

      {/* STATUS section */}
      <div className="px-3 pb-3 space-y-2">
        <span className="px-3 text-caption-sm font-semibold text-qm-text-tertiary uppercase tracking-wider">Status</span>

        {/* Recording / Idle status */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-qm-md',
            isSessionActive ? 'bg-emerald-500/10' : 'bg-qm-surface-light',
          )}
        >
          <StatusIndicator status={sessionStatus} size={8} />
          <div className="flex flex-col">
            <span className="text-body-sm text-qm-text-primary">
              {isSessionActive ? 'Recording' : 'No session active'}
            </span>
            {isSessionActive && sessionStartedAt && (
              <span className="text-caption-sm text-qm-text-tertiary">
                {formatDuration(sessionStartedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Audio Level (only when recording) */}
        {isSessionActive && (
          <div className="px-3 py-2 rounded-qm-md bg-qm-surface-light space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Mic size={11} className="text-qm-accent" />
              <span className="text-caption text-qm-text-secondary">Audio Level</span>
            </div>
            <AudioLevelBar level={audioLevel} />
          </div>
        )}

        {/* License badge */}
        <LicenseBadge />

        {/* Web Dashboard button */}
        <button
          onClick={handleOpenWebDashboard}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-qm-accent/80 hover:bg-qm-accent text-white text-caption font-medium transition-colors"
        >
          <Globe size={12} />
          Web Dashboard
        </button>
      </div>

      {/* User info + Feedback */}
      <div className="px-4 py-3 border-t border-qm-border-subtle">
        {currentUser && (
          <>
            <p className="text-body-sm text-qm-text-primary truncate">{currentUser.name || currentUser.email}</p>
            <p className="text-caption text-qm-text-tertiary truncate">{currentUser.email}</p>
          </>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => window.open('https://queenmama.co/feedback', '_blank')}
            className="flex items-center gap-1 text-caption-sm text-qm-text-tertiary hover:text-qm-text-secondary transition-colors"
          >
            <MessageSquareText size={10} />
            Feedback
          </button>
        </div>
      </div>
    </div>
  )
}
