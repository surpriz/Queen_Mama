// Queen Mama LITE - Dashboard View Component
// Main dashboard with sidebar and session management

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { clsx } from 'clsx';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge, Badge } from '../ui/Badge';
import { AudioStatus } from '../shared/AudioLevel';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranscriptionStore } from '../../stores/transcriptionStore';
import { audioCaptureService } from '../../services/audio/AudioCaptureService';
import type { Session } from '../../types';
import { format } from 'date-fns';

export function DashboardView() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sessions, currentSession, isSessionActive, startSession, stopSession, transcript } = useSessionStore();
  const { modes, selectedModeId, setSelectedMode } = useSettingsStore();
  const { connect, disconnect, sendAudio } = useTranscriptionStore();

  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Get selected session
  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId)
    : currentSession;

  // Handle session toggle
  const handleToggleSession = async () => {
    if (isSessionActive) {
      audioCaptureService.stop();
      disconnect();
      await stopSession();
    } else {
      startSession();
      await connect();
      audioCaptureService.start({
        onAudioData: (data) => sendAudio(data),
        onLevel: (level) => setAudioLevel(level),
        onError: (error) => console.error('[Audio] Error:', error),
      });
    }
  };

  // Show overlay
  const handleShowOverlay = async () => {
    try {
      await invoke('toggle_overlay');
    } catch (error) {
      console.error('[Dashboard] Failed to toggle overlay:', error);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-qm-bg-secondary border-r border-qm-border-subtle flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-qm-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-qm-gradient flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-qm-headline text-qm-text-primary">Queen Mama</h1>
              <p className="text-qm-caption text-qm-text-tertiary">LITE</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <NavItem icon="list" label="Sessions" active />
          <NavItem icon="cpu" label="Modes" onClick={() => {}} />
          <NavItem icon="settings" label="Settings" onClick={() => navigate('/settings')} />
        </nav>

        {/* Session Quick Start */}
        <div className="p-3 border-t border-qm-border-subtle">
          <Button
            variant={isSessionActive ? 'danger' : 'primary'}
            className="w-full"
            onClick={handleToggleSession}
          >
            {isSessionActive ? 'Stop Session' : 'Start Session'}
          </Button>
          <Button
            variant="secondary"
            className="w-full mt-2"
            onClick={handleShowOverlay}
          >
            Show Overlay
          </Button>
        </div>

        {/* User Info */}
        <div className="p-3 border-t border-qm-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-qm-surface-medium flex items-center justify-center">
              <span className="text-qm-body-sm font-medium text-qm-text-primary">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-qm-body-sm text-qm-text-primary truncate">{user?.name}</p>
              <p className="text-qm-caption text-qm-text-tertiary truncate">{user?.email}</p>
            </div>
            <IconButton aria-label="Logout" variant="ghost" size="sm" onClick={() => logout()}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </IconButton>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-qm-bg-primary overflow-hidden">
        {/* Header */}
        <header className="h-14 px-6 border-b border-qm-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-qm-title-sm text-qm-text-primary">Sessions</h2>
            {isSessionActive && (
              <StatusBadge status="active" label="Recording" />
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Selector */}
            <select
              value={selectedModeId}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-qm-surface-light border border-qm-border-subtle rounded-qm-md px-3 py-1.5 text-qm-body-sm text-qm-text-primary"
            >
              {modes.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name}</option>
              ))}
            </select>

            {/* Audio Status */}
            <AudioStatus isRecording={isSessionActive} level={audioLevel} />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Session List */}
          <div className="w-80 border-r border-qm-border-subtle overflow-y-auto">
            {/* Current Session */}
            {currentSession && (
              <div className="p-4 border-b border-qm-border-subtle">
                <p className="text-qm-caption text-qm-text-tertiary uppercase tracking-wide mb-2">
                  Current Session
                </p>
                <SessionItem
                  session={currentSession}
                  isSelected={selectedSession?.id === currentSession.id}
                  onClick={() => setSelectedSessionId(null)}
                />
              </div>
            )}

            {/* Past Sessions */}
            <div className="p-4">
              <p className="text-qm-caption text-qm-text-tertiary uppercase tracking-wide mb-2">
                History
              </p>
              {sessions.length === 0 ? (
                <p className="text-qm-body-sm text-qm-text-secondary py-4 text-center">
                  No sessions yet
                </p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isSelected={selectedSession?.id === session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Session Detail */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedSession ? (
              <SessionDetail session={selectedSession} transcript={transcript} />
            ) : (
              <EmptyState onStart={handleToggleSession} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Navigation Item
interface NavItemProps {
  icon: 'list' | 'cpu' | 'settings';
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  const icons = {
    list: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    cpu: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    settings: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2 rounded-qm-md transition-colors',
        active
          ? 'bg-qm-accent/15 text-qm-accent'
          : 'text-qm-text-secondary hover:bg-qm-surface-light hover:text-qm-text-primary'
      )}
    >
      {icons[icon]}
      <span className="text-qm-body-sm font-medium">{label}</span>
    </button>
  );
}

// Session Item
interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
}

function SessionItem({ session, isSelected, onClick }: SessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3 rounded-qm-md transition-colors',
        isSelected
          ? 'bg-qm-accent/15 border border-qm-accent/30'
          : 'bg-qm-surface-light hover:bg-qm-surface-hover border border-transparent'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-qm-body-sm font-medium text-qm-text-primary truncate">
          {session.title}
        </span>
        {session.isActive && <Badge variant="success" size="sm">Live</Badge>}
      </div>
      <div className="flex items-center gap-2 text-qm-caption text-qm-text-tertiary">
        <span>{format(new Date(session.startTime), 'MMM d, HH:mm')}</span>
        {session.duration && (
          <>
            <span>•</span>
            <span>{Math.floor(session.duration / 60)}m</span>
          </>
        )}
      </div>
    </button>
  );
}

// Session Detail
interface SessionDetailProps {
  session: Session;
  transcript: Array<{ content: string; timestamp: string; isFinal: boolean }>;
}

function SessionDetail({ session, transcript }: SessionDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-qm-title-sm text-qm-text-primary mb-2">{session.title}</h3>
        <div className="flex items-center gap-4 text-qm-body-sm text-qm-text-secondary">
          <span>{format(new Date(session.startTime), 'MMMM d, yyyy • HH:mm')}</span>
          {session.duration && <span>Duration: {Math.floor(session.duration / 60)}m {session.duration % 60}s</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="sm">
          <p className="text-qm-caption text-qm-text-tertiary">Transcripts</p>
          <p className="text-2xl font-bold text-qm-text-primary">{session.transcriptCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-qm-caption text-qm-text-tertiary">AI Responses</p>
          <p className="text-2xl font-bold text-qm-text-primary">{session.aiResponseCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-qm-caption text-qm-text-tertiary">Status</p>
          <p className="text-2xl font-bold text-qm-text-primary">{session.isActive ? 'Active' : 'Ended'}</p>
        </Card>
      </div>

      {/* Transcript */}
      <div>
        <h4 className="text-qm-headline text-qm-text-primary mb-3">Transcript</h4>
        <Card className="max-h-96 overflow-y-auto">
          {transcript.length === 0 ? (
            <p className="text-qm-body-sm text-qm-text-tertiary text-center py-8">
              No transcript available
            </p>
          ) : (
            <div className="space-y-2">
              {transcript.filter(t => t.isFinal).map((entry, i) => (
                <p key={i} className="text-qm-body-sm text-qm-text-primary">
                  {entry.content}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Empty State
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-qm-gradient/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-qm-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-qm-text-primary mb-2">
          Start your first session
        </h3>
        <p className="text-qm-body-md text-qm-text-secondary mb-6">
          Record your conversations and get AI-powered coaching in real-time.
        </p>
        <Button variant="primary" onClick={onStart}>
          Start Session
        </Button>
      </div>
    </div>
  );
}

export default DashboardView;
