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
  const { isAuthenticated, initialize: initAuth } = useAuthStore();
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

  if (!isAuthenticated) {
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
