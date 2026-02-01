import { Activity, FileText, Users, Settings, Cloud, CloudOff, Globe, MessageCircle, HelpCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GradientText } from '@/components/common/GradientText'
import { StatusIndicator, type StatusType } from '@/components/common/StatusIndicator'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import type { NavItem } from './DashboardLayout'

interface SidebarProps {
  activeItem: NavItem
  onItemClick: (item: NavItem) => void
}

const NAV_ITEMS: { id: NavItem; label: string; subtitle: string; icon: typeof Activity }[] = [
  { id: 'sessions', label: 'Sessions', subtitle: 'Past recordings', icon: FileText },
  { id: 'live', label: 'Live Session', subtitle: 'Active session', icon: Activity },
  { id: 'modes', label: 'Modes', subtitle: 'AI personalities', icon: Users },
  { id: 'settings', label: 'Settings', subtitle: 'Configuration', icon: Settings },
]

export function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentUser = useAuthStore((s) => s.currentUser)
  const authState = useAuthStore((s) => s.authState)

  const sessionStatus: StatusType = isSessionActive ? 'active' : 'idle'
  const isConnected = authState === 'authenticated' && currentUser

  const handleSignIn = () => {
    // Open sign in flow
    window.electronAPI?.openExternal('https://queenmama.ai/signin')
  }

  const handleOpenWebDashboard = () => {
    window.electronAPI?.openExternal('https://queenmama.ai/dashboard')
  }

  return (
    <div className="w-[240px] min-w-[220px] max-w-[280px] flex flex-col bg-qm-bg-secondary border-r border-qm-border-subtle pt-12">
      {/* Logo */}
      <div className="px-5 pb-4">
        <GradientText as="h1" className="text-headline font-bold">
          Queen Mama
        </GradientText>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, subtitle, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onItemClick(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-qm-md transition-colors group',
              activeItem === id
                ? 'bg-qm-surface-hover'
                : 'hover:bg-qm-surface-light',
            )}
          >
            <Icon size={18} className={activeItem === id ? 'text-qm-text-primary' : 'text-qm-text-secondary'} />
            <div className="flex-1 text-left">
              <span className={cn(
                'text-body-sm block',
                activeItem === id ? 'text-qm-text-primary font-medium' : 'text-qm-text-secondary',
              )}>
                {label}
              </span>
              <span className="text-caption text-qm-text-disabled">{subtitle}</span>
            </div>
            <ChevronRight size={14} className={cn(
              'text-qm-text-disabled transition-colors',
              activeItem === id && 'text-qm-text-tertiary',
            )} />
          </button>
        ))}
      </nav>

      {/* Status section */}
      <div className="px-4 py-3 border-t border-qm-border-subtle">
        <span className="text-[10px] uppercase tracking-wider text-qm-text-disabled font-semibold">Status</span>
        <div className="flex items-center gap-2 mt-2">
          <StatusIndicator status={sessionStatus} size={8} />
          <span className="text-body-sm text-qm-text-secondary capitalize">{sessionStatus}</span>
        </div>
      </div>

      {/* Connection status and Web Dashboard */}
      <div className="px-4 py-3 border-t border-qm-border-subtle space-y-3">
        {/* Connection status */}
        <button
          onClick={handleSignIn}
          className="flex items-center gap-3 w-full text-left group"
        >
          {isConnected ? (
            <Cloud size={18} className="text-qm-success" />
          ) : (
            <CloudOff size={18} className="text-qm-text-disabled" />
          )}
          <div className="flex-1">
            <span className="text-body-sm text-qm-text-secondary block">
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
            <span className="text-caption text-qm-text-disabled">
              {isConnected ? currentUser?.email : 'Tap to sign in'}
            </span>
          </div>
          <ChevronRight size={14} className="text-qm-text-disabled group-hover:text-qm-text-tertiary" />
        </button>

        {/* Web Dashboard button */}
        <button
          onClick={handleOpenWebDashboard}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Globe size={14} />
          Web Dashboard
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-qm-border-subtle flex items-center justify-between text-caption text-qm-text-disabled">
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1 hover:text-qm-text-secondary transition-colors">
            <MessageCircle size={12} />
            Feedback
          </button>
          <button className="flex items-center gap-1 hover:text-qm-text-secondary transition-colors">
            <HelpCircle size={12} />
            Tour
          </button>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">⌘</kbd>
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">⇧</kbd>
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">S</kbd>
        </div>
      </div>
    </div>
  )
}
