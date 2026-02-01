import { useEffect, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { GradientText } from '@/components/common/GradientText'
import { cn } from '@/lib/utils'

interface ReadyStepProps {
  onComplete: () => void
}

export function ReadyStep({ onComplete }: ReadyStepProps) {
  const [showAnimation, setShowAnimation] = useState(false)

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setShowAnimation(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      {/* Celebration Animation */}
      <div className="relative mb-8">
        {/* Expanding circles */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-1000',
            showAnimation ? 'scale-150 opacity-0' : 'scale-100 opacity-30'
          )}
        >
          <div className="w-40 h-40 rounded-full bg-gradient-to-r from-qm-primary/30 to-qm-secondary/30" />
        </div>
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-700 delay-200',
            showAnimation ? 'scale-125 opacity-0' : 'scale-100 opacity-40'
          )}
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-r from-qm-primary/40 to-qm-secondary/40" />
        </div>

        {/* Particle effects */}
        {showAnimation && (
          <>
            {[...Array(8)].map((_, i) => (
              <Particle key={i} index={i} />
            ))}
          </>
        )}

        {/* Success checkmark */}
        <div
          className={cn(
            'relative z-10 w-24 h-24 rounded-full bg-gradient-to-r from-qm-primary to-qm-secondary flex items-center justify-center transition-all duration-500',
            showAnimation ? 'scale-100' : 'scale-75 opacity-0'
          )}
        >
          <div
            className={cn(
              'w-20 h-20 rounded-full bg-qm-success flex items-center justify-center transition-all duration-300 delay-300',
              showAnimation ? 'scale-100' : 'scale-0'
            )}
          >
            <Check
              className={cn(
                'w-10 h-10 text-white transition-all duration-300 delay-500',
                showAnimation ? 'scale-100' : 'scale-0'
              )}
            />
          </div>
        </div>
      </div>

      {/* Title */}
      <GradientText
        as="h1"
        className={cn(
          'text-title-lg font-bold mb-3 transition-all duration-500 delay-300',
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        You're All Set!
      </GradientText>

      {/* Message */}
      <p
        className={cn(
          'text-body-md text-qm-text-secondary text-center mb-10 max-w-md transition-all duration-500 delay-500',
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        Queen Mama is ready to assist you. Start your first session and experience AI-powered
        conversation coaching!
      </p>

      {/* Tips */}
      <div
        className={cn(
          'w-full max-w-md mb-10 transition-all duration-500 delay-700',
          showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        <div className="flex items-start gap-3 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
          <Sparkles className="w-5 h-5 text-qm-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-body-sm text-qm-text-primary mb-1">Quick tip</p>
            <p className="text-body-sm text-qm-text-secondary">
              Press <kbd className="px-1.5 py-0.5 mx-1 text-caption font-mono bg-qm-surface-medium rounded">Ctrl+Shift+S</kbd> anytime to start a new session
            </p>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={onComplete}
        className={cn(
          'px-8 py-3 rounded-qm-lg bg-gradient-to-r from-qm-primary to-qm-secondary text-white font-medium text-body-md hover:scale-105 transition-all duration-200 shadow-lg',
          showAnimation ? 'opacity-100 translate-y-0 delay-1000' : 'opacity-0 translate-y-4'
        )}
      >
        Start First Session
      </button>
    </div>
  )
}

// Particle animation component
function Particle({ index }: { index: number }) {
  const angle = (index * 45) * (Math.PI / 180)
  const distance = 80

  return (
    <div
      className="absolute w-3 h-3 rounded-full bg-qm-accent animate-ping"
      style={{
        left: `calc(50% + ${Math.cos(angle) * distance}px - 6px)`,
        top: `calc(50% + ${Math.sin(angle) * distance}px - 6px)`,
        animationDelay: `${index * 0.1}s`,
        animationDuration: '1s',
      }}
    />
  )
}
