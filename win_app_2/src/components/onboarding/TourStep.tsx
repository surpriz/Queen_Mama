import { useState } from 'react'
import {
  MessageSquare,
  Sparkles,
  MessageCircle,
  RotateCcw,
  Layout,
  Settings,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Monitor,
  Mic,
  User,
  Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GradientText } from '@/components/common/GradientText'

interface TourStepProps {
  onContinue: () => void
  onBack: () => void
}

interface TourScreen {
  id: string
  title: string
  subtitle: string
  content: React.ReactNode
}

export function TourStep({ onContinue, onBack }: TourStepProps) {
  const [currentScreen, setCurrentScreen] = useState(0)

  const screens: TourScreen[] = [
    {
      id: 'widget',
      title: 'The Floating Widget',
      subtitle: 'Your AI assistant, always within reach',
      content: <WidgetTourContent />,
    },
    {
      id: 'ai-help',
      title: '4 Types of AI Help',
      subtitle: 'Different ways Queen Mama can assist you',
      content: <AIHelpTourContent />,
    },
    {
      id: 'dashboard',
      title: 'The Dashboard',
      subtitle: 'Your command center for everything',
      content: <DashboardTourContent />,
    },
    {
      id: 'modes',
      title: 'AI Modes',
      subtitle: 'Customize AI behavior for different situations',
      content: <ModesTourContent />,
    },
    {
      id: 'shortcuts',
      title: 'Keyboard Shortcuts',
      subtitle: 'Quick access to all features',
      content: <ShortcutsTourContent />,
    },
  ]

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1)
    }
  }

  const handlePrev = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1)
    }
  }

  const isLastScreen = currentScreen === screens.length - 1

  return (
    <div className="flex flex-col h-full px-8 py-8">
      {/* Screen Content */}
      <div className="flex-1 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-6">
          <GradientText as="h2" className="text-title-md font-semibold mb-2">
            {screens[currentScreen].title}
          </GradientText>
          <p className="text-body-md text-qm-text-secondary">{screens[currentScreen].subtitle}</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full max-w-2xl overflow-y-auto">
          {screens[currentScreen].content}
        </div>
      </div>

      {/* Page Indicator */}
      <div className="flex justify-center gap-2 my-4">
        {screens.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentScreen(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentScreen
                ? 'w-6 bg-gradient-to-r from-qm-primary to-qm-secondary'
                : 'bg-qm-surface-medium hover:bg-qm-surface-hover'
            )}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center max-w-2xl mx-auto w-full">
        <button
          onClick={currentScreen === 0 ? onBack : handlePrev}
          className="flex items-center gap-2 px-4 py-2.5 rounded-qm-lg text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {currentScreen === 0 ? 'Back' : 'Previous'}
        </button>

        {isLastScreen ? (
          <button
            onClick={onContinue}
            className="px-6 py-2.5 rounded-qm-lg bg-gradient-to-r from-qm-primary to-qm-secondary text-white font-medium hover:scale-105 transition-transform duration-200"
          >
            Got it!
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2.5 rounded-qm-lg bg-qm-surface-medium text-qm-text-primary hover:bg-qm-surface-hover transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Tour Content Components

function WidgetTourContent() {
  return (
    <div className="space-y-6">
      {/* Widget Mockups */}
      <div className="flex justify-center gap-8 mb-6">
        {/* Collapsed Widget */}
        <div className="text-center">
          <div className="mb-2 text-caption text-qm-text-tertiary">Collapsed</div>
          <div className="w-48 h-12 rounded-full bg-qm-surface-medium border border-qm-border-subtle flex items-center px-4 gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qm-primary to-qm-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-body-sm text-qm-text-secondary">Ready to assist</span>
          </div>
        </div>

        {/* Expanded Widget */}
        <div className="text-center">
          <div className="mb-2 text-caption text-qm-text-tertiary">Expanded</div>
          <div className="w-56 rounded-qm-lg bg-qm-surface-medium border border-qm-border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qm-primary to-qm-secondary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-body-sm text-qm-text-primary">Queen Mama</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-qm-surface-hover rounded w-full" />
              <div className="h-3 bg-qm-surface-hover rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Points */}
      <div className="space-y-3">
        <TourBullet
          icon={<Monitor className="w-4 h-4" />}
          text="Floats on top of all windows for quick access"
        />
        <TourBullet
          icon={<Mic className="w-4 h-4" />}
          text="Shows real-time transcription of your conversation"
        />
        <TourBullet
          icon={<Sparkles className="w-4 h-4" />}
          text="Displays AI suggestions and responses instantly"
        />
      </div>
    </div>
  )
}

function AIHelpTourContent() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <AIFeatureCard
        icon={<Sparkles className="w-5 h-5" />}
        title="Assist"
        description="Get intelligent suggestions based on conversation context"
        example="Try saying: 'What should I mention about pricing?'"
        color="from-purple-500 to-blue-500"
      />
      <AIFeatureCard
        icon={<MessageSquare className="w-5 h-5" />}
        title="Say"
        description="Generate exact phrases to use in your conversation"
        example="Creates polished responses you can use directly"
        color="from-green-500 to-teal-500"
      />
      <AIFeatureCard
        icon={<MessageCircle className="w-5 h-5" />}
        title="Follow-up"
        description="Smart follow-up questions to keep the conversation going"
        example="Suggests relevant questions based on context"
        color="from-orange-500 to-yellow-500"
      />
      <AIFeatureCard
        icon={<RotateCcw className="w-5 h-5" />}
        title="Recap"
        description="Quick summary of key points from the conversation"
        example="Get a condensed overview anytime"
        color="from-pink-500 to-rose-500"
      />
    </div>
  )
}

function DashboardTourContent() {
  return (
    <div className="space-y-6">
      {/* Dashboard Mockup */}
      <div className="rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-48 bg-qm-surface-medium p-4 border-r border-qm-border-subtle">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded bg-qm-surface-hover">
                <Layout className="w-4 h-4 text-qm-accent" />
                <span className="text-body-sm">Sessions</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded">
                <Sliders className="w-4 h-4 text-qm-text-tertiary" />
                <span className="text-body-sm text-qm-text-tertiary">Modes</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded">
                <Settings className="w-4 h-4 text-qm-text-tertiary" />
                <span className="text-body-sm text-qm-text-tertiary">Settings</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-4">
            <div className="text-body-md font-medium mb-3">Recent Sessions</div>
            <div className="space-y-2">
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4">
        <DashboardFeature icon={<Layout />} title="Sessions" description="Review past conversations" />
        <DashboardFeature icon={<Sliders />} title="Modes" description="Customize AI behavior" />
        <DashboardFeature icon={<Settings />} title="Settings" description="Configure preferences" />
      </div>
    </div>
  )
}

function ModesTourContent() {
  return (
    <div className="space-y-6">
      <p className="text-body-sm text-qm-text-secondary text-center">
        Different modes customize how AI responds to your needs
      </p>

      <div className="grid grid-cols-2 gap-4">
        <ModeCard
          icon={<Sparkles />}
          name="Default"
          description="Balanced assistance for general use"
        />
        <ModeCard
          icon={<Briefcase />}
          name="Professional"
          description="Formal tone for business meetings"
        />
        <ModeCard
          icon={<User />}
          name="Interview"
          description="Optimized for job interviews"
        />
        <ModeCard
          icon={<MessageSquare />}
          name="Sales"
          description="Persuasive assistance for sales calls"
        />
      </div>

      <p className="text-caption text-qm-text-tertiary text-center">
        Create custom modes to match your specific needs
      </p>
    </div>
  )
}

function ShortcutsTourContent() {
  return (
    <div className="space-y-4">
      <ShortcutRow
        keys={['Ctrl', 'Shift', 'S']}
        title="Toggle Session"
        description="Start or stop recording"
      />
      <ShortcutRow
        keys={['Ctrl', '\\']}
        title="Toggle Widget"
        description="Show or hide the overlay"
      />
      <ShortcutRow
        keys={['Ctrl', 'Enter']}
        title="Trigger Assist"
        description="Get AI assistance on demand"
      />
      <ShortcutRow
        keys={['Ctrl', 'R']}
        title="Quick Recap"
        description="Summarize the conversation"
      />
      <ShortcutRow
        keys={['Ctrl', 'Arrows']}
        title="Move Widget"
        description="Reposition the overlay"
      />
    </div>
  )
}

// Helper Components

function TourBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-qm-md bg-qm-surface-light">
      <div className="text-qm-accent">{icon}</div>
      <span className="text-body-sm text-qm-text-primary">{text}</span>
    </div>
  )
}

function AIFeatureCard({
  icon,
  title,
  description,
  example,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  example: string
  color: string
}) {
  return (
    <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div
        className={cn(
          'w-10 h-10 rounded-qm-md flex items-center justify-center text-white mb-3 bg-gradient-to-r',
          color
        )}
      >
        {icon}
      </div>
      <h4 className="text-body-md font-medium text-qm-text-primary mb-1">{title}</h4>
      <p className="text-body-sm text-qm-text-secondary mb-2">{description}</p>
      <p className="text-caption italic text-qm-text-tertiary">{example}</p>
    </div>
  )
}

function DashboardFeature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center p-3">
      <div className="w-10 h-10 mx-auto rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent mb-2">
        {icon}
      </div>
      <div className="text-body-sm font-medium text-qm-text-primary">{title}</div>
      <div className="text-caption text-qm-text-tertiary">{description}</div>
    </div>
  )
}

function ModeCard({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode
  name: string
  description: string
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div className="w-10 h-10 rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent">
        {icon}
      </div>
      <div>
        <div className="text-body-sm font-medium text-qm-text-primary">{name}</div>
        <div className="text-caption text-qm-text-secondary">{description}</div>
      </div>
    </div>
  )
}

function ShortcutRow({
  keys,
  title,
  description,
}: {
  keys: string[]
  title: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div>
        <div className="text-body-md font-medium text-qm-text-primary">{title}</div>
        <div className="text-body-sm text-qm-text-secondary">{description}</div>
      </div>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index}>
            <kbd className="px-2 py-1 text-caption font-mono bg-qm-surface-medium rounded border border-qm-border-subtle">
              {key}
            </kbd>
            {index < keys.length - 1 && <span className="text-qm-text-tertiary mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
