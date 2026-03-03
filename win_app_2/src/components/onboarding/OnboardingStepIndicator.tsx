import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface OnboardingStepIndicatorProps {
  steps: { key: string; label: string }[]
  currentStep: string
}

export function OnboardingStepIndicator({ steps, currentStep }: OnboardingStepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.key} className="flex items-center">
            {/* Step Circle */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                isCompleted && 'bg-qm-accent text-white',
                isCurrent && 'bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white',
                !isCompleted && !isCurrent && 'bg-qm-surface-medium text-qm-text-tertiary'
              )}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1 transition-colors duration-300',
                  index < currentIndex ? 'bg-qm-accent' : 'bg-qm-surface-medium'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
