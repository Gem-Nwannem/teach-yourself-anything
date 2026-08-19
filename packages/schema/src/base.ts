import { z } from 'zod'

/* ------------------------------------------------------------------ *
 * Modes and types.  visual-system-spec.md §0, §2
 * ------------------------------------------------------------------ */

export const MODES = ['teach', 'practice', 'assess'] as const
export const Mode = z.enum(MODES)
export type Mode = z.infer<typeof Mode>

export const VISUAL_TYPES = [
  'concept_map', 'process_flow', 'comparison_matrix', 'timeline',
  'hierarchy', 'labeled_diagram', 'quant_chart', 'sequence_model',
] as const
export const VisualType = z.enum(VISUAL_TYPES)
export type VisualType = z.infer<typeof VisualType>

/* ------------------------------------------------------------------ *
 * Answers and arrangements.
 *
 * Two shapes cover all eight components: the learner either orders a
 * list of elements or drops labels into slots.  Both the answer key and
 * the learner's submission use the same union so grading is total.
 * ------------------------------------------------------------------ */

export const OrderArrangement = z.object({
  kind: z.literal('order'),
  order: z.array(z.string()).min(2),
})
export const SlotArrangement = z.object({
  kind: z.literal('slots'),
  slots: z.record(z.string(), z.string()),
})
export const Arrangement = z.discriminatedUnion('kind', [OrderArrangement, SlotArrangement])
export type Arrangement = z.infer<typeof Arrangement>
export type AnswerKey = Arrangement

/* ------------------------------------------------------------------ *
 * The assess block.
 *
 * `task`, and only `task`, is model-generated (§2 field ownership).
 * `removed`, `bank`, `answer_key`, `misconceptions` and
 * `correct_feedback` are computed by the pipeline.
 * ------------------------------------------------------------------ */

export const AssessBlock = z.object({
  task: z.string(),
  removed: z.array(z.string()).default([]),
  bank: z.array(z.string()).default([]),
  /** SERVER ONLY.  Never reaches a client; see serialize.ts. */
  answer_key: Arrangement,
  /** SERVER ONLY.  One entry per distractor — §4.1 forbids a bare "wrong". */
  misconceptions: z.record(z.string(), z.string()).default({}),
  /** SERVER ONLY. */
  correct_feedback: z.string().min(1),
})
export type AssessBlock = z.infer<typeof AssessBlock>

/* ------------------------------------------------------------------ *
 * The common spec envelope.  §2
 * ------------------------------------------------------------------ */

export const VisualSpecBase = z.object({
  id: z.string().min(1),
  type: VisualType,
  purpose: z.string().min(1),
  concepts: z.array(z.string()),
  claim_refs: z.array(z.string()),
  dataset_ref: z.string().nullable().default(null),
  caption: z.string().min(1),
  text_equivalent: z.string(),
  modes_supported: z.array(Mode).min(1),
  assess: AssessBlock.optional(),
  payload: z.unknown(),
})

export interface VisualSpec<P = unknown> {
  id: string
  type: VisualType
  purpose: string
  concepts: string[]
  claim_refs: string[]
  dataset_ref: string | null
  caption: string
  text_equivalent: string
  modes_supported: Mode[]
  assess?: AssessBlock
  payload: P
}

/* ------------------------------------------------------------------ *
 * Validation issues.  §8
 * ------------------------------------------------------------------ */

export interface Issue {
  /** Stable identifier, e.g. "U2.cap" or "process_flow.decision_arity". */
  rule: string
  message: string
  path?: string
}

export interface ValidationResult {
  ok: boolean
  issues: Issue[]
}

export const ok = (issues: Issue[]): ValidationResult => ({ ok: issues.length === 0, issues })

/* ------------------------------------------------------------------ *
 * Labels.
 *
 * Every component can enumerate its labels with the element id that
 * owns them.  Rules U4 (length), U5 (claim tracing) and U6 (answer
 * leak) are then written once rather than eight times.
 * ------------------------------------------------------------------ */

export interface Label {
  /** Element id, or a synthetic slot key such as "1-0" for a matrix cell. */
  id: string
  text: string
  /** Which label limit applies, e.g. "node", "cell", "when". */
  kind: string
}

/* ------------------------------------------------------------------ *
 * Deterministic shuffle.
 *
 * Order tasks have no `removed` set — the answer is the payload's own
 * array order.  The server therefore emits a shuffled order, seeded by
 * the spec id so the same learner sees the same arrangement on retry
 * and on a second device.  Layout stays a pure function of (spec,width)
 * because the shuffle happens before the spec reaches the renderer.
 * ------------------------------------------------------------------ */

function hash32(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates with a seeded PRNG.  Guaranteed not to return the input order. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  if (items.length < 2) return [...items]
  const rand = mulberry32(hash32(seed))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = out[i] as T
    const b = out[j] as T
    out[i] = b
    out[j] = a
  }
  const unchanged = out.every((x, i) => x === items[i])
  if (unchanged) {
    // Rotate by one.  An identity shuffle would ship the answer.
    const first = out.shift() as T
    out.push(first)
  }
  return out
}
