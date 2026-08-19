import { describe, expect, it } from 'vitest'
import { grade } from '@tya/schema'
import { fiscalVsMonetary, haitianRevolution, opportunityCost } from '../src/fixtures/index.js'

describe('slot grading', () => {
  it('accepts the correct arrangement and returns the specific feedback', () => {
    const r = grade(fiscalVsMonetary, {
      kind: 'slots',
      slots: { '0-1': 'Central bank', '1-0': 'Taxes and spending', '2-1': 'Weeks to months' },
    })
    expect(r.correct).toBe(true)
    expect(r.feedback).toContain('The actor is what separates these two')
    expect(r.per_element).toEqual({ '0-1': 'correct', '1-0': 'correct', '2-1': 'correct' })
  })

  it('returns the misconception tied to the specific wrong chip, never a bare "incorrect"', () => {
    const r = grade(fiscalVsMonetary, {
      kind: 'slots',
      slots: { '0-1': 'Treasury department', '1-0': 'Taxes and spending', '2-1': 'Weeks to months' },
    })
    expect(r.correct).toBe(false)
    expect(r.feedback).toContain('The Treasury executes fiscal policy')
    expect(r.per_element['0-1']).toBe('incorrect')
    expect(r.per_element['1-0']).toBe('correct')
  })

  it('marks an empty slot missing rather than incorrect', () => {
    const r = grade(opportunityCost, { kind: 'slots', slots: { n3: 'Opportunity cost' } })
    expect(r.per_element).toEqual({ n3: 'correct', n4: 'missing' })
    expect(r.correct).toBe(false)
  })
})

describe('order grading', () => {
  it('accepts the true chronology', () => {
    const r = grade(haitianRevolution, { kind: 'order', order: ['e1', 'e2', 'e3', 'e4', 'e5'] })
    expect(r.correct).toBe(true)
  })

  it('names the first pair the learner has out of sequence', () => {
    const r = grade(haitianRevolution, { kind: 'order', order: ['e1', 'e3', 'e2', 'e4', 'e5'] })
    expect(r.correct).toBe(false)
    expect(r.feedback).toContain('France abolishes slavery')
    expect(r.feedback).toContain('Louverture governs the colony')
  })

  it('rejects a response of the wrong shape without throwing', () => {
    const r = grade(haitianRevolution, { kind: 'slots', slots: {} })
    expect(r.correct).toBe(false)
  })
})
