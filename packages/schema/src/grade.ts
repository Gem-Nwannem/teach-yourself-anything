import type { Arrangement, VisualSpec } from './base.js'
import { componentFor } from './components/index.js'

/**
 * Server-side grading. The answer key never leaves this module's caller.
 *
 * Shape matches the attempt contract in core-technical-spec.md §4.2.
 */
export interface GradeResult {
  correct: boolean
  per_element: Record<string, 'correct' | 'incorrect' | 'missing'>
  /** Misconception-specific. §4.1 forbids a bare "incorrect". */
  feedback: string
}

export function grade(spec: VisualSpec, response: Arrangement): GradeResult {
  const assess = spec.assess
  if (!assess) throw new Error(`spec ${spec.id} has no assess block to grade against`)
  const key = assess.answer_key

  if (key.kind === 'order') {
    if (response.kind !== 'order') {
      return { correct: false, per_element: {}, feedback: 'That response does not match this task.' }
    }
    const per_element: GradeResult['per_element'] = {}
    for (const [i, id] of key.order.entries()) {
      per_element[id] = response.order[i] === id ? 'correct'
        : response.order.includes(id) ? 'incorrect' : 'missing'
    }
    const correct = response.order.length === key.order.length
      && key.order.every((id, i) => response.order[i] === id)
    return {
      correct,
      per_element,
      feedback: correct ? assess.correct_feedback : firstOrderHint(spec, key.order, response.order),
    }
  }

  if (response.kind !== 'slots') {
    return { correct: false, per_element: {}, feedback: 'That response does not match this task.' }
  }
  const per_element: GradeResult['per_element'] = {}
  let correct = true
  let firstWrongChip: string | null = null
  for (const [slot, want] of Object.entries(key.slots)) {
    const got = response.slots[slot]
    if (got === undefined || got.trim() === '') {
      per_element[slot] = 'missing'
      correct = false
      continue
    }
    if (got === want) {
      per_element[slot] = 'correct'
      continue
    }
    per_element[slot] = 'incorrect'
    correct = false
    if (firstWrongChip === null) firstWrongChip = got
  }
  const misconception = firstWrongChip !== null ? assess.misconceptions[firstWrongChip] : undefined
  return {
    correct,
    per_element,
    feedback: correct ? assess.correct_feedback
      : misconception ?? 'Not quite — the correct arrangement is shown below.',
  }
}

/** Name the first pair the learner has out of sequence, rather than "wrong". */
function firstOrderHint(spec: VisualSpec, want: string[], got: string[]): string {
  const def = componentFor(spec.type)
  const labels = new Map(def.labels(spec.payload).map((l) => [l.id, l.text]))
  for (let i = 0; i < want.length; i++) {
    const expected = want[i]
    if (expected === undefined || got[i] === expected) continue
    const a = labels.get(expected) ?? expected
    const b = labels.get(got[i] ?? '') ?? got[i] ?? 'nothing'
    return `Not quite — "${a}" comes before "${b}". The correct sequence is shown below.`
  }
  return 'Not quite — the correct sequence is shown below.'
}
