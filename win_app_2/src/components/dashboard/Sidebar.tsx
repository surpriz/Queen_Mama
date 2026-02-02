import { Activity, FileText, Users, Settings, Cloud, CloudOff, Globe, MessageCircle, HelpCircle, ChevronRight, Crown, Mic, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GradientText } from '@/components/common/GradientText'
import { StatusIndicator, type StatusType } from '@/components/common/StatusIndicator'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useTourStore } from '@/stores/tourStore'
import { useShortcutsStore } from '@/stores/shortcutsStore'
import { AudioLevelIndicator } from './AudioLevelIndicator'
import type { NavItem } from './DashboardLayout'
import { getWebBaseUrl } from '@/services/config/appEnvironment'

// Audio level bar visualization
function AudioLevelBar() {
  const audioLevel = useAppStore((s) => s.audioLevel)

  return (
    <div className="relative h-1.5 bg-qm-surface-medium rounded-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end rounded-full transition-all duration-150 ease-out"
        style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
      />
    </div>
  )
}

interface SidebarProps {
  activeItem: NavItem
  onItemClick: (item: NavItem) => void
  onSignIn?: () => void
}

const NAV_ITEMS: { id: NavItem; label: string; subtitle: string; icon: typeof Activity }[] = [
  { id: 'sessions', label: 'Sessions', subtitle: 'Past recordings', icon: FileText },
  { id: 'live', label: 'Live Session', subtitle: 'Active session', icon: Activity },
  { id: 'modes', label: 'Modes', subtitle: 'AI personalities', icon: Users },
  { id: 'settings', label: 'Settings', subtitle: 'Configuration', icon: Settings },
]

export function Sidebar({ activeItem, onItemClick, onSignIn }: SidebarProps) {
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentUser = useAuthStore((s) => s.currentUser)
  const authState = useAuthStore((s) => s.authState)
  const isPro = useLicenseStore((s) => s.isPro())
  const isEnterprise = useLicenseStore((s) => s.isEnterprise())
  const currentLicense = useLicenseStore((s) => s.currentLicense)

  const sessionStatus: StatusType = isSessionActive ? 'active' : 'idle'
  const isConnected = authState === 'authenticated' && currentUser

  const handleSignIn = () => {
    // Use callback if provided, otherwise fall back to opening browser
    if (onSignIn) {
      onSignIn()
    } else {
      window.electronAPI?.openExternal(`${getWebBaseUrl()}/signin`)
    }
  }

  const handleOpenWebDashboard = () => {
    window.electronAPI?.openExternal(`${getWebBaseUrl()}/dashboard`)
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
        {NAV_ITEMS.map(({ id, label, subtitle, icon: Icon }) => {
          const isLive = id === 'live' && isSessionActive

          return (
            <button
              key={id}
              onClick={() => onItemClick(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-qm-md transition-colors group',
                activeItem === id
                  ? 'bg-qm-accent/10 border border-qm-accent/20'
                  : 'hover:bg-qm-surface-light',
              )}
            >
              {/* Icon with gradient background when selected */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center',
                activeItem === id
                  ? 'bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end'
                  : ''
              )}>
                <Icon size={activeItem === id ? 14 : 18} className={activeItem === id ? 'text-white' : 'text-qm-text-secondary'} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'text-body-sm',
                    activeItem === id ? 'text-qm-text-primary font-medium' : 'text-qm-text-secondary',
                  )}>
                    {label}
                  </span>
                  {/* Live indicator red dot */}
                  {isLive && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-qm-error animate-ping opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-qm-error" />
                    </span>
                  )}
                </div>
                <span className="text-caption text-qm-text-disabled">{subtitle}</span>
              </div>
              {activeItem === id && (
                <ChevronRight size={14} className="text-qm-accent" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Status section */}
      <div className="px-4 py-3 border-t border-qm-border-subtle space-y-3">
        <span className="text-[10px] uppercase tracking-wider text-qm-text-disabled font-semibold">Status</span>

        {/* Session status with recording indicator */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-qm-md',
          isSessionActive ? 'bg-qm-success/10' : 'bg-qm-surface-light'
        )}>
          {isSessionActive ? (
            <>
              {/* Pulsing red dot for recording */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-qm-error animate-ping opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-qm-error" />
              </span>
              <div className="flex-1">
                <span className="text-body-sm text-qm-text-primary font-medium block">Recording</span>
              </div>
              <AudioLevelIndicator />
            </>
          ) : (
            <>
              <StatusIndicator status={sessionStatus} size={8} />
              <span className="text-body-sm text-qm-text-secondary">Idle</span>
            </>
          )}
        </div>

        {/* Audio level bar (only when recording) */}
        {isSessionActive && (
          <div className="px-3 py-2 rounded-qm-md bg-qm-surface-light">
            <div className="flex items-center gap-2 mb-1.5">
              <Mic size={11} className="text-qm-accent" />
              <span className="text-caption text-qm-text-tertiary">Audio Level</span>
            </div>
            <AudioLevelBar />
          </div>
        )}
      </div>

      {/* License Status Badge */}
      <div className="px-4 py-3 border-t border-qm-border-subtle">
        <button
          onClick={() => onItemClick('settings')}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-qm-md transition-colors group',
            isPro || isEnterprise
              ? 'bg-qm-warning/10 border border-qm-warning/20 hover:bg-qm-warning/15'
              : 'bg-qm-surface-light hover:bg-qm-surface-hover'
          )}
        >
          {/* Icon */}
          {isPro || isEnterprise ? (
            <Crown size={16} className="text-qm-warning" />
          ) : isConnected ? (
            <Cloud size={16} className="text-qm-success" />
          ) : (
            <CloudOff size={16} className="text-qm-text-disabled" />
          )}

          {/* Text */}
          <div className="flex-1 text-left">
            <span className={cn(
              'text-caption-sm font-semibold block',
              isPro || isEnterprise ? 'text-qm-text-primary' : 'text-qm-text-secondary'
            )}>
              {isEnterprise ? 'Enterprise' : isPro ? 'Pro' : isConnected ? 'Free' : 'Not Connected'}
            </span>
            <span className="text-[9px] text-qm-text-disabled block">
              {isPro || isEnterprise
                ? 'All features unlocked'
                : isConnected
                ? 'Upgrade for more'
                : 'Tap to sign in'}
            </span>
          </div>

          <ChevronRight size={14} className="text-qm-text-disabled group-hover:text-qm-text-tertiary" />
        </button>
      </div>

      {/* Connection status and Web Dashboard */}
      <div className="px-4 py-3 border-t border-qm-border-subtle space-y-3">
        {/* Connection status */}
        {isConnected && (
          <div className="flex items-center gap-2 text-caption text-qm-text-disabled">
            <Cloud size={12} className="text-qm-success" />
            <span className="truncate">{currentUser?.email}</span>
          </div>
        )}

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
          <button
            onClick={() => useTourStore.getState().openTour()}
            className="flex items-center gap-1 hover:text-qm-text-secondary transition-colors"
          >
            <HelpCircle size={12} />
            Tour
          </button>
          <button
            onClick={() => useShortcutsStore.getState().openShortcutsModal()}
            className="flex items-center gap-1 hover:text-qm-text-secondary transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard size={12} />
          </button>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">Ctrl</kbd>
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">⇧</kbd>
          <kbd className="px-1 py-0.5 rounded bg-qm-surface-light">S</kbd>
        </div>
      </div>
    </div>
  )
}
