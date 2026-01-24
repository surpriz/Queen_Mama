// Queen Mama LITE - Main Application Component

import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { useAuthStore } from './stores/authStore';
import { useSessionStore } from './stores/sessionStore';
import AuthGate from './components/auth/AuthGate';
import DashboardView from './components/dashboard/DashboardView';
import SettingsView from './components/dashboard/SettingsView';

function App() {
  const { isAuthenticated, isLoading, accessToken, initialize: initAuth } = useAuthStore();
  const { startSession, stopSession } = useSessionStore();

  useEffect(() => {
    // Initialize auth on app start
    initAuth();

    // Listen for tray actions
    const unlistenTray = listen<string>('tray_action', (event) => {
      switch (event.payload) {
        case 'start_session':
          startSession();
          break;
        case 'stop_session':
          stopSession();
          break;
      }
    });

    // Listen for shortcut events
    const unlistenShortcut = listen<string>('shortcut', (event) => {
      switch (event.payload) {
        case 'toggle_session':
          // Toggle handled by store
          break;
        case 'clear_context':
          // Clear handled by store
          break;
      }
    });

    return () => {
      unlistenTray.then((fn) => fn());
      unlistenShortcut.then((fn) => fn());
    };
  }, [initAuth, startSession, stopSession]);

  // Show loading screen during auth initialization
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-qm-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-qm-gradient flex items-center justify-center animate-pulse">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <p className="text-qm-text-secondary text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Require both isAuthenticated AND accessToken to show main app
  // This prevents showing main UI before tokens are loaded from Tauri store
  if (!isAuthenticated || !accessToken) {
    return <AuthGate />;
  }

  return (
    <div className="h-screen w-screen bg-qm-bg-primary overflow-hidden">
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
