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
  Monitor,
  Mic,
  User,
  Briefcase,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GradientText } from '@/components/common/GradientText'

interface TourStepProps {
  onContinue: () => void
  onBack: () => void
  /** Last-screen button label override (the in-app tour says "Close") */
  finishLabel?: string
}

interface TourScreen {
  id: string
  title: string
  subtitle: string
  content: React.ReactNode
}

export function TourStep({ onContinue, onBack, finishLabel }: TourStepProps) {
  const { t } = useTranslation('onboarding')
  const [currentScreen, setCurrentScreen] = useState(0)

  const screens: TourScreen[] = [
    { id: 'widget', title: t('tour.widget.title'), subtitle: t('tour.widget.subtitle'), content: <WidgetTourContent /> },
    { id: 'ai-help', title: t('tour.aiHelp.title'), subtitle: t('tour.aiHelp.subtitle'), content: <AIHelpTourContent /> },
    { id: 'dashboard', title: t('tour.dashboard.title'), subtitle: t('tour.dashboard.subtitle'), content: <DashboardTourContent /> },
    { id: 'modes', title: t('tour.modes.title'), subtitle: t('tour.modes.subtitle'), content: <ModesTourContent /> },
    { id: 'shortcuts', title: t('tour.shortcuts.title'), subtitle: t('tour.shortcuts.subtitle'), content: <ShortcutsTourContent /> },
  ]

  const handleNext = () => {
    if (currentScreen < screens.length - 1) setCurrentScreen(currentScreen + 1)
  }

  const handlePrev = () => {
    if (currentScreen > 0) setCurrentScreen(currentScreen - 1)
  }

  const isLastScreen = currentScreen === screens.length - 1

  return (
    <div className="flex flex-col h-full px-8 py-8">
      <div className="flex-1 flex flex-col items-center">
        <div className="text-center mb-6">
          <GradientText as="h2" className="text-title-md font-semibold mb-2">
            {screens[currentScreen].title}
          </GradientText>
          <p className="text-body-md text-qm-text-secondary">{screens[currentScreen].subtitle}</p>
        </div>

        <div className="flex-1 w-full max-w-2xl overflow-y-auto">{screens[currentScreen].content}</div>
      </div>

      <div className="flex justify-center gap-2 my-4">
        {screens.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentScreen(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              index === currentScreen ? 'w-6 bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end' : 'bg-qm-surface-medium hover:bg-qm-surface-hover',
            )}
          />
        ))}
      </div>

      <div className="flex justify-between items-center max-w-2xl mx-auto w-full">
        <button
          onClick={currentScreen === 0 ? onBack : handlePrev}
          className="flex items-center gap-2 px-4 py-2.5 rounded-qm-lg text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {currentScreen === 0 ? t('nav.back') : t('nav.previous')}
        </button>

        {isLastScreen ? (
          <button
            onClick={onContinue}
            className="px-6 py-2.5 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium hover:scale-105 transition-transform duration-200"
          >
            {finishLabel ?? t('nav.gotIt')}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2.5 rounded-qm-lg bg-qm-surface-medium text-qm-text-primary hover:bg-qm-surface-hover transition-colors"
          >
            {t('nav.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function WidgetTourContent() {
  const { t } = useTranslation('onboarding')
  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-8 mb-6">
        <div className="text-center">
          <div className="mb-2 text-caption text-qm-text-tertiary">{t('tour.widget.collapsed')}</div>
          <div className="w-48 h-12 rounded-full bg-qm-surface-medium border border-qm-border-subtle flex items-center px-4 gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-body-sm text-qm-text-secondary">{t('tour.widget.readyToAssist')}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="mb-2 text-caption text-qm-text-tertiary">{t('tour.widget.expanded')}</div>
          <div className="w-56 rounded-qm-lg bg-qm-surface-medium border border-qm-border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end flex items-center justify-center">
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

      <div className="space-y-3">
        <TourBullet icon={<Monitor className="w-4 h-4" />} text={t('tour.widget.floats')} />
        <TourBullet icon={<Mic className="w-4 h-4" />} text={t('tour.widget.transcription')} />
        <TourBullet icon={<Sparkles className="w-4 h-4" />} text={t('tour.widget.suggestions')} />
      </div>
    </div>
  )
}

function AIHelpTourContent() {
  const { t } = useTranslation('onboarding')
  return (
    <div className="grid grid-cols-2 gap-4">
      <AIFeatureCard icon={<Sparkles className="w-5 h-5" />} title={t('tour.aiHelp.assist')} description={t('tour.aiHelp.assistDescription')} example={t('tour.aiHelp.assistExample')} color="from-purple-500 to-blue-500" />
      <AIFeatureCard icon={<MessageSquare className="w-5 h-5" />} title={t('tour.aiHelp.say')} description={t('tour.aiHelp.sayDescription')} example={t('tour.aiHelp.sayExample')} color="from-green-500 to-teal-500" />
      <AIFeatureCard icon={<MessageCircle className="w-5 h-5" />} title={t('tour.aiHelp.followUp')} description={t('tour.aiHelp.followUpDescription')} example={t('tour.aiHelp.followUpExample')} color="from-orange-500 to-yellow-500" />
      <AIFeatureCard icon={<RotateCcw className="w-5 h-5" />} title={t('tour.aiHelp.recap')} description={t('tour.aiHelp.recapDescription')} example={t('tour.aiHelp.recapExample')} color="from-pink-500 to-rose-500" />
    </div>
  )
}

function DashboardTourContent() {
  const { t } = useTranslation('onboarding')
  return (
    <div className="space-y-6">
      <div className="rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle overflow-hidden">
        <div className="flex">
          <div className="w-48 bg-qm-surface-medium p-4 border-r border-qm-border-subtle">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded bg-qm-surface-hover">
                <Layout className="w-4 h-4 text-qm-accent" />
                <span className="text-body-sm">{t('tour.dashboard.sessions')}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded">
                <Sliders className="w-4 h-4 text-qm-text-tertiary" />
                <span className="text-body-sm text-qm-text-tertiary">{t('tour.dashboard.modes')}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded">
                <Settings className="w-4 h-4 text-qm-text-tertiary" />
                <span className="text-body-sm text-qm-text-tertiary">{t('tour.dashboard.settings')}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="text-body-md font-medium mb-3">{t('tour.dashboard.recentSessions')}</div>
            <div className="space-y-2">
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
              <div className="h-10 bg-qm-surface-hover rounded-qm-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <DashboardFeature icon={<Layout />} title={t('tour.dashboard.sessions')} description={t('tour.dashboard.sessionsDescription')} />
        <DashboardFeature icon={<Sliders />} title={t('tour.dashboard.modes')} description={t('tour.dashboard.modesDescription')} />
        <DashboardFeature icon={<Settings />} title={t('tour.dashboard.settings')} description={t('tour.dashboard.settingsDescription')} />
      </div>
    </div>
  )
}

function ModesTourContent() {
  const { t } = useTranslation('onboarding')
  return (
    <div className="space-y-6">
      <p className="text-body-sm text-qm-text-secondary text-center">{t('tour.modes.intro')}</p>

      <div className="grid grid-cols-2 gap-4">
        <ModeCard icon={<Sparkles />} name={t('tour.modes.default')} description={t('tour.modes.defaultDescription')} />
        <ModeCard icon={<Briefcase />} name={t('tour.modes.professional')} description={t('tour.modes.professionalDescription')} />
        <ModeCard icon={<User />} name={t('tour.modes.interview')} description={t('tour.modes.interviewDescription')} />
        <ModeCard icon={<MessageSquare />} name={t('tour.modes.sales')} description={t('tour.modes.salesDescription')} />
      </div>

      <p className="text-caption text-qm-text-tertiary text-center">{t('tour.modes.outro')}</p>
    </div>
  )
}

function ShortcutsTourContent() {
  const { t } = useTranslation('onboarding')
  // Mirrors the real bindings (electron/services/globalShortcuts.ts + widget input)
  return (
    <div className="space-y-4">
      <ShortcutRow keys={['Ctrl', 'Shift', 'S']} title={t('tour.shortcuts.session')} description={t('tour.shortcuts.sessionDescription')} />
      <ShortcutRow keys={['Ctrl', 'Shift', 'H']} title={t('tour.shortcuts.widget')} description={t('tour.shortcuts.widgetDescription')} />
      <ShortcutRow keys={['Ctrl', 'Shift', 'R']} title={t('tour.shortcuts.clear')} description={t('tour.shortcuts.clearDescription')} />
      <ShortcutRow keys={['Enter']} title={t('tour.shortcuts.run')} description={t('tour.shortcuts.runDescription')} />
    </div>
  )
}

function TourBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-qm-md bg-qm-surface-light">
      <div className="text-qm-accent">{icon}</div>
      <span className="text-body-sm text-qm-text-primary">{text}</span>
    </div>
  )
}

function AIFeatureCard({ icon, title, description, example, color }: { icon: React.ReactNode; title: string; description: string; example: string; color: string }) {
  return (
    <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div className={cn('w-10 h-10 rounded-qm-md flex items-center justify-center text-white mb-3 bg-gradient-to-r', color)}>{icon}</div>
      <h4 className="text-body-md font-medium text-qm-text-primary mb-1">{title}</h4>
      <p className="text-body-sm text-qm-text-secondary mb-2">{description}</p>
      <p className="text-caption italic text-qm-text-tertiary">{example}</p>
    </div>
  )
}

function DashboardFeature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-3">
      <div className="w-10 h-10 mx-auto rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent mb-2">{icon}</div>
      <div className="text-body-sm font-medium text-qm-text-primary">{title}</div>
      <div className="text-caption text-qm-text-tertiary">{description}</div>
    </div>
  )
}

function ModeCard({ icon, name, description }: { icon: React.ReactNode; name: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div className="w-10 h-10 rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent">{icon}</div>
      <div>
        <div className="text-body-sm font-medium text-qm-text-primary">{name}</div>
        <div className="text-caption text-qm-text-secondary">{description}</div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, title, description }: { keys: string[]; title: string; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      <div>
        <div className="text-body-md font-medium text-qm-text-primary">{title}</div>
        <div className="text-body-sm text-qm-text-secondary">{description}</div>
      </div>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index}>
            <kbd className="px-2 py-1 text-caption font-mono bg-qm-surface-medium rounded border border-qm-border-subtle">{key}</kbd>
            {index < keys.length - 1 && <span className="text-qm-text-tertiary mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
