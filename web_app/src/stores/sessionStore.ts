// Queen Mama LITE - Session Store
// Manages recording sessions and transcript state

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Session, TranscriptEntry } from '../types';

interface SessionStore {
  // State
  currentSession: Session | null;
  sessions: Session[];
  transcript: TranscriptEntry[];
  isSessionActive: boolean;
  isFinalizingSession: boolean;

  // Actions
  startSession: () => void;
  stopSession: () => Promise<void>;
  addTranscript: (content: string, isFinal: boolean, speaker?: string) => void;
  clearTranscript: () => void;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => void;
  getFullTranscript: () => string;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  currentSession: null,
  sessions: [],
  transcript: [],
  isSessionActive: false,
  isFinalizingSession: false,

  // Start a new session
  startSession: () => {
    const session: Session = {
      id: uuidv4(),
      title: `Session ${new Date().toLocaleString()}`,
      startTime: new Date().toISOString(),
      transcriptCount: 0,
      aiResponseCount: 0,
      isActive: true,
    };

    set({
      currentSession: session,
      isSessionActive: true,
      transcript: [],
    });

    console.log('[Session] Started:', session.id);
  },

  // Stop current session
  stopSession: async () => {
    const { currentSession, transcript, sessions } = get();
    if (!currentSession) return;

    set({ isFinalizingSession: true });

    try {
      // Calculate duration
      const endTime = new Date().toISOString();
      const duration = Math.floor(
        (new Date(endTime).getTime() - new Date(currentSession.startTime).getTime()) / 1000
      );

      // Create completed session
      const completedSession: Session = {
        ...currentSession,
        endTime,
        duration,
        transcriptCount: transcript.length,
        isActive: false,
      };

      // Update sessions list
      set({
        currentSession: null,
        isSessionActive: false,
        isFinalizingSession: false,
        sessions: [completedSession, ...sessions],
      });

      console.log('[Session] Stopped:', completedSession.id);
    } catch (error) {
      console.error('[Session] Failed to stop:', error);
      set({ isFinalizingSession: false });
    }
  },

  // Add transcript entry
  addTranscript: (content, isFinal, speaker) => {
    const { currentSession, transcript } = get();
    if (!currentSession) return;

    // If this is an interim result, replace the last interim entry
    if (!isFinal && transcript.length > 0) {
      const lastEntry = transcript[transcript.length - 1];
      if (!lastEntry.isFinal) {
        // Replace last interim
        const updatedTranscript = [...transcript.slice(0, -1)];
        updatedTranscript.push({
          id: lastEntry.id,
          sessionId: currentSession.id,
          content,
          timestamp: new Date().toISOString(),
          isFinal,
          speaker,
        });
        set({ transcript: updatedTranscript });
        return;
      }
    }

    // Add new entry
    const entry: TranscriptEntry = {
      id: uuidv4(),
      sessionId: currentSession.id,
      content,
      timestamp: new Date().toISOString(),
      isFinal,
      speaker,
    };

    set({ transcript: [...transcript, entry] });
  },

  // Clear current transcript
  clearTranscript: () => {
    set({ transcript: [] });
    console.log('[Session] Transcript cleared');
  },

  // Load past sessions (from storage/API)
  loadSessions: async () => {
    // TODO: Load from Tauri store or API
    console.log('[Session] Loading sessions...');
  },

  // Delete a session
  deleteSession: (id) => {
    const { sessions } = get();
    set({ sessions: sessions.filter((s) => s.id !== id) });
    console.log('[Session] Deleted:', id);
  },

  // Get full transcript as string
  getFullTranscript: () => {
    const { transcript } = get();
    return transcript
      .filter((t) => t.isFinal)
      .map((t) => t.content)
      .join(' ');
  },
}));
