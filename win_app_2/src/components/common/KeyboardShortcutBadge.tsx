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
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center rounded-qm-xs',
            'bg-qm-surface-medium text-qm-text-secondary font-mono font-medium',
            'shadow-[inset_0_-1px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.06)]',
            isSmall
              ? 'min-w-[18px] h-[18px] px-1 text-[10px] leading-none'
              : 'min-w-[22px] h-[22px] px-1.5 text-caption leading-none',
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}
