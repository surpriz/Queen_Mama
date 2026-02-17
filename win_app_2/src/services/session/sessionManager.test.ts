import { describe, it, expect, beforeEach } from 'vitest'
import * as sessionManager from './sessionManager'
import { useSessionStore } from '@/stores/sessionStore'

// Reset store before each test
beforeEach(() => {
  useSessionStore.setState({
    sessions: [],
    currentSession: null,
    searchQuery: '',
    isLoading: false,
  })
})

describe('sessionManager', () => {
  describe('startSession', () => {
    it('should create a new session with default title', () => {
      const session = sessionManager.startSession()

      expect(session).toBeDefined()
      expect(session.id).toBeTruthy()
      expect(session.title).toContain('Session')
      expect(session.startTime).toBeTruthy()
      expect(session.endTime).toBeNull()
      expect(session.transcript).toBe('')
      expect(session.summary).toBeNull()
      expect(session.entries).toEqual([])
    })

    it('should create a session with custom title', () => {
      const session = sessionManager.startSession('My Custom Session')

      expect(session.title).toBe('My Custom Session')
    })

    it('should create a session with mode ID', () => {
      const session = sessionManager.startSession('Test', 'interview-mode')

      expect(session.modeId).toBe('interview-mode')
    })

    it('should add session to store', () => {
      const session = sessionManager.startSession()

      const store = useSessionStore.getState()
      expect(store.sessions).toHaveLength(1)
      expect(store.sessions[0].id).toBe(session.id)
      expect(store.currentSession?.id).toBe(session.id)
    })
  })

  describe('endSession', () => {
    it('should set end time on current session', () => {
      sessionManager.startSession()
      sessionManager.endSession()

      const store = useSessionStore.getState()
      expect(store.sessions[0].endTime).toBeTruthy()
      expect(store.currentSession).toBeNull()
    })

    it('should do nothing if no current session', () => {
      // Should not throw
      sessionManager.endSession()
      expect(useSessionStore.getState().sessions).toHaveLength(0)
    })
  })

  describe('updateTranscript', () => {
    it('should update transcript of current session', () => {
      sessionManager.startSession()
      sessionManager.updateTranscript('Hello world')

      const store = useSessionStore.getState()
      expect(store.currentSession?.transcript).toBe('Hello world')
    })

    it('should do nothing if no current session', () => {
      // Should not throw
      sessionManager.updateTranscript('Hello')
    })
  })

  describe('setTitle', () => {
    it('should update title of current session', () => {
      sessionManager.startSession('Original')
      sessionManager.setTitle('New Title')

      const store = useSessionStore.getState()
      expect(store.currentSession?.title).toBe('New Title')
    })
  })

  describe('setSummary', () => {
    it('should update summary of current session', () => {
      sessionManager.startSession()
      sessionManager.setSummary('This is a summary')

      const store = useSessionStore.getState()
      expect(store.currentSession?.summary).toBe('This is a summary')
    })
  })

  describe('setActionItems', () => {
    it('should update action items of current session', () => {
      sessionManager.startSession()
      sessionManager.setActionItems(['Item 1', 'Item 2'])

      const store = useSessionStore.getState()
      expect(store.currentSession?.actionItems).toEqual(['Item 1', 'Item 2'])
    })
  })

  describe('addTranscriptEntry', () => {
    it('should add entry to current session', () => {
      sessionManager.startSession()
      const entry = sessionManager.addTranscriptEntry('user', 'Hello', true)

      expect(entry.speaker).toBe('user')
      expect(entry.text).toBe('Hello')
      expect(entry.isFinal).toBe(true)
      expect(entry.timestamp).toBeTruthy()

      const store = useSessionStore.getState()
      expect(store.currentSession?.entries).toHaveLength(1)
    })
  })

  describe('deleteSession', () => {
    it('should remove session from store', () => {
      const session = sessionManager.startSession()
      sessionManager.endSession()

      expect(useSessionStore.getState().sessions).toHaveLength(1)

      sessionManager.deleteSession(session.id)

      expect(useSessionStore.getState().sessions).toHaveLength(0)
    })
  })
})
