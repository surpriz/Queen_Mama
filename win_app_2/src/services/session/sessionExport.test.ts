import { describe, it, expect, beforeEach } from 'vitest'
import { useLicenseStore } from '@/stores/licenseStore'
import { FREE_LICENSE, SubscriptionPlan, SubscriptionStatus } from '@/types/auth'
import {
  exportSession,
  canExportFormat,
  getAvailableFormats,
  copySessionToClipboard,
  exportMultipleSessions,
} from './sessionExport'
import type { Session } from '@/types/models'

const PRO_LICENSE = {
  valid: true,
  plan: SubscriptionPlan.Pro,
  status: SubscriptionStatus.Active,
  features: {
    smartModeEnabled: false,
    smartModeLimit: null,
    customModesEnabled: true,
    exportFormats: ['text', 'markdown', 'json'],
    autoAnswerEnabled: false,
    sessionSyncEnabled: true,
    dailyAiRequestLimit: 100,
    maxSyncedSessions: 1000,
    maxTranscriptSize: null,
    undetectableEnabled: false,
    screenshotEnabled: true,
    knowledgeBaseEnabled: false,
    proactiveSuggestionsEnabled: false,
  },
  trial: null,
  cacheTTL: 3600,
  validatedAt: new Date().toISOString(),
  signature: 'test-signature',
}

const mockSession: Session = {
  id: 'test-session-1',
  title: 'Test Session',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:30:00Z',
  transcript: 'Hello, this is a test transcript.',
  summary: 'This is a summary of the session.',
  actionItems: ['Follow up with client', 'Send proposal'],
  modeId: 'interview',
  entries: [
    {
      id: 'entry-1',
      sessionId: 'test-session-1',
      timestamp: '2024-01-15T10:05:00Z',
      speaker: 'user',
      text: 'Hello, this is a test',
      isFinal: true,
    },
    {
      id: 'entry-2',
      sessionId: 'test-session-1',
      timestamp: '2024-01-15T10:10:00Z',
      speaker: 'user',
      text: 'transcript.',
      isFinal: true,
    },
  ],
  syncStatus: 'local',
}

beforeEach(() => {
  useLicenseStore.setState({
    currentLicense: FREE_LICENSE,
    isValidating: false,
    isOffline: false,
    lastValidatedAt: null,
    smartModeUsedToday: 0,
    aiRequestsToday: 0,
  })
})

describe('sessionExport', () => {
  describe('canExportFormat', () => {
    it('should allow plaintext for free users', () => {
      expect(canExportFormat('plaintext')).toBe(true)
    })

    it('should block markdown for free users', () => {
      expect(canExportFormat('markdown')).toBe(false)
    })

    it('should block json for free users', () => {
      expect(canExportFormat('json')).toBe(false)
    })

    it('should allow markdown for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      expect(canExportFormat('markdown')).toBe(true)
    })

    it('should allow json for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      expect(canExportFormat('json')).toBe(true)
    })
  })

  describe('getAvailableFormats', () => {
    it('should return only plaintext for free users', () => {
      const formats = getAvailableFormats()
      expect(formats).toEqual(['plaintext'])
    })

    it('should return all formats for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      const formats = getAvailableFormats()
      expect(formats).toContain('plaintext')
      expect(formats).toContain('markdown')
      expect(formats).toContain('json')
    })
  })

  describe('exportSession', () => {
    describe('plaintext export', () => {
      it('should export session as plaintext', () => {
        const result = exportSession(mockSession, 'plaintext')

        expect(result).toContain('Test Session')
        expect(result).toContain('Hello, this is a test transcript.')
        expect(result).toContain('Follow up with client')
        expect(result).toContain('This is a summary')
      })

      it('should respect export options', () => {
        const result = exportSession(mockSession, 'plaintext', {
          includeTranscript: false,
          includeSummary: false,
          includeActionItems: false,
        })

        expect(result).toContain('Test Session')
        expect(result).not.toContain('TRANSCRIPT')
        expect(result).not.toContain('SUMMARY')
        expect(result).not.toContain('ACTION ITEMS')
      })
    })

    describe('markdown export', () => {
      it('should throw error for free users', () => {
        expect(() => exportSession(mockSession, 'markdown')).toThrow('requires a PRO subscription')
      })

      it('should export session as markdown for pro users', () => {
        useLicenseStore.setState({ currentLicense: PRO_LICENSE })
        const result = exportSession(mockSession, 'markdown')

        expect(result).toContain('# Test Session')
        expect(result).toContain('## Summary')
        expect(result).toContain('## Action Items')
        expect(result).toContain('- [ ] Follow up with client')
        expect(result).toContain('## Transcript')
      })
    })

    describe('json export', () => {
      it('should throw error for free users', () => {
        expect(() => exportSession(mockSession, 'json')).toThrow('requires a PRO subscription')
      })

      it('should export session as JSON for pro users', () => {
        useLicenseStore.setState({ currentLicense: PRO_LICENSE })
        const result = exportSession(mockSession, 'json')

        const parsed = JSON.parse(result)
        expect(parsed.id).toBe('test-session-1')
        expect(parsed.title).toBe('Test Session')
        expect(parsed.transcript).toBe('Hello, this is a test transcript.')
        expect(parsed.actionItems).toHaveLength(2)
      })

      it('should respect export options for JSON', () => {
        useLicenseStore.setState({ currentLicense: PRO_LICENSE })
        const result = exportSession(mockSession, 'json', {
          includeTranscript: false,
        })

        const parsed = JSON.parse(result)
        expect(parsed.transcript).toBeUndefined()
        expect(parsed.entries).toBeUndefined()
      })
    })
  })

  describe('exportMultipleSessions', () => {
    const sessions: Session[] = [
      mockSession,
      {
        ...mockSession,
        id: 'test-session-2',
        title: 'Second Session',
      },
    ]

    it('should export multiple sessions as plaintext', () => {
      const result = exportMultipleSessions(sessions, 'plaintext')

      expect(result).toContain('Test Session')
      expect(result).toContain('Second Session')
      expect(result).toContain('===')
    })

    it('should export multiple sessions as markdown for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      const result = exportMultipleSessions(sessions, 'markdown')

      expect(result).toContain('# Test Session')
      expect(result).toContain('# Second Session')
      expect(result).toContain('---')
    })

    it('should export multiple sessions as JSON for pro users', () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      const result = exportMultipleSessions(sessions, 'json')

      const parsed = JSON.parse(result)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
    })
  })

  describe('copySessionToClipboard', () => {
    it('should copy session to clipboard', async () => {
      const result = await copySessionToClipboard(mockSession)

      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    it('should copy in specified format', async () => {
      useLicenseStore.setState({ currentLicense: PRO_LICENSE })
      await copySessionToClipboard(mockSession, 'markdown')

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('# Test Session')
      )
    })
  })
})
