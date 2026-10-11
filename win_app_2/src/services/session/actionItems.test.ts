import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/proxy/proxyApiClient', () => ({ generateAIResponse: vi.fn() }))

import { parseActionItems, buildActionItemsPrompt } from './actionItems'

describe('parseActionItems', () => {
  it('parses a JSON array', () => {
    expect(parseActionItems('["Send the deck", "Book a follow-up"]')).toEqual(['Send the deck', 'Book a follow-up'])
  })

  it('parses JSON wrapped in a code fence and ignores non-strings', () => {
    expect(parseActionItems('```json\n["A", 2, " B "]\n```')).toEqual(['A', 'B'])
  })

  it('falls back to bullet lists and caps the count', () => {
    const bullets = Array.from({ length: 12 }, (_, i) => `- item number ${i}`).join('\n')
    const items = parseActionItems(`Here you go:\n${bullets}`)
    expect(items.length).toBe(8)
    expect(items[0]).toBe('item number 0')
  })

  it('returns [] for empty / "[]" / garbage', () => {
    expect(parseActionItems('')).toEqual([])
    expect(parseActionItems('[]')).toEqual([])
    expect(parseActionItems('ok')).toEqual([])
  })

  it('builds a prompt that keeps the transcript language and asks for JSON only', () => {
    const [system, user] = buildActionItemsPrompt('Moi: on envoie le devis demain')
    expect(system.content).toContain('JSON array')
    expect(user.content).toContain('devis')
  })
})
