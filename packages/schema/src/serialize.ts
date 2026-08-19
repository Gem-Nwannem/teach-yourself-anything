import { type Mode, type VisualSpec, type VisualType, seededShuffle } from './base.js'
import { componentFor } from './components/index.js'

/**
 * The answer boundary. core-technical-spec.md §4.3.
 *
 * An allowlist, not field deletion. Deletion fails open the moment
 * someone adds a column; an allowlist fails closed.
 */
export const CLIENT_VISUAL_FIELDS = [
  'id', 'type', 'payload', 'caption', 'text_equivalent', 'assess_task', 'assess_bank', 'mode',
] as const

export interface ClientVisual {
  id: string
  type: VisualType
  payload: unknown
  caption: string
  text_equivalent: string
  mode: Mode
  assess_task?: string
  assess_bank?: string[]
}

/**
 * Produce the payload a client may see.
 *
 * In `assess` mode two things are removed, not one:
 *
 *  - slot tasks have their removed elements blanked, and
 *  - ordering tasks have their elements re-emitted in a seeded shuffle,
 *    because for those tasks the array order *is* the answer.
 *
 * The shuffle is seeded by the spec id so a retry, a refresh, and a
 * second device all present the same arrangement, and so layout stays a
 * pure function of (spec, width).
 */
export function toClient(spec: VisualSpec, mode: Mode): ClientVisual {
  const def = componentFor(spec.type)
  let payload = spec.payload
  let textEquivalent = spec.text_equivalent

  if (mode === 'assess' && spec.assess) {
    const { task, removed } = spec.assess
    if (def.orderTasks.includes(task)) {
      const shuffled = seededShuffle(def.ordering(payload), spec.id)
      payload = def.reorder(payload, shuffled)
    } else {
      payload = def.strip(payload, removed)
    }
    textEquivalent = redactAnswers(textEquivalent, spec)
  }

  const out: ClientVisual = {
    id: spec.id,
    type: spec.type,
    payload,
    caption: spec.caption,
    text_equivalent: textEquivalent,
    mode,
  }
  if (mode === 'assess' && spec.assess) {
    out.assess_task = spec.assess.task
    if (spec.assess.bank.length > 0) out.assess_bank = spec.assess.bank
  }
  return out
}

/** What a redacted answer reads as, to a screen reader and on the page. */
export const REDACTION = 'blank'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Remove the answers from the text equivalent.
 *
 * §1.4 requires a text equivalent on every visual and §9 requires it in
 * the DOM always. §8 rule 6 requires that no answer reach the client in
 * assess mode. Those two collide head-on: a relationship-bearing
 * alternative to "label the ventricles" names the ventricles.
 *
 * Dropping the field would leave a screen-reader user with nothing to
 * work from, so instead the answers are replaced in place. The prose
 * keeps its relationships — "passes to the blank and out to the lungs" —
 * and a learner using assistive technology gets the same task everyone
 * else gets, not a harder one and not an easier one.
 */
export function redactAnswers(text: string, spec: VisualSpec): string {
  const key = spec.assess?.answer_key
  if (!key || key.kind !== 'slots') return text
  // Longest first, so "Right ventricle" is consumed before "ventricle".
  const answers = [...new Set(Object.values(key.slots))].sort((a, b) => b.length - a.length)
  let out = text
  for (const answer of answers) {
    out = out.replace(new RegExp(escapeRe(answer), 'gi'), REDACTION)
  }
  return out
}

/**
 * Every string an assess payload must not contain.
 *
 * Element ids are excluded deliberately: for an ordering task the ids
 * legitimately appear in the payload and the answer is their *sequence*,
 * which `leaksOrder` checks instead.
 */
export function forbiddenStrings(spec: VisualSpec): string[] {
  if (!spec.assess) return []
  const key = spec.assess.answer_key
  const answers = key.kind === 'slots' ? Object.values(key.slots) : []
  return [...answers, ...Object.values(spec.assess.misconceptions), spec.assess.correct_feedback]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Answer strings that reached the client somewhere they should not have.
 *
 * The bank is excluded by design: it must hold the correct labels or the
 * task is unanswerable. What must not happen is an answer appearing in
 * the payload, the caption, or the text equivalent, where it says not
 * just *what* the answers are but *where* each one goes.
 */
export function leakedAnswers(spec: VisualSpec, client: ClientVisual): string[] {
  const { assess_bank: _bank, ...rest } = client
  const surface = JSON.stringify(rest).toLowerCase()
  return forbiddenStrings(spec).filter((s) => surface.includes(s.toLowerCase()))
}

/** True when an ordering task would ship its own answer as the array order. */
export function leaksOrder(spec: VisualSpec, client: ClientVisual): boolean {
  if (!spec.assess || spec.assess.answer_key.kind !== 'order') return false
  const def = componentFor(spec.type)
  if (!def.orderTasks.includes(spec.assess.task)) return false
  const emitted = def.ordering(client.payload)
  const answer = spec.assess.answer_key.order
  return emitted.length === answer.length && emitted.every((id, i) => id === answer[i])
}
