// Queen Mama LITE - Audio Level Indicator Component

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface AudioLevelProps {
  level: number; // 0-1 normalized RMS level
  isActive?: boolean;
  bars?: number;
  className?: string;
}

export function AudioLevel({
  level,
  isActive = true,
  bars = 5,
  className,
}: AudioLevelProps) {
  // Calculate which bars should be active based on level
  const activeBars = useMemo(() => {
    if (!isActive) return 0;
    return Math.ceil(level * bars);
  }, [level, isActive, bars]);

  return (
    <div className={clsx('flex items-end gap-0.5 h-4', className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const isBarActive = i < activeBars;
        const height = ((i + 1) / bars) * 100;

        return (
          <motion.div
            key={i}
            className={clsx(
              'w-1 rounded-full transition-colors duration-100',
              isBarActive && isActive ? 'bg-qm-success' : 'bg-qm-surface-medium'
            )}
            initial={{ height: '20%' }}
            animate={{
              height: isActive ? `${height}%` : '20%',
              opacity: isBarActive && isActive ? 1 : 0.3,
            }}
            transition={{ duration: 0.1 }}
          />
        );
      })}
    </div>
  );
}

// Waveform visualization
export interface WaveformProps {
  levels: number[]; // Array of RMS levels for waveform
  isActive?: boolean;
  className?: string;
}

export function Waveform({ levels, isActive = true, className }: WaveformProps) {
  return (
    <div className={clsx('flex items-center gap-px h-6', className)}>
      {levels.map((level, i) => (
        <motion.div
          key={i}
          className={clsx(
            'w-0.5 rounded-full',
            isActive ? 'bg-qm-accent' : 'bg-qm-surface-medium'
          )}
          animate={{
            height: isActive ? `${Math.max(level * 100, 10)}%` : '20%',
          }}
          transition={{ duration: 0.05 }}
        />
      ))}
    </div>
  );
}

// Status Indicator with audio level
export interface AudioStatusProps {
  isRecording: boolean;
  level: number;
  className?: string;
}

export function AudioStatus({ isRecording, level, className }: AudioStatusProps) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-qm-pill',
        isRecording ? 'bg-qm-success/15' : 'bg-qm-surface-light',
        className
      )}
    >
      <div
        className={clsx(
          'w-2 h-2 rounded-full',
          isRecording ? 'bg-qm-success animate-pulse' : 'bg-qm-text-tertiary'
        )}
      />
      <span
        className={clsx(
          'text-qm-caption font-medium',
          isRecording ? 'text-qm-success' : 'text-qm-text-tertiary'
        )}
      >
        {isRecording ? 'Recording' : 'Not recording'}
      </span>
      {isRecording && <AudioLevel level={level} isActive={isRecording} bars={3} />}
    </div>
  );
}

export default AudioLevel;
