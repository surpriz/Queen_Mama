import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, Check, Sparkles, MessageSquare, HelpCircle, RotateCcw, Eye, EyeOff, GripVertical, Keyboard, Play, Settings, Users } from 'lucide-react'
import { useTourStore } from '@/stores/tourStore'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'
import { cn } from '@/lib/utils'

// Tour page indicator dots
function TourPageIndicator({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalPages }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            index === currentPage
              ? 'w-6 bg-qm-accent'
              : 'w-2 bg-qm-surface-medium'
          )}
        />
      ))}
    </div>
  )
}

// Tour screen header component
function TourScreenHeader({ icon: Icon, title, subtitle }: { icon: typeof Sparkles; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-qm-gradient-start/10 to-qm-gradient-end/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-qm-accent" />
      </div>
      <h3 className="text-title-sm font-semibold text-qm-text-primary mb-1">{title}</h3>
      <p className="text-body-sm text-qm-text-secondary">{subtitle}</p>
    </div>
  )
}

// Bullet point component
function TourBulletPoint({ icon: Icon, text }: { icon: typeof EyeOff; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 flex items-center justify-center">
        <Icon size={14} className="text-qm-accent" />
      </div>
      <span className="text-body-sm text-qm-text-secondary">{text}</span>
    </div>
  )
}

// AI Feature card component
function AIFeatureCard({ icon: Icon, iconColor, title, description, example }: {
  icon: typeof Sparkles
  iconColor: string
  title: string
  description: string
  example: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-qm-md bg-qm-surface-light">
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', iconColor)}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-label-md font-medium text-qm-text-primary">{title}</h4>
        <p className="text-caption text-qm-text-secondary">{description}</p>
        <p className="text-caption text-qm-text-tertiary italic mt-1">{example}</p>
      </div>
    </div>
  )
}

// Mode card component
function ModeCard({ name, icon: Icon, description }: { name: string; icon: typeof Users; description: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-qm-md bg-qm-surface-light">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-qm-gradient-start/10 to-qm-gradient-end/10 flex items-center justify-center">
        <Icon size={14} className="text-qm-accent" />
      </div>
      <div className="flex-1">
        <h4 className="text-label-md font-medium text-qm-text-primary">{name}</h4>
        <p className="text-caption text-qm-text-tertiary">{description}</p>
      </div>
    </div>
  )
}

// Shortcut tip card component
function ShortcutTipCard({ shortcut, title, description }: { shortcut: string; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-qm-md bg-qm-surface-light">
      <KeyboardShortcutBadge shortcut={shortcut} />
      <div className="flex-1">
        <h4 className="text-body-sm font-medium text-qm-text-primary">{title}</h4>
        <p className="text-caption text-qm-text-tertiary">{description}</p>
      </div>
    </div>
  )
}

// Tour Screen 1: Widget Overview
function WidgetTourScreen() {
  return (
    <div className="space-y-6">
      <TourScreenHeader
        icon={Eye}
        title="The Floating Widget"
        subtitle="Your always-visible AI assistant"
      />

      {/* Widget mockup */}
      <div className="flex flex-col items-center gap-4">
        {/* Collapsed widget */}
        <div className="w-64 p-3 rounded-qm-lg bg-qm-bg-secondary border border-qm-border-subtle shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-qm-success" />
            <div className="flex gap-0.5">
              {[12, 16, 10, 14, 8].map((h, i) => (
                <div key={i} className="w-1 rounded-full bg-qm-accent/60" style={{ height: h }} />
              ))}
            </div>
            <span className="ml-auto text-caption text-qm-text-tertiary">Default</span>
          </div>
        </div>
        <span className="text-caption text-qm-text-disabled">↓</span>
        {/* Expanded widget hint */}
        <div className="w-64 p-3 rounded-qm-lg bg-qm-bg-secondary border border-qm-border-subtle shadow-lg">
          <div className="h-24 flex items-center justify-center text-caption text-qm-text-tertiary">
            Expanded view with AI responses
          </div>
        </div>
      </div>

      {/* Key points */}
      <div className="space-y-3">
        <TourBulletPoint icon={EyeOff} text="Invisible to screen sharing & recordings" />
        <TourBulletPoint icon={GripVertical} text="Always stays on top of other windows" />
        <TourBulletPoint icon={GripVertical} text="Drag to reposition anywhere" />
      </div>

      {/* Shortcut */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-body-sm text-qm-text-secondary">Toggle with</span>
        <KeyboardShortcutBadge shortcut="Ctrl+\" />
      </div>
    </div>
  )
}

// Tour Screen 2: AI Features
function AIFeaturesTourScreen() {
  return (
    <div className="space-y-6">
      <TourScreenHeader
        icon={Sparkles}
        title="4 Types of AI Help"
        subtitle="Different responses for different needs"
      />

      <div className="space-y-2">
        <AIFeatureCard
          icon={Sparkles}
          iconColor="bg-qm-accent"
          title="Assist"
          description="Get contextual suggestions based on the conversation"
          example='"Based on what was discussed, you could mention..."'
        />
        <AIFeatureCard
          icon={MessageSquare}
          iconColor="bg-qm-success"
          title="What to Say"
          description="Direct response suggestions you can use"
          example={`"You might say: 'That's a great point, and...'"`}
        />
        <AIFeatureCard
          icon={HelpCircle}
          iconColor="bg-qm-info"
          title="Follow-up Questions"
          description="Smart questions to keep the conversation going"
          example={`"Ask: 'How does this impact...?'"`}
        />
        <AIFeatureCard
          icon={RotateCcw}
          iconColor="bg-qm-warning"
          title="Recap"
          description="Summary of key points discussed so far"
          example='"Key points: 1) Budget is $50k, 2) Timeline is Q2..."'
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="text-body-sm text-qm-text-secondary">Trigger AI with</span>
        <KeyboardShortcutBadge shortcut="Ctrl+Enter" />
      </div>
    </div>
  )
}

// Tour Screen 3: Dashboard
function DashboardTourScreen() {
  return (
    <div className="space-y-6">
      <TourScreenHeader
        icon={Settings}
        title="The Dashboard"
        subtitle="Your command center"
      />

      {/* Dashboard mockup */}
      <div className="rounded-qm-lg border border-qm-border-subtle overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-20 bg-qm-surface-light p-3 space-y-2">
            {['Sessions', 'Modes', 'Settings'].map((item, i) => (
              <div key={item} className="flex items-center gap-1.5">
                <div className={cn('w-1.5 h-1.5 rounded-full', i === 0 ? 'bg-qm-accent' : 'bg-qm-surface-medium')} />
                <span className={cn('text-caption', i === 0 ? 'text-qm-text-primary' : 'text-qm-text-tertiary')}>{item}</span>
              </div>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 bg-qm-bg-secondary p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-sm text-qm-text-primary">Sessions</span>
              <div className="px-2 py-1 rounded-qm-sm bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-caption">Start</div>
            </div>
            <div className="space-y-2">
              <div className="h-6 rounded-qm-sm bg-qm-surface-light" />
              <div className="h-6 rounded-qm-sm bg-qm-surface-light" />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <TourBulletPoint icon={Play} text="Start and stop recording sessions" />
        <TourBulletPoint icon={Settings} text="View past sessions and transcripts" />
        <TourBulletPoint icon={Settings} text="Export transcripts (MD, TXT, JSON)" />
        <TourBulletPoint icon={Settings} text="Access all settings" />
      </div>
    </div>
  )
}

// Tour Screen 4: Modes
function ModesTourScreen() {
  return (
    <div className="space-y-6">
      <TourScreenHeader
        icon={Users}
        title="AI Modes"
        subtitle="Customize AI behavior for different situations"
      />

      <div className="space-y-2">
        <ModeCard name="Default" icon={Sparkles} description="Balanced, helpful assistance for any situation" />
        <ModeCard name="Professional" icon={Users} description="Formal tone for business meetings" />
        <ModeCard name="Interview" icon={Users} description="Helps prepare answers during job interviews" />
        <ModeCard name="Sales" icon={Users} description="Persuasive suggestions for sales calls" />
      </div>

      <div className="p-3 rounded-qm-md bg-qm-accent/5 border border-qm-accent/10">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="text-qm-accent mt-0.5" />
          <p className="text-caption text-qm-text-secondary">
            Create your own custom modes with personalized system prompts in the Dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}

// Tour Screen 5: Shortcuts
function ShortcutsTourScreen() {
  return (
    <div className="space-y-6">
      <TourScreenHeader
        icon={Keyboard}
        title="Keyboard Shortcuts"
        subtitle="Master Queen Mama with these shortcuts"
      />

      <div className="space-y-2">
        <ShortcutTipCard
          shortcut="Ctrl+Shift+S"
          title="Start/Stop Session"
          description="Begin or end recording and transcription"
        />
        <ShortcutTipCard
          shortcut="Ctrl+\"
          title="Toggle Widget"
          description="Show or hide the overlay widget"
        />
        <ShortcutTipCard
          shortcut="Ctrl+Enter"
          title="Ask AI"
          description="Get AI assistance based on current context"
        />
        <ShortcutTipCard
          shortcut="Ctrl+R"
          title="Clear Context"
          description="Reset transcript and start fresh"
        />
        <ShortcutTipCard
          shortcut="Ctrl+Arrows"
          title="Move Widget"
          description="Reposition the widget on screen"
        />
      </div>
    </div>
  )
}

// Main Tour Modal
export function FeatureTourModal() {
  const { isTourOpen, currentPage, totalPages, closeTour, nextPage, previousPage, completeTour } = useTourStore()

  const isLastPage = currentPage === totalPages - 1

  const handleNext = () => {
    if (isLastPage) {
      completeTour()
    } else {
      nextPage()
    }
  }

  const pages = [
    <WidgetTourScreen key="widget" />,
    <AIFeaturesTourScreen key="ai" />,
    <DashboardTourScreen key="dashboard" />,
    <ModesTourScreen key="modes" />,
    <ShortcutsTourScreen key="shortcuts" />,
  ]

  return (
    <AnimatePresence>
      {isTourOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeTour()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg rounded-qm-xl bg-qm-bg-primary border border-qm-border-subtle shadow-2xl overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-qm-gradient-start/5 via-transparent to-qm-gradient-end/3 pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-qm-border-subtle">
              <div>
                <h2 className="text-title-sm font-semibold text-qm-text-primary">Feature Tour</h2>
                <p className="text-caption text-qm-text-tertiary">Learn how to use Queen Mama</p>
              </div>
              <button
                onClick={closeTour}
                className="p-1.5 rounded-qm-md text-qm-text-tertiary hover:text-qm-text-secondary hover:bg-qm-surface-light transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="relative p-6 max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {pages[currentPage]}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="relative flex items-center justify-between p-4 border-t border-qm-border-subtle bg-qm-bg-secondary/50">
              {/* Page indicator */}
              <TourPageIndicator currentPage={currentPage} totalPages={totalPages} />

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                {currentPage > 0 && (
                  <button
                    onClick={previousPage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-qm-surface-medium hover:bg-qm-surface-hover text-body-sm text-qm-text-secondary transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {isLastPage ? (
                    <>
                      Done
                      <Check size={14} />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
