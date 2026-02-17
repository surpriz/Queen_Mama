import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectMoments,
  getMomentLabel,
  getMomentSuggestions,
  getMomentPriority,
  sortMomentsByImportance,
  processTranscriptForMoments,
  clearMomentState,
  type DetectedMoment,
} from './momentDetectionService'

beforeEach(() => {
  clearMomentState()
})

describe('momentDetectionService', () => {
  describe('detectMoments', () => {
    describe('objection detection', () => {
      it('should detect "too expensive" objection in English', () => {
        const moments = detectMoments('I think this is too expensive for our needs')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'objection')).toBe(true)
      })

      it('should detect "trop cher" objection in French', () => {
        const moments = detectMoments("Franchement, c'est trop cher pour nous")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'objection')).toBe(true)
      })

      it('should detect "not in budget" objection', () => {
        const moments = detectMoments("That's not in our budget right now")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'objection')).toBe(true)
      })

      it('should detect "let me think about" objection', () => {
        const moments = detectMoments('Let me think about this and get back to you')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'objection')).toBe(true)
      })
    })

    describe('expertise question detection', () => {
      it('should detect "how does it work" question', () => {
        const moments = detectMoments('How does this work exactly?')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'expertiseQuestion')).toBe(true)
      })

      it('should detect "comment ça marche" question', () => {
        const moments = detectMoments('Comment ça marche votre solution?')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'expertiseQuestion')).toBe(true)
      })

      it('should detect "what technology" question', () => {
        const moments = detectMoments('What technology do you use for this?')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'expertiseQuestion')).toBe(true)
      })
    })

    describe('hesitation detection', () => {
      it('should detect "I am not sure" hesitation', () => {
        const moments = detectMoments("I'm not sure about this approach")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'hesitation')).toBe(true)
      })

      it('should detect "je ne sais pas" hesitation', () => {
        const moments = detectMoments('Je ne sais pas si ça correspond à nos besoins')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'hesitation')).toBe(true)
      })

      it('should detect "that is a good question" hesitation', () => {
        const moments = detectMoments("That's a good question, let me think")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'hesitation')).toBe(true)
      })
    })

    describe('closing opportunity detection', () => {
      it('should detect "I am interested" opportunity', () => {
        const moments = detectMoments("I'm interested in learning more about this")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'closingOpportunity')).toBe(true)
      })

      it('should detect "what are the next steps" opportunity', () => {
        const moments = detectMoments('What are the next steps to get started?')

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'closingOpportunity')).toBe(true)
      })

      it('should detect "sounds good" opportunity', () => {
        const moments = detectMoments("That sounds good, let's do it")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'closingOpportunity')).toBe(true)
      })

      it('should detect "ça m\'intéresse" opportunity', () => {
        const moments = detectMoments("Ça m'intéresse beaucoup votre solution")

        expect(moments.length).toBeGreaterThan(0)
        expect(moments.some((m) => m.type === 'closingOpportunity')).toBe(true)
      })
    })

    it('should return empty array for neutral text', () => {
      const moments = detectMoments('The weather is nice today')

      expect(moments).toHaveLength(0)
    })

    it('should include trigger phrase in detected moment', () => {
      const moments = detectMoments('This is too expensive for us')

      expect(moments.length).toBeGreaterThan(0)
      const objection = moments.find((m) => m.type === 'objection')
      expect(objection?.triggerPhrase).toBeTruthy()
    })

    it('should include context around trigger phrase', () => {
      const moments = detectMoments('Before the meeting, they said it is too expensive for their team')

      expect(moments.length).toBeGreaterThan(0)
      const objection = moments.find((m) => m.type === 'objection')
      expect(objection?.context).toContain('too expensive')
    })
  })

  describe('getMomentLabel', () => {
    it('should return correct label for objection', () => {
      expect(getMomentLabel('objection')).toBe('Objection detected')
    })

    it('should return correct label for expertiseQuestion', () => {
      expect(getMomentLabel('expertiseQuestion')).toBe('Technical question')
    })

    it('should return correct label for hesitation', () => {
      expect(getMomentLabel('hesitation')).toBe('Hesitation detected')
    })

    it('should return correct label for closingOpportunity', () => {
      expect(getMomentLabel('closingOpportunity')).toBe('Closing opportunity')
    })
  })

  describe('getMomentSuggestions', () => {
    it('should return suggestions for objection', () => {
      const suggestions = getMomentSuggestions('objection')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some((s) => s.includes('concern'))).toBe(true)
    })

    it('should return suggestions for closingOpportunity', () => {
      const suggestions = getMomentSuggestions('closingOpportunity')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some((s) => s.includes('next steps'))).toBe(true)
    })
  })

  describe('getMomentPriority', () => {
    it('should give highest priority to closing opportunity', () => {
      expect(getMomentPriority('closingOpportunity')).toBe(4)
    })

    it('should give second priority to objection', () => {
      expect(getMomentPriority('objection')).toBe(3)
    })

    it('should give lowest priority to hesitation', () => {
      expect(getMomentPriority('hesitation')).toBe(1)
    })
  })

  describe('sortMomentsByImportance', () => {
    it('should sort by priority first', () => {
      const moments: DetectedMoment[] = [
        { type: 'hesitation', confidence: 0.9, triggerPhrase: '', context: '', timestamp: 0 },
        { type: 'closingOpportunity', confidence: 0.5, triggerPhrase: '', context: '', timestamp: 0 },
        { type: 'objection', confidence: 0.7, triggerPhrase: '', context: '', timestamp: 0 },
      ]

      const sorted = sortMomentsByImportance(moments)

      expect(sorted[0].type).toBe('closingOpportunity')
      expect(sorted[1].type).toBe('objection')
      expect(sorted[2].type).toBe('hesitation')
    })

    it('should sort by confidence when priority is equal', () => {
      const moments: DetectedMoment[] = [
        { type: 'objection', confidence: 0.5, triggerPhrase: '', context: '', timestamp: 0 },
        { type: 'objection', confidence: 0.9, triggerPhrase: '', context: '', timestamp: 0 },
        { type: 'objection', confidence: 0.7, triggerPhrase: '', context: '', timestamp: 0 },
      ]

      const sorted = sortMomentsByImportance(moments)

      expect(sorted[0].confidence).toBe(0.9)
      expect(sorted[1].confidence).toBe(0.7)
      expect(sorted[2].confidence).toBe(0.5)
    })
  })

  describe('processTranscriptForMoments', () => {
    it('should detect and return sorted moments', () => {
      const moments = processTranscriptForMoments("I'm interested but it's too expensive")

      expect(moments.length).toBeGreaterThan(0)
      // Should be sorted by importance
      if (moments.length > 1) {
        expect(getMomentPriority(moments[0].type)).toBeGreaterThanOrEqual(
          getMomentPriority(moments[1].type)
        )
      }
    })
  })
})
