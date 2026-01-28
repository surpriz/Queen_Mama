import { cn } from '@/lib/utils'

const KEY_MAP: Record<string, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Esc',
  escape: 'Esc',
  tab: 'Tab',
  space: 'Space',
  delete: 'Del',
  backspace: 'Bksp',
  up: '\u2191',
  down: '\u2193',
  left: '\u2190',
  right: '\u2192',
}

function parseShortcut(shortcut: string): string[] {
  return shortcut.split('+').map((key) => {
    const trimmed = key.trim().toLowerCase()
    return KEY_MAP[trimmed] ?? key.trim().toUpperCase()
  })
}

interface KeyboardShortcutBadgeProps {
  shortcut: string
  size?: 'small' | 'medium'
  className?: string
}

export function KeyboardShortcutBadge({
  shortcut,
  size = 'medium',
  className,
}: KeyboardShortcutBadgeProps) {
  const keys = parseShortcut(shortcut)
  const isSmall = size === 'small'

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center rounded-qm-xs',
            'bg-qm-surface-medium border border-qm-border-subtle',
            'text-qm-text-tertiary font-mono',
            isSmall ? 'px-1 py-0.5 text-caption-sm' : 'px-1.5 py-0.5 text-caption',
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
