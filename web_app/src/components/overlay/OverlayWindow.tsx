// Queen Mama LITE - Overlay Window Component
// Main overlay container with collapsed/expanded states

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { PillHeader } from './PillHeader';
import { TabBar } from './TabBar';
import { ResponseHistory } from './ResponseHistory';
import { InputArea } from './InputArea';
import { useSessionStore } from '../../stores/sessionStore';
import { useAIStore } from '../../stores/aiStore';
import { useTranscriptionStore } from '../../stores/transcriptionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { audioCaptureService } from '../../services/audio/AudioCaptureService';
import type { TabItem, AIResponseType } from '../../types';

export function OverlayWindow() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabItem>('assist');
  const [audioLevel, setAudioLevel] = useState(0);

  // Stores
  const { isSessionActive, startSession, stopSession } = useSessionStore();
  const { responses, currentResponse, isProcessing, triggerAssist, clearResponses } = useAIStore();
  const { isConnected, connect, disconnect, sendAudio, interimText } = useTranscriptionStore();
  const { enableScreenCapture, smartModeEnabled } = useSettingsStore();

  // Handle expand/collapse
  const toggleExpanded = async () => {
    const newState = !isExpanded;
    setIsExpanded(newState);

    try {
      await invoke('set_overlay_expanded', { expanded: newState });
    } catch (error) {
      console.error('[Overlay] Failed to set expanded state:', error);
    }
  };

  // Handle session toggle
  const handleToggleSession = async () => {
    if (isSessionActive) {
      // Stop session
      audioCaptureService.stop();
      disconnect();
      await stopSession();
    } else {
      // Start session
      startSession();
      await connect();

      audioCaptureService.start({
        onAudioData: (data) => sendAudio(data),
        onLevel: (level) => setAudioLevel(level),
        onError: (error) => console.error('[Audio] Error:', error),
      });
    }
  };

  // Handle tab selection and AI trigger
  const handleTabSelect = (tab: TabItem) => {
    setSelectedTab(tab);
    triggerAssist(tab as AIResponseType);
  };

  // Handle AI assist submit
  const handleSubmit = (customPrompt?: string) => {
    triggerAssist(selectedTab as AIResponseType, customPrompt);
  };

  // Handle clear context
  const handleClearContext = () => {
    clearResponses();
  };

  // Listen for shortcut events
  useEffect(() => {
    const unlistenShortcut = listen<string>('shortcut', (event) => {
      switch (event.payload) {
        case 'trigger_assist':
          handleSubmit();
          break;
        case 'toggle_session':
          handleToggleSession();
          break;
        case 'clear_context':
          handleClearContext();
          break;
      }
    });

    const unlistenExpanded = listen<boolean>('overlay_expanded_changed', (event) => {
      setIsExpanded(event.payload);
    });

    return () => {
      unlistenShortcut.then((fn) => fn());
      unlistenExpanded.then((fn) => fn());
    };
  }, []);

  return (
    <div
      className={`
        overlay-container glass border border-qm-border-subtle
        ${isExpanded ? 'overlay-expanded' : 'overlay-collapsed'}
      `}
    >
      {/* Header - Always visible */}
      <PillHeader
        isExpanded={isExpanded}
        isSessionActive={isSessionActive}
        isConnected={isConnected}
        audioLevel={audioLevel}
        enableScreenCapture={enableScreenCapture}
        smartModeEnabled={smartModeEnabled}
        onToggleExpand={toggleExpanded}
        onToggleSession={handleToggleSession}
      />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="px-3 pb-3"
          >
            {/* Tab Bar */}
            <TabBar
              selectedTab={selectedTab}
              onTabSelect={handleTabSelect}
              isProcessing={isProcessing}
            />

            {/* Response History */}
            <ResponseHistory
              responses={responses}
              currentResponse={currentResponse}
              isProcessing={isProcessing}
              interimText={interimText}
            />

            {/* Input Area */}
            <InputArea
              onSubmit={handleSubmit}
              isProcessing={isProcessing}
              smartModeEnabled={smartModeEnabled}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OverlayWindow;
