// Queen Mama LITE - Overlay Popup Menu Component
// Settings and controls popup menu matching macOS app

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAIStore } from '../../stores/aiStore';
import { invoke } from '@tauri-apps/api/core';
import type { OverlayPosition } from '../../types';

interface OverlayPopupMenuProps {
  onClose: () => void;
}

const POSITIONS: { id: OverlayPosition; label: string; icon: string }[] = [
  { id: 'topLeft', label: 'Top Left', icon: '↖' },
  { id: 'topCenter', label: 'Top Center', icon: '↑' },
  { id: 'topRight', label: 'Top Right', icon: '↗' },
  { id: 'bottomLeft', label: 'Bottom Left', icon: '↙' },
  { id: 'bottomCenter', label: 'Bottom Center', icon: '↓' },
  { id: 'bottomRight', label: 'Bottom Right', icon: '↘' },
];

export function OverlayPopupMenu({ onClose }: OverlayPopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    modes,
    selectedModeId,
    autoAnswerEnabled,
    smartModeEnabled,
    enableScreenCapture,
    overlayPosition,
    setSelectedMode,
    setAutoAnswerEnabled,
    setSmartModeEnabled,
    setEnableScreenCapture,
    setOverlayPosition,
  } = useSettingsStore();

  const { clearResponses } = useAIStore();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleHideWidget = async () => {
    try {
      await invoke('hide_overlay');
      onClose();
    } catch (error) {
      console.error('[OverlayMenu] Failed to hide widget:', error);
    }
  };

  const handleClearContext = () => {
    clearResponses();
    onClose();
  };

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-64 z-50 glass-liquid rounded-qm-xl border border-qm-border-subtle shadow-qm-depth-floating overflow-hidden"
    >
      {/* Mode Selector */}
      <div className="p-3 border-b border-qm-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-qm-accent">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <label className="text-[12px] text-qm-text-primary font-medium">
            Mode
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={clsx(
                'px-2 py-1.5 rounded-qm-md text-[11px] font-medium transition-all',
                selectedModeId === mode.id
                  ? 'bg-qm-accent/20 text-qm-accent'
                  : 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover'
              )}
            >
              {mode.name}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="p-3 space-y-2 border-b border-qm-border-subtle">
        {/* Auto-Answer Toggle */}
        <ToggleRow
          label="Auto-Answer"
          shortcut="⇧⌘A"
          enabled={autoAnswerEnabled}
          onToggle={() => setAutoAnswerEnabled(!autoAnswerEnabled)}
          accentColor="auto-answer"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        {/* Smart Mode Toggle */}
        <ToggleRow
          label="Smart Mode"
          shortcut="⇧⌘S"
          enabled={smartModeEnabled}
          onToggle={() => setSmartModeEnabled(!smartModeEnabled)}
          accentColor="accent"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        />

        {/* Screen Capture Toggle */}
        <ToggleRow
          label="Screen Capture"
          shortcut="⇧⌘C"
          enabled={enableScreenCapture}
          onToggle={() => setEnableScreenCapture(!enableScreenCapture)}
          accentColor="success"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Position Grid */}
      <div className="p-3 border-b border-qm-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-qm-text-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </span>
          <label className="text-[12px] text-qm-text-primary font-medium">
            Position
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setOverlayPosition(pos.id)}
              className={clsx(
                'aspect-square flex items-center justify-center rounded-qm-sm text-sm transition-all',
                overlayPosition === pos.id
                  ? 'bg-qm-accent/20 text-qm-accent'
                  : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-hover hover:text-qm-text-secondary'
              )}
              title={pos.label}
            >
              {pos.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 space-y-1">
        <MenuAction
          label="Clear Context"
          shortcut="⌘R"
          onClick={handleClearContext}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MenuAction
          label="Hide Widget"
          shortcut="⌘\\"
          onClick={handleHideWidget}
          variant="muted"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          }
        />
      </div>
    </motion.div>
  );
}

// Toggle Row Component with icon support
interface ToggleRowProps {
  label: string;
  shortcut?: string;
  enabled: boolean;
  onToggle: () => void;
  accentColor: 'accent' | 'success' | 'warning' | 'auto-answer';
  icon?: React.ReactNode;
}

function ToggleRow({ label, shortcut, enabled, onToggle, accentColor, icon }: ToggleRowProps) {
  const colors = {
    accent: 'bg-qm-accent',
    success: 'bg-qm-success',
    warning: 'bg-qm-warning',
    'auto-answer': 'bg-qm-auto-answer',
  };

  const iconColors = {
    accent: 'text-qm-accent',
    success: 'text-qm-success',
    warning: 'text-qm-warning',
    'auto-answer': 'text-qm-auto-answer',
  };

  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-2 py-2 rounded-qm-md hover:bg-qm-surface-hover transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        {icon && (
          <span className={clsx(
            'flex-shrink-0 transition-colors',
            enabled ? iconColors[accentColor] : 'text-qm-text-tertiary'
          )}>
            {icon}
          </span>
        )}
        <span className="text-[12px] text-qm-text-primary">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {shortcut && (
          <span className="text-[9px] text-qm-text-tertiary font-mono">{shortcut}</span>
        )}
        {/* Toggle switch */}
        <div
          className={clsx(
            'w-8 h-[18px] rounded-full transition-colors relative flex-shrink-0',
            enabled ? colors[accentColor] : 'bg-qm-surface-medium'
          )}
        >
          <motion.div
            className="absolute top-[3px] w-3 h-3 rounded-full bg-white shadow-sm"
            animate={{ left: enabled ? '16px' : '3px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </div>
      </div>
    </button>
  );
}

// Menu Action Component with icon support
interface MenuActionProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'muted' | 'danger';
  icon?: React.ReactNode;
}

function MenuAction({ label, shortcut, onClick, variant = 'default', icon }: MenuActionProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-between w-full px-3 py-2 rounded-qm-md transition-colors',
        variant === 'default' && 'text-qm-text-primary hover:bg-qm-surface-hover',
        variant === 'muted' && 'text-qm-text-secondary hover:bg-qm-surface-hover',
        variant === 'danger' && 'text-qm-error hover:bg-qm-error/10'
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className={clsx(
            'flex-shrink-0',
            variant === 'muted' ? 'text-qm-text-tertiary' : 'text-qm-text-secondary'
          )}>
            {icon}
          </span>
        )}
        <span className="text-[12px]">{label}</span>
      </div>
      {shortcut && (
        <span className="text-[9px] text-qm-text-tertiary font-mono">{shortcut}</span>
      )}
    </button>
  );
}

export default OverlayPopupMenu;
