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
      className="absolute right-0 top-full mt-2 w-64 z-50 glass rounded-qm-lg border border-qm-border-subtle shadow-qm-lg overflow-hidden"
    >
      {/* Mode Selector */}
      <div className="p-3 border-b border-qm-border-subtle">
        <label className="text-[10px] uppercase tracking-wider text-qm-text-tertiary mb-2 block">
          Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={clsx(
                'px-2 py-1.5 rounded-qm-sm text-[11px] font-medium transition-all',
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
        />

        {/* Smart Mode Toggle */}
        <ToggleRow
          label="Smart Mode"
          shortcut="⇧⌘S"
          enabled={smartModeEnabled}
          onToggle={() => setSmartModeEnabled(!smartModeEnabled)}
          accentColor="accent"
        />

        {/* Screen Capture Toggle */}
        <ToggleRow
          label="Screen Capture"
          shortcut="⇧⌘C"
          enabled={enableScreenCapture}
          onToggle={() => setEnableScreenCapture(!enableScreenCapture)}
          accentColor="success"
        />
      </div>

      {/* Position Grid */}
      <div className="p-3 border-b border-qm-border-subtle">
        <label className="text-[10px] uppercase tracking-wider text-qm-text-tertiary mb-2 block">
          Position
        </label>
        <div className="grid grid-cols-3 gap-1">
          {POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setOverlayPosition(pos.id)}
              className={clsx(
                'aspect-square flex items-center justify-center rounded-qm-xs text-sm transition-all',
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
        />
        <MenuAction
          label="Hide Widget"
          shortcut="⌘\\"
          onClick={handleHideWidget}
          variant="muted"
        />
      </div>
    </motion.div>
  );
}

// Toggle Row Component
interface ToggleRowProps {
  label: string;
  shortcut?: string;
  enabled: boolean;
  onToggle: () => void;
  accentColor: 'accent' | 'success' | 'warning' | 'auto-answer';
}

function ToggleRow({ label, shortcut, enabled, onToggle, accentColor }: ToggleRowProps) {
  const colors = {
    accent: 'bg-qm-accent',
    success: 'bg-qm-success',
    warning: 'bg-qm-warning',
    'auto-answer': 'bg-qm-auto-answer',
  };

  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-2 py-1.5 rounded-qm-sm hover:bg-qm-surface-hover transition-colors"
    >
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            'w-7 h-4 rounded-full transition-colors relative',
            enabled ? colors[accentColor] : 'bg-qm-surface-medium'
          )}
        >
          <motion.div
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm"
            animate={{ left: enabled ? '14px' : '2px' }}
            transition={{ duration: 0.15 }}
          />
        </div>
        <span className="text-[11px] text-qm-text-primary">{label}</span>
      </div>
      {shortcut && (
        <span className="text-[9px] text-qm-text-tertiary font-mono">{shortcut}</span>
      )}
    </button>
  );
}

// Menu Action Component
interface MenuActionProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'muted' | 'danger';
}

function MenuAction({ label, shortcut, onClick, variant = 'default' }: MenuActionProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center justify-between w-full px-3 py-2 rounded-qm-sm transition-colors',
        variant === 'default' && 'text-qm-text-primary hover:bg-qm-surface-hover',
        variant === 'muted' && 'text-qm-text-secondary hover:bg-qm-surface-hover',
        variant === 'danger' && 'text-qm-error hover:bg-qm-error/10'
      )}
    >
      <span className="text-[12px]">{label}</span>
      {shortcut && (
        <span className="text-[9px] text-qm-text-tertiary font-mono">{shortcut}</span>
      )}
    </button>
  );
}

export default OverlayPopupMenu;
