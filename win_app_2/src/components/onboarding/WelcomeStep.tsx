import { Sparkles, Mic, EyeOff, ArrowRight } from 'lucide-react'
import { GradientText } from '@/components/common/GradientText'

interface WelcomeStepProps {
  onContinue: () => void
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-8">
      {/* Animated Logo Section */}
      <div className="relative mb-6">
        {/* Pulsing background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-r from-qm-gradient-start/20 to-qm-gradient-end/20 animate-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-24 h-24 rounded-full bg-gradient-to-r from-qm-gradient-start/30 to-qm-gradient-end/30 animate-pulse"
            style={{ animationDelay: '0.5s' }}
          />
        </div>

        {/* Logo Icon */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* Title */}
      <GradientText as="h1" className="text-title-lg font-bold mb-3">
        Welcome to Queen Mama
      </GradientText>

      <p className="text-qm-text-secondary text-body-md text-center mb-6 max-w-md">
        Your AI-powered assistant for real-time coaching during important conversations
      </p>

      {/* Feature Highlights */}
      <div className="w-full max-w-md space-y-3 mb-8">
        <FeatureCard
          icon={<Mic className="w-5 h-5" />}
          title="Real-time Transcription"
          description="Automatically captures and transcribes your conversations"
        />
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          title="AI Assistance"
          description="Get intelligent suggestions and answers in real-time"
        />
        <FeatureCard
          icon={<EyeOff className="w-5 h-5" />}
          title="Undetectable"
          description="Works invisibly during screen sharing and recordings"
        />
      </div>

      {/* Get Started Button */}
      <button
        onClick={onContinue}
        className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-semibold text-body-lg hover:scale-105 transition-transform duration-200 shadow-lg shadow-qm-gradient-start/30"
      >
        Get Started
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle hover:border-qm-border-medium transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent">
        {icon}
      </div>
      <div>
        <h3 className="text-body-md font-medium text-qm-text-primary mb-1">{title}</h3>
        <p className="text-body-sm text-qm-text-secondary">{description}</p>
      </div>
    </div>
  )
}
