// Queen Mama LITE - Pill Header Component
// Collapsed header with status indicators and controls

import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { clsx } from 'clsx';
import { IconButton } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { AudioLevel } from '../shared/AudioLevel';

export interface PillHeaderProps {
  isExpanded: boolean;
  isSessionActive: boolean;
  isConnected: boolean;
  audioLevel: number;
  enableScreenCapture: boolean;
  smartModeEnabled: boolean;
  onToggleExpand: () => void;
  onToggleSession: () => void;
  onClearContext: () => void;
}

export function PillHeader({
  isExpanded,
  isSessionActive,
  isConnected,
  audioLevel,
  enableScreenCapture,
  smartModeEnabled,
  onToggleExpand,
  onToggleSession,
  onClearContext,
}: PillHeaderProps) {
  // Open dashboard
  const handleOpenDashboard = async () => {
    try {
      await invoke('show_main_window');
    } catch (error) {
      console.error('[PillHeader] Failed to open dashboard:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 h-[44px] drag-region">
      {/* Logo */}
      <div className="w-7 h-7 rounded-full bg-qm-gradient flex items-center justify-center flex-shrink-0 no-drag">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      </div>

      {/* Dashboard Button */}
      <IconButton
        aria-label="Open Dashboard"
        variant="ghost"
        size="sm"
        onClick={handleOpenDashboard}
        className="no-drag"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </IconButton>

      {/* Expand/Collapse Button */}
      <IconButton
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        variant={isExpanded ? 'secondary' : 'primary'}
        size="sm"
        onClick={onToggleExpand}
        className="no-drag"
      >
        <motion.svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </IconButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status Indicators */}
      <div className="flex items-center gap-2 no-drag">
        {/* Smart Mode Badge */}
        {smartModeEnabled && (
          <StatusBadge status="active" label="Smart" />
        )}

        {/* Screen Capture Badge */}
        {enableScreenCapture && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-qm-success/15">
            <svg
              className="w-3 h-3 text-qm-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
            </svg>
          </div>
        )}

        {/* Audio Level */}
        {isSessionActive && (
          <AudioLevel level={audioLevel} isActive={isSessionActive} bars={4} />
        )}

        {/* Connection Status */}
        <div
          className={clsx(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-qm-success animate-pulse' : 'bg-qm-text-tertiary'
          )}
        />
      </div>

      {/* Session Button */}
      {isSessionActive ? (
        <IconButton
          aria-label="Stop Session"
          variant="danger"
          size="sm"
          onClick={onToggleSession}
          className="no-drag"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </IconButton>
      ) : (
        <motion.div
          className="no-drag"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <IconButton
            aria-label="Start Session"
            variant="primary"
            size="sm"
            onClick={onToggleSession}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </IconButton>
        </motion.div>
      )}
    </div>
  );
}

export default PillHeader;
