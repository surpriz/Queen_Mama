import { useConfigStore } from '@/stores/configStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { useAuth } from '@/hooks/useAuth'
import { KeyboardShortcutBadge } from '@/components/common/KeyboardShortcutBadge'

export function SettingsView() {
  const config = useConfigStore()
  const license = useLicenseStore()
  const { currentUser, logout } = useAuth()

  const handleToggle = (key: keyof typeof config, value: boolean) => {
    config.updateConfig({ [key]: value })
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <h2 className="text-title-sm font-semibold text-qm-text-primary mb-6">Settings</h2>

      <div className="space-y-8 max-w-2xl">
        {/* Account */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Account</h3>
          <div className="p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-body-sm text-qm-text-secondary">Email</span>
              <span className="text-body-sm text-qm-text-primary">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-body-sm text-qm-text-secondary">Plan</span>
              <span className="text-body-sm text-qm-accent font-medium capitalize">
                {license.currentLicense.plan}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="w-full mt-2 px-4 py-2 rounded-qm-md bg-qm-surface-medium hover:bg-qm-error-light text-body-sm text-qm-text-secondary hover:text-qm-error transition-colors"
            >
              Sign Out
            </button>
          </div>
        </section>

        {/* General */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">General</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Smart Mode"
              description="Enhanced AI reasoning (Enterprise)"
              enabled={config.smartModeEnabled}
              onToggle={(v) => handleToggle('smartModeEnabled', v)}
            />
            <ToggleRow
              label="Undetectable Overlay"
              description="Hide overlay from screen sharing (Enterprise)"
              enabled={config.isUndetectabilityEnabled}
              onToggle={(v) => handleToggle('isUndetectabilityEnabled', v)}
            />
            <ToggleRow
              label="Auto Screen Capture"
              description="Automatically capture screenshots"
              enabled={config.autoScreenCapture}
              onToggle={(v) => handleToggle('autoScreenCapture', v)}
            />
          </div>
        </section>

        {/* Auto-Answer */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">Auto-Answer</h3>
          <div className="space-y-3">
            <ToggleRow
              label="Enable Auto-Answer"
              description="Automatically trigger AI based on conversation flow (Enterprise)"
              enabled={config.autoAnswerEnabled}
              onToggle={(v) => handleToggle('autoAnswerEnabled', v)}
            />
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Silence Threshold</span>
              <span className="text-body-sm text-qm-text-primary">
                {config.autoAnswerSilenceThreshold}s
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Cooldown</span>
              <span className="text-body-sm text-qm-text-primary">
                {config.autoAnswerCooldown}s
              </span>
            </div>
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3 className="text-headline font-semibold text-qm-text-primary mb-4">
            Keyboard Shortcuts
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Start/Stop Session</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Shift+S" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Toggle Widget</span>
              <KeyboardShortcutBadge shortcut="Ctrl+\\" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Trigger AI Assist</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Enter" />
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-qm-text-secondary">Clear Context</span>
              <KeyboardShortcutBadge shortcut="Ctrl+Shift+R" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-body-sm text-qm-text-primary">{label}</p>
        <p className="text-caption text-qm-text-tertiary">{description}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-qm-accent' : 'bg-qm-surface-pressed'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
