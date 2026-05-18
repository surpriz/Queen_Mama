import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  /** Use 'shimmer' for a moving gradient sweep, 'pulse' for opacity pulse (default) */
  variant?: 'pulse' | 'shimmer'
}

export function Skeleton({ className, variant = 'pulse' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-qm-sm bg-qm-surface-medium overflow-hidden relative isolate',
        variant === 'pulse' && 'animate-pulse',
        className,
      )}
    >
      {variant === 'shimmer' && (
        <div
          className="absolute inset-0 -translate-x-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 50%, transparent)',
            animation: 'qm-shimmer 1.6s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )
}

/** Pre-composed skeleton matching a session card layout */
export function SessionCardSkeleton() {
  return (
    <div className="p-4 rounded-qm-lg bg-qm-bg-tertiary/60 shadow-qm-elev-1 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="h-3.5 flex-1 max-w-[60%]" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[85%]" />
      </div>
    </div>
  )
}
