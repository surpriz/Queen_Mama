import { describe, it, expect } from 'vitest'
import { stripPredictionBullets, isRefusalResponse } from './responsePostProcess'

describe('stripPredictionBullets', () => {
  it('removes prediction bullets anywhere in the list', () => {
    const input = [
      '- Reformule son objection sur le prix',
      '- Il va probablement demander une remise',
      '- Propose un essai de 14 jours',
      '- The next question will be about security',
    ].join('\n')
    expect(stripPredictionBullets(input)).toBe(
      ['- Reformule son objection sur le prix', '- Propose un essai de 14 jours'].join('\n'),
    )
  })

  it('leaves single-line and prediction-free text untouched', () => {
    expect(stripPredictionBullets('Il va probablement pleuvoir')).toBe('Il va probablement pleuvoir')
    const clean = '- Point A\n- Point B'
    expect(stripPredictionBullets(clean)).toBe(clean)
  })
})

describe('isRefusalResponse', () => {
  it('flags short refusals only', () => {
    expect(isRefusalResponse("I'm sorry, I can't help with that request.")).toBe(true)
    expect(isRefusalResponse("I'm sorry, I can't help with that, but here is a long explanation ".repeat(3))).toBe(false)
    expect(isRefusalResponse('Sure, here are three points.')).toBe(false)
  })
})
