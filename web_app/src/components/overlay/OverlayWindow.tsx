// Queen Mama LITE - Overlay Window Component
// Enhanced with spring physics, staggered animations, and liquid glass

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

// Spring physics for premium expand/collapse
const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// Stagger children animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

export function OverlayWindow() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabItem>('assist');
  const [audioLevel, setAudioLevel] = useState(0);

  // Stores
  const { isSessionActive, startSession, stopSession } = useSessionStore();
  const { responses, currentResponse, isProcessing, triggerAssist, clearResponses } = useAIStore();
  const { isConnected, connect, disconnect, sendAudio, interimText } = useTranscriptionStore();
  const { enableScreenCapture, smartModeEnabled, autoAnswerEnabled, setAutoAnswerEnabled } = useSettingsStore();

  // Overlay is always "hidden" from screen capture in Tauri native mode
  const isHidden = true;

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
    <motion.div
      className="overlay-container glass-liquid border border-qm-border-subtle shadow-qm-depth-floating"
      initial={false}
      animate={{
        width: isExpanded ? 420 : 380,
        height: isExpanded ? 480 : 52,
      }}
      transition={springTransition}
    >
      {/* Header - Always visible */}
      <PillHeader
        isExpanded={isExpanded}
        isSessionActive={isSessionActive}
        isConnected={isConnected}
        audioLevel={audioLevel}
        enableScreenCapture={enableScreenCapture}
        smartModeEnabled={smartModeEnabled}
        autoAnswerEnabled={autoAnswerEnabled}
        isHidden={isHidden}
        onToggleExpand={toggleExpanded}
        onToggleSession={handleToggleSession}
        onToggleAutoAnswer={() => setAutoAnswerEnabled(!autoAnswerEnabled)}
      />

      {/* Expanded Content with staggered reveal */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            className="px-3 pb-3 overflow-hidden"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Tab Bar */}
            <motion.div variants={childVariants}>
              <TabBar
                selectedTab={selectedTab}
                onTabSelect={handleTabSelect}
                isProcessing={isProcessing}
              />
            </motion.div>

            {/* Response History */}
            <motion.div variants={childVariants}>
              <ResponseHistory
                responses={responses}
                currentResponse={currentResponse}
                isProcessing={isProcessing}
                interimText={interimText}
              />
            </motion.div>

            {/* Input Area */}
            <motion.div variants={childVariants}>
              <InputArea
                onSubmit={handleSubmit}
                isProcessing={isProcessing}
                smartModeEnabled={smartModeEnabled}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default OverlayWindow;
