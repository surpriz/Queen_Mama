// Queen Mama LITE - Keyboard Shortcut Badge Component

import { useMemo } from 'react';
import { clsx } from 'clsx';

export interface KeyboardShortcutProps {
  shortcut: string; // e.g., "Cmd+Enter", "Ctrl+Shift+S"
  size?: 'sm' | 'md';
  className?: string;
}

export function KeyboardShortcut({
  shortcut,
  size = 'md',
  className,
}: KeyboardShortcutProps) {
  const keys = useMemo(() => {
    return parseShortcut(shortcut);
  }, [shortcut]);

  const sizes = {
    sm: 'px-1 py-0.5 text-[9px] gap-0.5',
    md: 'px-1.5 py-0.5 text-[10px] gap-1',
  };

  return (
    <span className={clsx('inline-flex items-center', sizes[size], className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className={clsx(
            'inline-flex items-center justify-center rounded',
            'bg-qm-surface-medium border border-qm-border-subtle',
            'font-mono text-qm-text-tertiary',
            size === 'sm' ? 'min-w-4 h-4 px-1' : 'min-w-5 h-5 px-1.5'
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

// Parse shortcut string into individual key symbols
function parseShortcut(shortcut: string): string[] {
  const isMac = typeof window !== 'undefined' && navigator.platform.includes('Mac');

  const keyMap: Record<string, string> = {
    cmd: isMac ? '⌘' : 'Ctrl',
    command: isMac ? '⌘' : 'Ctrl',
    ctrl: isMac ? '⌃' : 'Ctrl',
    control: isMac ? '⌃' : 'Ctrl',
    shift: isMac ? '⇧' : 'Shift',
    alt: isMac ? '⌥' : 'Alt',
    option: isMac ? '⌥' : 'Alt',
    opt: isMac ? '⌥' : 'Alt',
    enter: isMac ? '↩' : 'Enter',
    return: isMac ? '↩' : 'Enter',
    esc: isMac ? '⎋' : 'Esc',
    escape: isMac ? '⎋' : 'Esc',
    tab: isMac ? '⇥' : 'Tab',
    space: isMac ? '␣' : 'Space',
    delete: isMac ? '⌫' : 'Del',
    backspace: isMac ? '⌫' : 'Bksp',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    '\\': '\\',
  };

  return shortcut.split('+').map((key) => {
    const normalized = key.trim().toLowerCase();
    return keyMap[normalized] || key.trim().toUpperCase();
  });
}

// Shortcut hint component for input fields
export interface ShortcutHintProps {
  shortcut: string;
  label?: string;
  className?: string;
}

export function ShortcutHint({ shortcut, label, className }: ShortcutHintProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-qm-text-tertiary',
        className
      )}
    >
      {label && <span className="text-[10px]">{label}</span>}
      <KeyboardShortcut shortcut={shortcut} size="sm" />
    </span>
  );
}

export default KeyboardShortcut;
