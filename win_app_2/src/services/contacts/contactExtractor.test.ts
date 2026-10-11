import { describe, it, expect } from 'vitest'
import { parseExtractionResponse } from './contactExtractor'

describe('parseExtractionResponse', () => {
  it('returns a single contact with cleaned fields and notes', () => {
    const raw = `\`\`\`json
{"firstName":" Marie ","lastName":"Durand","email":"marie@acme.fr","company":"Acme","role":"null","confidence":0.85,"suggestedNotes":["Intéressée par l'offre Pro"," ","Rappeler lundi"]}
\`\`\``
    expect(parseExtractionResponse(raw)).toEqual({
      firstName: 'Marie',
      lastName: 'Durand',
      email: 'marie@acme.fr',
      company: 'Acme',
      role: undefined,
      confidence: 0.85,
      suggestedNotes: ["Intéressée par l'offre Pro", 'Rappeler lundi'],
    })
  })

  it('rejects results below the 0.7 confidence threshold', () => {
    expect(parseExtractionResponse('{"firstName":"John","confidence":0.6,"suggestedNotes":[]}')).toBeNull()
    expect(parseExtractionResponse('{"firstName":"John","confidence":0.7,"suggestedNotes":[]}')).not.toBeNull()
  })

  it('rejects missing first name, invalid JSON and arrays', () => {
    expect(parseExtractionResponse('{"firstName":null,"confidence":0.9}')).toBeNull()
    expect(parseExtractionResponse('not json at all')).toBeNull()
    expect(parseExtractionResponse('[{"firstName":"A","confidence":0.9}]')).toBeNull()
  })

  it('tolerates prose around the object and drops malformed emails', () => {
    const raw = 'Here is the result: {"firstName":"Li","email":"not-an-email","confidence":0.9} Done.'
    const out = parseExtractionResponse(raw)
    expect(out?.firstName).toBe('Li')
    expect(out?.email).toBeUndefined()
  })
})
