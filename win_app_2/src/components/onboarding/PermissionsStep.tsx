import { useState } from 'react'
import { Mic, Monitor, Keyboard, Check, AlertCircle, Info } from 'lucide-react'

interface PermissionsStepProps {
  onContinue: () => void
  onBack: () => void
}

interface Permission {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  required: boolean
  status: 'granted' | 'pending' | 'denied'
}

export function PermissionsStep({ onContinue, onBack }: PermissionsStepProps) {
  // On Windows, these permissions are typically granted at the OS level
  // We'll show the user what permissions are needed and let them proceed
  const [permissions] = useState<Permission[]>([
    {
      id: 'microphone',
      name: 'Microphone Access',
      description: 'Required to capture and transcribe your voice during conversations',
      icon: <Mic className="w-5 h-5" />,
      required: true,
      status: 'pending', // Windows handles this at app-level
    },
    {
      id: 'screen',
      name: 'Screen Recording',
      description: 'Needed to capture screen content for context-aware AI assistance',
      icon: <Monitor className="w-5 h-5" />,
      required: true,
      status: 'pending',
    },
    {
      id: 'keyboard',
      name: 'Keyboard Shortcuts',
      description: 'For quick access to features with global shortcuts (Ctrl+Shift+S, etc.)',
      icon: <Keyboard className="w-5 h-5" />,
      required: false,
      status: 'granted', // Global shortcuts work by default on Windows
    },
  ])

  return (
    <div className="flex flex-col h-full px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-title-md font-semibold text-qm-text-primary mb-2">
          App Permissions
        </h2>
        <p className="text-body-md text-qm-text-secondary max-w-md mx-auto">
          Queen Mama needs a few permissions to work its magic. These can be changed later in
          Windows Settings.
        </p>
      </div>

      {/* Permission Cards */}
      <div className="flex-1 max-w-lg mx-auto w-full space-y-4 mb-8">
        {permissions.map((permission) => (
          <PermissionCard key={permission.id} permission={permission} />
        ))}
      </div>

      {/* Info Box */}
      <div className="max-w-lg mx-auto w-full mb-8">
        <div className="flex items-start gap-3 p-4 rounded-qm-lg bg-qm-info/10 border border-qm-info/20">
          <Info className="w-5 h-5 text-qm-info flex-shrink-0 mt-0.5" />
          <p className="text-body-sm text-qm-text-secondary">
            When prompted by Windows, please allow access to ensure Queen Mama can assist you
            during your conversations.
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between max-w-lg mx-auto w-full">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-qm-lg text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-light transition-colors"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-6 py-2.5 rounded-qm-lg bg-gradient-to-r from-qm-primary to-qm-secondary text-white font-medium hover:scale-105 transition-transform duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

interface PermissionCardProps {
  permission: Permission
}

function PermissionCard({ permission }: PermissionCardProps) {
  const statusConfig = {
    granted: {
      icon: <Check className="w-4 h-4" />,
      color: 'text-qm-success',
      bgColor: 'bg-qm-success/10',
      label: 'Granted',
    },
    pending: {
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-qm-warning',
      bgColor: 'bg-qm-warning/10',
      label: 'Will prompt',
    },
    denied: {
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-qm-error',
      bgColor: 'bg-qm-error/10',
      label: 'Denied',
    },
  }

  const status = statusConfig[permission.status]

  return (
    <div className="flex items-start gap-4 p-4 rounded-qm-lg bg-qm-surface-light border border-qm-border-subtle">
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-qm-md bg-qm-surface-medium flex items-center justify-center text-qm-accent">
        {permission.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-body-md font-medium text-qm-text-primary">{permission.name}</h3>
          {!permission.required && (
            <span className="px-2 py-0.5 text-caption rounded bg-qm-surface-medium text-qm-text-tertiary">
              Optional
            </span>
          )}
        </div>
        <p className="text-body-sm text-qm-text-secondary">{permission.description}</p>
      </div>

      {/* Status Badge */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-qm-sm ${status.bgColor} ${status.color}`}
      >
        {status.icon}
        <span className="text-caption font-medium">{status.label}</span>
      </div>
    </div>
  )
}
