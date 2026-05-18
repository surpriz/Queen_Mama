import { cn } from '@/lib/utils'

export type StatusType = 'idle' | 'active' | 'processing' | 'error'

const STATUS_COLORS: Record<StatusType, string> = {
  idle: 'bg-qm-text-tertiary',
  active: 'bg-qm-success',
  processing: 'bg-qm-accent',
  error: 'bg-qm-error',
}

const STATUS_GLOWS: Record<StatusType, string> = {
  idle: '',
  active: 'shadow-[0_0_8px_rgba(16,185,129,0.7)]',
  processing: 'shadow-[0_0_8px_rgba(139,92,246,0.7)]',
  error: 'shadow-[0_0_6px_rgba(239,68,68,0.6)]',
}

const PULSE_COLORS: Record<StatusType, string> = {
  idle: '',
  active: 'bg-qm-success',
  processing: 'bg-qm-accent',
  error: '',
}

interface StatusIndicatorProps {
  status: StatusType
  size?: number
  showPulse?: boolean
  className?: string
}

export function StatusIndicator({
  status,
  size = 8,
  showPulse = true,
  className,
}: StatusIndicatorProps) {
  const shouldPulse = showPulse && (status === 'active' || status === 'processing')

  return (
    <span
      className={cn('relative inline-flex', className)}
      style={{ width: size * 2, height: size * 2 }}
    >
      {shouldPulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full opacity-30 animate-qm-pulse',
            PULSE_COLORS[status],
          )}
        />
      )}
      <span
        className={cn('absolute rounded-full', STATUS_COLORS[status], STATUS_GLOWS[status])}
        style={{
          width: size,
          height: size,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </span>
  )
}
