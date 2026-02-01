import { cn } from '@/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg' | number

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: string
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 20,
  lg: 32,
}

export function LoadingSpinner({ size = 20, className, label }: LoadingSpinnerProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size]

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        className="animate-spin text-qm-accent"
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="text-body-sm text-qm-text-secondary">{label}</span>}
    </div>
  )
}
