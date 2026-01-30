import { cn } from '@/lib/utils'

export type StatusType = 'idle' | 'active' | 'processing' | 'error'

const STATUS_COLORS: Record<StatusType, string> = {
  idle: 'bg-qm-text-tertiary',
  active: 'bg-qm-success',
  processing: 'bg-qm-accent',
  error: 'bg-qm-error',
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
        className={cn('absolute rounded-full', STATUS_COLORS[status])}
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
