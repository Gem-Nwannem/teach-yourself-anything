import { type Issue, type ValidationResult, type VisualSpec, ok } from './base.js'
import { componentFor } from './components/index.js'
import { type Dataset, checkQuantChartData, type QuantChartPayload } from './components/quant-chart.js'
import { issue } from './registry.js'
import { redactAnswers } from './serialize.js'

/**
 * Universal validation, visual-system-spec.md §8.
 *
 * Rules U1-U8 live here. U9 (deterministic layout produces no overlap
 * and no overflow at 320px) needs a layout function and lives in
 * @tya/renderers, which composes the two.
 *
 * The same code runs server-side before publish and in the client
 * renderer as a defensive check, per §8.
 */

export interface ValidationContext {
  /** Claims the spec may cite, keyed by claim id. Enables rule U5. */
  claims?: Map<string, { statement: string; span_quote: string }>
  /** Datasets the spec may bind, keyed by dataset id. Enables the quant_chart data rules. */
  datasets?: Map<string, Dataset>
}

/**
 * Relational verb stems for rule U3. A text equivalent must describe
 * relationships — "reserve requirements constrain lending capacity" —
 * not appearance. Matched as stem plus an optional inflection so one
 * entry covers condense/condenses/condensed/condensing.
 */
const RELATIONAL_STEMS = [
  'caus', 'requir', 'creat', 'produc', 'preced', 'follow', 'enabl', 'prevent', 'constrain',
  'contain', 'increas', 'decreas', 'lead', 'result', 'depend', 'driv', 'trigger', 'prompt',
  'separat', 'distinguish', 'convert', 'transform', 'feed', 'pass', 'mov', 'affect', 'influenc',
  'allow', 'forc', 'act', 'fall', 'ris', 'enter', 'exit', 'condens', 'align', 'dissolv', 'reform',
  'determin', 'measur', 'clear', 'abolish', 'restor', 'generat', 'consist', 'compris', 'includ',
  'exclud', 'replac', 'reduc', 'expand', 'connect', 'link', 'bind', 'flow', 'becom', 'turn',
  'shift', 'form', 'emerg', 'deriv', 'stem', 'aris', 'support', 'oppos', 'contrast', 'differ',
  'exceed', 'offset', 'cancel', 'split', 'merg', 'set', 'pars', 'plan', 'assembl', 'govern',
  'attempt', 'pump', 'receiv', 'deliv', 'return', 'sort', 'rank', 'apply', 'appli', 'answer',
]

const INFLECTION = '(?:e|es|s|ed|d|ing)?'

export function hasRelationalVerb(text: string): boolean {
  const lower = text.toLowerCase()
  return RELATIONAL_STEMS.some((stem) => new RegExp(`\\b${stem}${INFLECTION}\\b`).test(lower))
}

/**
 * Label kinds that must trace to a claim under rule U5.
 *
 * Structural scaffolding — a matrix row header such as "Who decides",
 * an axis title, a yes/no branch condition — carries no factual claim
 * and is excluded.
 */
const SUBSTANTIVE_KINDS = new Set(['node', 'step', 'cell', 'event', 'region', 'stage', 'period'])

const STOPWORDS = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'into', 'over', 'their', 'they'])

/** Content words of a label, long enough to be worth tracing. */
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

/**
 * A label traces to evidence when every content word in it appears in
 * the cited claims. Substring matching absorbs ordinary inflection —
 * "parse" finds "parses", "chromosome" finds "chromosomes" — and a
 * singular fallback catches the other direction.
 */
export function labelTracesToClaims(text: string, corpus: string): boolean {
  const words = contentWords(text)
  if (words.length === 0) return true
  return words.every((w) => corpus.includes(w) || (w.endsWith('s') && corpus.includes(w.slice(0, -1))))
}

export function validateVisual(spec: VisualSpec, ctx: ValidationContext = {}): ValidationResult {
  const issues: Issue[] = []
  const def = componentFor(spec.type)

  // U1 — schema valid against the component's payload schema.
  const parsed = def.payload.safeParse(spec.payload)
  if (!parsed.success) {
    for (const e of parsed.error.errors) {
      issues.push(issue('U1.schema', e.message, e.path.join('.')))
    }
    // Every later rule reads the payload; without a valid one they would
    // report noise. Fail here.
    return ok(issues)
  }
  const payload = parsed.data

  // U2 — element counts within cap.
  issues.push(...def.checkCaps(payload))

  // U3 — the text equivalent.
  const te = spec.text_equivalent.trim()
  if (te.length === 0) issues.push(issue('U3.text_equivalent', 'text_equivalent is empty', 'text_equivalent'))
  else if (te.length < 20) {
    issues.push(issue('U3.text_equivalent', `text_equivalent is ${te.length} characters, minimum is 20`, 'text_equivalent'))
  }
  if (te.toLowerCase() === spec.caption.trim().toLowerCase()) {
    issues.push(issue('U3.text_equivalent', 'text_equivalent duplicates the caption', 'text_equivalent'))
  }
  if (te.length > 0 && !hasRelationalVerb(te)) {
    issues.push(issue('U3.relational', 'text_equivalent contains no relational verb; it describes appearance, not relationships', 'text_equivalent'))
  }

  // U4 — label length.
  const labels = def.labels(payload)
  for (const label of labels) {
    const limit = def.labelLimits[label.kind]
    if (limit !== undefined && label.text.length > limit) {
      issues.push(issue('U4.label_length',
        `${label.kind} label is ${label.text.length} characters, limit is ${limit}: "${label.text}"`, label.id))
    }
  }

  // U5 — every label traces to a claim that resolves to a source span.
  if (spec.claim_refs.length === 0) {
    issues.push(issue('U5.claim_refs', 'a visual with no claim_refs cannot be traced to evidence', 'claim_refs'))
  } else if (ctx.claims) {
    const corpus = spec.claim_refs
      .map((id) => ctx.claims!.get(id))
      .filter((c): c is { statement: string; span_quote: string } => Boolean(c))
      .map((c) => `${c.statement} ${c.span_quote}`.toLowerCase())
    for (const id of spec.claim_refs) {
      if (!ctx.claims.has(id)) issues.push(issue('U5.claim_refs', `claim "${id}" does not resolve`, 'claim_refs'))
    }
    const joined = corpus.join(' ')
    for (const label of labels) {
      if (!SUBSTANTIVE_KINDS.has(label.kind)) continue
      if (label.text.trim().length < 3) continue
      if (!labelTracesToClaims(label.text, joined)) {
        issues.push(issue('U5.label_trace', `label "${label.text}" appears in no cited claim`, label.id))
      }
    }
  }

  // Assess-block rules, including U6 (answer leak) and U7 (answer key present).
  if (spec.modes_supported.includes('assess')) {
    if (!spec.assess) {
      issues.push(issue('U7.answer_key', 'assess is a supported mode but the spec carries no assess block', 'assess'))
    } else {
      issues.push(...validateAssess(spec, def, payload))
    }
  }

  // Per-component rules from §3.
  issues.push(...def.checkRules(payload))

  if (spec.type === 'quant_chart') {
    issues.push(...checkQuantChartData(payload as QuantChartPayload, ctx.datasets ?? new Map()))
  }

  return ok(issues)
}

function validateAssess(
  spec: VisualSpec,
  def: ReturnType<typeof componentFor>,
  payload: unknown,
): Issue[] {
  const issues: Issue[] = []
  const assess = spec.assess!

  if (!def.tasks.includes(assess.task)) {
    issues.push(issue('assess.task', `"${assess.task}" is not a task of ${spec.type}`, 'assess.task'))
  }

  const isOrder = def.orderTasks.includes(assess.task)
  const slots = new Set(def.slotIds(payload))
  for (const id of assess.removed) {
    if (!slots.has(id)) {
      issues.push(issue('assess.removed', `"${id}" is not a removable element of this payload`, 'assess.removed'))
    }
  }

  // U7 — the answer key is present and has the shape the task implies.
  if (isOrder) {
    if (assess.answer_key.kind !== 'order') {
      issues.push(issue('U7.answer_key', `task "${assess.task}" needs an order answer key`, 'assess.answer_key'))
    } else {
      const expected = def.ordering(payload)
      const key = assess.answer_key.order
      if (key.length !== expected.length || !key.every((id) => expected.includes(id))) {
        issues.push(issue('U7.answer_key', 'the answer key does not cover exactly the elements in the payload', 'assess.answer_key'))
      }
    }
    if (assess.removed.length > 0) {
      issues.push(issue('assess.removed', 'an ordering task removes nothing; the order is the answer', 'assess.removed'))
    }
  } else {
    if (assess.answer_key.kind !== 'slots') {
      issues.push(issue('U7.answer_key', `task "${assess.task}" needs a slots answer key`, 'assess.answer_key'))
    } else {
      const answered = Object.keys(assess.answer_key.slots)
      for (const id of assess.removed) {
        if (!answered.includes(id)) {
          issues.push(issue('U7.answer_key', `removed element "${id}" has no answer`, 'assess.answer_key'))
        }
      }
      for (const id of answered) {
        if (!assess.removed.includes(id)) {
          issues.push(issue('U7.answer_key', `answer key covers "${id}", which is not removed`, 'assess.answer_key'))
        }
      }
      // Every answer must be offered in the bank, or the task is unanswerable.
      for (const [id, want] of Object.entries(assess.answer_key.slots)) {
        if (!assess.bank.includes(want)) {
          issues.push(issue('assess.bank', `the answer for "${id}" is not in the bank`, 'assess.bank'))
        }
      }
      // U6 — the answer leak check. No bank label may also be visible.
      const answers = new Set(Object.values(assess.answer_key.slots))
      const stripped = def.strip(payload, assess.removed)
      const visible = new Set(
        def.labels(stripped).map((l) => l.text.trim().toLowerCase()).filter((t) => t.length > 0),
      )
      for (const chip of assess.bank) {
        const key = chip.trim().toLowerCase()
        if (visible.has(key)) {
          issues.push(issue('U6.answer_leak',
            `bank label "${chip}" is also visible in the diagram; it either gives the answer away or is an unusable distractor`,
            'assess.bank'))
        }
        // §4.1 — every distractor carries a misconception used verbatim.
        if (!answers.has(chip) && !assess.misconceptions[chip]) {
          issues.push(issue('assess.misconception',
            `distractor "${chip}" has no misconception string; §4.1 forbids a bare "incorrect"`, 'assess.misconceptions'))
        }
      }
    }
  }

  if (!assess.correct_feedback.trim()) {
    issues.push(issue('assess.feedback', 'correct_feedback is empty', 'assess.correct_feedback'))
  }

  // The text equivalent is served redacted in assess mode (see
  // serialize.ts). What survives still has to be a usable alternative,
  // or a learner on a screen reader is handed a worse task than
  // everyone else.
  const redacted = redactAnswers(spec.text_equivalent, spec)
  if (redacted !== spec.text_equivalent) {
    const survives = redacted.trim()
    if (survives.length < 20 || !hasRelationalVerb(survives)) {
      issues.push(issue('U3.assess_text_equivalent',
        'redacting the answers leaves no usable text equivalent for assess mode; rewrite it so the relationships survive without naming the removed elements',
        'text_equivalent'))
    }
    const lost = 1 - survives.length / spec.text_equivalent.trim().length
    if (lost > 0.35) {
      issues.push(issue('U3.assess_text_equivalent',
        `redaction removes ${Math.round(lost * 100)}% of the text equivalent`, 'text_equivalent'))
    }
  }
  return issues
}
