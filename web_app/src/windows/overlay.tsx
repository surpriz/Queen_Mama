// Queen Mama LITE - Overlay Window Entry Point

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import OverlayWindow from '../components/overlay/OverlayWindow';
import { useAuthStore } from '../stores/authStore';
import '../styles/globals.css';

// Wrapper component that initializes auth before rendering overlay
function OverlayApp() {
  const { initialize, accessToken, isLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize auth to load tokens from Tauri store
    initialize().then(() => {
      setIsReady(true);
    });
  }, [initialize]);

  // Show loading state while initializing
  if (isLoading || !isReady) {
    return (
      <div className="overlay-container glass flex items-center justify-center h-full">
        <div className="text-qm-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!accessToken) {
    return (
      <div className="overlay-container glass flex items-center justify-center h-full">
        <div className="text-qm-text-tertiary text-sm">Sign in to use Queen Mama</div>
      </div>
    );
  }

  return <OverlayWindow />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
