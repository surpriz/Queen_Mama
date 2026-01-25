// Queen Mama LITE - Pill Header Component
// Collapsed header with status indicators and controls

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { clsx } from 'clsx';
import { IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AudioLevel } from '../shared/AudioLevel';
import { OverlayPopupMenu } from './OverlayPopupMenu';

export interface PillHeaderProps {
  isExpanded: boolean;
  isSessionActive: boolean;
  isConnected: boolean;
  audioLevel: number;
  enableScreenCapture: boolean;
  smartModeEnabled: boolean;
  autoAnswerEnabled: boolean;
  isHidden: boolean;
  onToggleExpand: () => void;
  onToggleSession: () => void;
  onToggleAutoAnswer: () => void;
}

export function PillHeader({
  isExpanded,
  isSessionActive,
  isConnected,
  audioLevel,
  enableScreenCapture,
  smartModeEnabled,
  autoAnswerEnabled,
  isHidden,
  onToggleExpand,
  onToggleSession,
  onToggleAutoAnswer,
}: PillHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Open dashboard
  const handleOpenDashboard = async () => {
    try {
      await invoke('show_main_window');
    } catch (error) {
      console.error('[PillHeader] Failed to open dashboard:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 h-[44px] drag-region">
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

      {/* Expand/Collapse Button with chevron bounce when collapsed */}
      <IconButton
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        variant={isExpanded ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onToggleExpand}
        className="no-drag"
      >
        <motion.svg
          className={clsx('w-4 h-4', !isExpanded && 'animate-chevron-bounce')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </IconButton>

      {/* More Menu Button */}
      <div className="relative no-drag">
        <IconButton
          aria-label="More options"
          variant="ghost"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </IconButton>

        {/* Popup Menu */}
        <AnimatePresence>
          {showMenu && (
            <OverlayPopupMenu onClose={() => setShowMenu(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status Indicators */}
      <div className="flex items-center gap-1.5 no-drag">
        {/* Hidden Badge - when undetectable mode active */}
        {isHidden && (
          <Badge variant="default" size="sm" className="gap-1">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          </Badge>
        )}

        {/* Auto-Answer Toggle */}
        <button
          onClick={onToggleAutoAnswer}
          className={clsx(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all',
            autoAnswerEnabled
              ? 'bg-qm-auto-answer/20 text-qm-auto-answer'
              : 'bg-qm-surface-light text-qm-text-tertiary hover:bg-qm-surface-medium'
          )}
        >
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              autoAnswerEnabled && 'bg-qm-auto-answer animate-pulse'
            )}
          />
          Auto
        </button>

        {/* Smart Mode Badge */}
        {smartModeEnabled && (
          <Badge variant="accent" size="sm">Smart</Badge>
        )}

        {/* Screen Capture Badge */}
        {enableScreenCapture && (
          <Badge variant="success" size="sm" className="gap-1">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
            </svg>
          </Badge>
        )}

        {/* Audio Level */}
        {isSessionActive && (
          <AudioLevel level={audioLevel} isActive={isSessionActive} bars={4} />
        )}

        {/* Connection Status */}
        <div
          className={clsx(
            'w-2 h-2 rounded-full transition-all',
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
        <div className="relative no-drag">
          {/* Outer pulsing glow ring - more visible like macOS app */}
          <motion.div
            className="absolute -inset-1 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 40%, #3B82F6 100%)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          {/* Inner subtle glow */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 40%, #3B82F6 100%)',
              filter: 'blur(4px)',
            }}
            animate={{
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <IconButton
            aria-label="Start Session"
            variant="primary"
            size="sm"
            onClick={onToggleSession}
            className="relative shadow-qm-glow"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </IconButton>
        </div>
      )}
    </div>
  );
}

export default PillHeader;
