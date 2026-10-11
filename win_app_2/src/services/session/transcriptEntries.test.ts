import { describe, it, expect, vi } from 'vitest'

vi.mock('@/db/client', () => ({ db: { queryAll: vi.fn().mockResolvedValue([]) } }))

import { parseTranscriptLines, entriesToLines, sessionLines, speakerKind } from './transcriptEntries'

describe('transcriptEntries', () => {
  it('parses labelled transcript text into speaker lines and keeps plain text', () => {
    const lines = parseTranscriptLines('Moi: bonjour\nInterlocuteur: hello\n\nnote without label')
    expect(lines).toEqual([
      { speaker: 'me', text: 'bonjour' },
      { speaker: 'them', text: 'hello' },
      { speaker: null, text: 'note without label' },
    ])
  })

  it('maps speaker labels case-insensitively', () => {
    expect(speakerKind('MOI')).toBe('me')
    expect(speakerKind('Interlocuteur')).toBe('them')
    expect(speakerKind('Someone')).toBeNull()
  })

  it('prefers persisted entries (with translations) over the text fallback', () => {
    const entries = [
      { id: '1', sessionId: 's', timestamp: 't1', speaker: 'Interlocuteur', text: 'hello', isFinal: true, translatedText: 'bonjour' },
      { id: '2', sessionId: 's', timestamp: 't2', speaker: 'Moi', text: '', isFinal: true },
      { id: '3', sessionId: 's', timestamp: 't3', speaker: 'Moi', text: 'interim', isFinal: false },
    ]
    expect(entriesToLines(entries)).toEqual([{ speaker: 'them', text: 'hello', timestamp: 't1', translatedText: 'bonjour' }])
    expect(sessionLines('Moi: fallback', entries)[0].text).toBe('hello')
    expect(sessionLines('Moi: fallback', [])[0]).toEqual({ speaker: 'me', text: 'fallback' })
  })
})
