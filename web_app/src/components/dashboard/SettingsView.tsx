// Queen Mama LITE - Settings View Component
// Application settings and preferences

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { Button, IconButton } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function SettingsView() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    enableScreenCapture,
    setEnableScreenCapture,
    smartModeEnabled,
    setSmartModeEnabled,
    autoStartOnLaunch,
    setAutoStartOnLaunch,
    language,
    setLanguage,
    overlayPosition,
    setOverlayPosition,
    resetToDefaults,
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState<'general' | 'features' | 'account'>('general');

  // Handle autostart toggle
  const handleAutostartToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setAutoStartOnLaunch(enabled);
    } catch (error) {
      console.error('[Settings] Failed to toggle autostart:', error);
    }
  };

  return (
    <div className="h-screen flex bg-qm-bg-primary">
      {/* Sidebar */}
      <div className="w-56 bg-qm-bg-secondary border-r border-qm-border-subtle flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-qm-border-subtle flex items-center gap-3">
          <IconButton aria-label="Back" variant="ghost" size="sm" onClick={() => navigate('/')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </IconButton>
          <h1 className="text-qm-headline text-qm-text-primary">Settings</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <SettingsNavItem
            icon="settings"
            label="General"
            active={activeSection === 'general'}
            onClick={() => setActiveSection('general')}
          />
          <SettingsNavItem
            icon="sparkles"
            label="Features"
            active={activeSection === 'features'}
            onClick={() => setActiveSection('features')}
          />
          <SettingsNavItem
            icon="user"
            label="Account"
            active={activeSection === 'account'}
            onClick={() => setActiveSection('account')}
          />
        </nav>

        {/* App Version */}
        <div className="p-4 border-t border-qm-border-subtle">
          <p className="text-qm-caption text-qm-text-tertiary">Queen Mama LITE v1.0.0</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          {activeSection === 'general' && (
            <>
              <h2 className="text-qm-title-sm text-qm-text-primary mb-4">General Settings</h2>

              {/* Startup */}
              <Card>
                <CardHeader>
                  <CardTitle>Startup</CardTitle>
                  <CardDescription>Configure how Queen Mama launches</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ToggleSetting
                    label="Launch at login"
                    description="Automatically start Queen Mama when you log in"
                    enabled={autoStartOnLaunch}
                    onChange={handleAutostartToggle}
                  />
                </CardContent>
              </Card>

              {/* Overlay */}
              <Card>
                <CardHeader>
                  <CardTitle>Overlay Position</CardTitle>
                  <CardDescription>Default position for the overlay widget</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {(['topLeft', 'topCenter', 'topRight', 'bottomLeft', 'bottomCenter', 'bottomRight'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setOverlayPosition(pos)}
                        className={`
                          px-3 py-2 rounded-qm-md text-qm-body-sm font-medium transition-colors
                          ${overlayPosition === pos
                            ? 'bg-qm-accent/15 text-qm-accent border border-qm-accent/30'
                            : 'bg-qm-surface-light text-qm-text-secondary hover:bg-qm-surface-hover border border-transparent'
                          }
                        `}
                      >
                        {pos.replace(/([A-Z])/g, ' $1').trim()}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Language */}
              <Card>
                <CardHeader>
                  <CardTitle>Language</CardTitle>
                  <CardDescription>Preferred language for transcription and AI responses</CardDescription>
                </CardHeader>
                <CardContent>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-2 text-qm-body-md text-qm-text-primary"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                  </select>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'features' && (
            <>
              <h2 className="text-qm-title-sm text-qm-text-primary mb-4">Features</h2>

              {/* Screen Capture */}
              <Card>
                <CardHeader>
                  <CardTitle>Screen Capture</CardTitle>
                  <CardDescription>Include screenshots for visual context in AI analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleSetting
                    label="Enable screen capture"
                    description="Capture screen when requesting AI assistance"
                    enabled={enableScreenCapture}
                    onChange={setEnableScreenCapture}
                  />
                </CardContent>
              </Card>

              {/* Smart Mode */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Smart Mode</CardTitle>
                    <Badge variant="accent" size="sm">Enterprise</Badge>
                  </div>
                  <CardDescription>Enhanced AI reasoning for complex situations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleSetting
                    label="Enable Smart Mode"
                    description="Use advanced AI models for better responses"
                    enabled={smartModeEnabled}
                    onChange={setSmartModeEnabled}
                  />
                </CardContent>
              </Card>

              {/* Reset */}
              <Card>
                <CardHeader>
                  <CardTitle>Reset Settings</CardTitle>
                  <CardDescription>Restore all settings to their default values</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="danger" onClick={resetToDefaults}>
                    Reset to Defaults
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === 'account' && (
            <>
              <h2 className="text-qm-title-sm text-qm-text-primary mb-4">Account</h2>

              {/* Profile */}
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-qm-gradient flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {user?.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-qm-headline text-qm-text-primary">{user?.name}</p>
                      <p className="text-qm-body-sm text-qm-text-secondary">{user?.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription */}
              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-qm-body-md text-qm-text-primary font-medium">
                        {user?.subscriptionPlan?.toUpperCase() || 'FREE'}
                      </p>
                      <p className="text-qm-body-sm text-qm-text-secondary">Current plan</p>
                    </div>
                    <Button variant="secondary" onClick={() => window.open('https://queenmama.io/pricing', '_blank')}>
                      Upgrade
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Feedback */}
              <Card>
                <CardHeader>
                  <CardTitle>Feedback</CardTitle>
                  <CardDescription>Help us improve Queen Mama</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="secondary"
                    onClick={() => window.open('https://queenmama.featurebase.app', '_blank')}
                  >
                    Give Feedback
                  </Button>
                </CardContent>
              </Card>

              {/* Logout */}
              <Card variant="bordered">
                <CardContent>
                  <Button variant="danger" onClick={() => logout()}>
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Settings Navigation Item
interface SettingsNavItemProps {
  icon: 'settings' | 'sparkles' | 'user';
  label: string;
  active: boolean;
  onClick: () => void;
}

function SettingsNavItem({ icon, label, active, onClick }: SettingsNavItemProps) {
  const icons = {
    settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    sparkles: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    user: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-qm-md transition-colors
        ${active
          ? 'bg-qm-accent/15 text-qm-accent'
          : 'text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary'
        }
      `}
    >
      {icons[icon]}
      <span className="text-qm-body-sm font-medium">{label}</span>
    </button>
  );
}

// Toggle Setting
interface ToggleSettingProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleSetting({ label, description, enabled, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-qm-body-md text-qm-text-primary font-medium">{label}</p>
        <p className="text-qm-body-sm text-qm-text-secondary">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`
          relative w-11 h-6 rounded-full transition-colors duration-200
          ${enabled ? 'bg-qm-accent' : 'bg-qm-surface-medium'}
        `}
      >
        <span
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
            ${enabled ? 'left-6' : 'left-1'}
          `}
        />
      </button>
    </div>
  );
}

export default SettingsView;
