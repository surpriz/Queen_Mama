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
  const stroke = Math.max(2, Math.round(pixelSize / 10))

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className="relative"
        style={{ width: pixelSize, height: pixelSize }}
        role="status"
        aria-label={label || 'Loading'}
      >
        {/* Track ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `inset 0 0 0 ${stroke}px rgba(255,255,255,0.06)` }}
        />
        {/* Spinning violet→cyan gradient arc with drop-shadow glow */}
        <svg
          className="animate-spin absolute inset-0"
          width={pixelSize}
          height={pixelSize}
          viewBox="0 0 24 24"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 4px rgba(139,92,246,0.5))' }}
        >
          <defs>
            <linearGradient id="qm-spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="url(#qm-spinner-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray="40 80"
          />
        </svg>
      </div>
      {label && <span className="text-body-sm text-qm-text-secondary">{label}</span>}
    </div>
  )
}
