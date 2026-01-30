import { Activity, List, Users, Settings } from 'lucide-react'
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

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof Activity }[] = [
  { id: 'live', label: 'Live Session', icon: Activity },
  { id: 'sessions', label: 'Sessions', icon: List },
  { id: 'modes', label: 'Modes', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentUser = useAuthStore((s) => s.currentUser)

  const sessionStatus: StatusType = isSessionActive ? 'active' : 'idle'

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
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onItemClick(id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-qm-md text-body-sm transition-colors',
              activeItem === id
                ? 'bg-qm-surface-hover text-qm-text-primary'
                : 'text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary',
            )}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'live' && (
              <StatusIndicator status={sessionStatus} size={6} className="ml-auto" />
            )}
          </button>
        ))}
      </nav>

      {/* User info */}
      {currentUser && (
        <div className="px-4 py-3 border-t border-qm-border-subtle">
          <p className="text-body-sm text-qm-text-primary truncate">{currentUser.name || currentUser.email}</p>
          <p className="text-caption text-qm-text-tertiary truncate">{currentUser.email}</p>
        </div>
      )}
    </div>
  )
}
