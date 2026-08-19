import { describe, expect, it } from 'vitest'
import { CLIENT_VISUAL_FIELDS, grade, leakedAnswers, leaksOrder, toClient } from '@tya/schema'
import { FIXTURES } from '../src/fixtures/index.js'

/**
 * visual-system-spec.md §1.2 and §10.
 *
 * A learner opening dev tools must not be able to see the answer. This
 * is the test that keeps every mastery number meaningful.
 */

const assessable = FIXTURES.filter((f) => f.modes_supported.includes('assess'))

describe('the answer boundary', () => {
  it('has assessable fixtures to check', () => {
    expect(assessable.length).toBeGreaterThan(0)
  })

  for (const spec of assessable) {
    describe(`${spec.type} (${spec.id})`, () => {
      const client = toClient(spec, 'assess')
      const json = JSON.stringify(client)

      it('serializes only allowlisted fields', () => {
        for (const key of Object.keys(client)) {
          expect(CLIENT_VISUAL_FIELDS as readonly string[]).toContain(key)
        }
      })

      it('puts no answer in the payload, caption or text equivalent', () => {
        // The bank is exempt: it has to hold the correct labels or the
        // task cannot be answered. Everywhere else is a leak.
        expect(leakedAnswers(spec, client)).toEqual([])
      })

      it('does not ship the correct order for an ordering task', () => {
        expect(leaksOrder(spec, client)).toBe(false)
      })

      it('never carries an answer_key field under any name', () => {
        expect(json).not.toContain('answer_key')
        expect(json).not.toContain('misconception')
        expect(json).not.toContain('correct_feedback')
      })
    })
  }

  it('teach mode keeps the labels the learner is meant to read', () => {
    const matrix = FIXTURES.find((f) => f.id === 'vis_matrix_policy')!
    expect(JSON.stringify(toClient(matrix, 'teach'))).toContain('Central bank')
  })

  it('assess mode blanks them everywhere but the bank', () => {
    const matrix = FIXTURES.find((f) => f.id === 'vis_matrix_policy')!
    const client = toClient(matrix, 'assess')
    expect(JSON.stringify(client.payload)).not.toContain('Central bank')
    expect(client.text_equivalent).not.toContain('central bank')
    expect(client.assess_bank).toContain('Central bank')
  })
})

describe('the shuffle is deterministic', () => {
  const flow = FIXTURES.find((f) => f.id === 'vis_flow_sql')!

  it('produces the same arrangement every time', () => {
    const a = JSON.stringify(toClient(flow, 'assess').payload)
    const b = JSON.stringify(toClient(flow, 'assess').payload)
    expect(a).toBe(b)
  })

  it('still grades the learner-visible arrangement correctly', () => {
    // A learner who submits the shuffled order as shown is wrong; one who
    // submits the true order is right, whatever the shuffle was.
    expect(grade(flow, { kind: 'order', order: ['s1', 's2', 's3', 's4', 's5', 's6'] }).correct).toBe(true)
    expect(grade(flow, { kind: 'order', order: ['s2', 's1', 's3', 's4', 's5', 's6'] }).correct).toBe(false)
  })
})
