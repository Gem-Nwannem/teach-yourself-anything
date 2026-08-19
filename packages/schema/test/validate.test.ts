import { describe, expect, it } from 'vitest'
import {
  type VisualSpec,
  validateVisual,
  hasRelationalVerb,
  checkPaletteContrast,
} from '@tya/schema'
import { CLAIM_INDEX, DATASET_INDEX, FIXTURES, opportunityCost, sqlQueryFlow, mitosis, heartChambers }
  from '../src/fixtures/index.js'

const ctx = { claims: CLAIM_INDEX, datasets: DATASET_INDEX }

/** Structured clone that keeps the VisualSpec type. */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe('the golden fixtures', () => {
  for (const spec of FIXTURES) {
    it(`${spec.type} (${spec.id}) passes every universal rule`, () => {
      const result = validateVisual(spec, ctx)
      expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([])
      expect(result.ok).toBe(true)
    })
  }

  it('covers all eight component types exactly once', () => {
    expect(new Set(FIXTURES.map((f) => f.type)).size).toBe(8)
  })
})

describe('U3 text equivalent', () => {
  it('accepts prose that names a relationship', () => {
    expect(hasRelationalVerb('Reserve requirements constrain lending capacity')).toBe(true)
    expect(hasRelationalVerb('Chromosomes condense during prophase')).toBe(true)
  })

  it('rejects prose that describes appearance', () => {
    expect(hasRelationalVerb('a diagram with three blue boxes and an arrow')).toBe(false)
  })

  it('flags a text equivalent that only repeats the caption', () => {
    const spec = clone(opportunityCost)
    spec.text_equivalent = spec.caption
    const rules = validateVisual(spec, ctx).issues.map((i) => i.rule)
    expect(rules).toContain('U3.text_equivalent')
  })
})

describe('U2 caps', () => {
  it('rejects a concept map above nine nodes', () => {
    const spec = clone(opportunityCost)
    const p = spec.payload as { nodes: unknown[]; edges: { from: string; to: string }[] }
    for (let i = 6; i <= 11; i++) {
      p.nodes.push({ id: `n${i}`, label: `Filler ${i}`, role: 'example' })
      p.edges.push({ from: 'n3', to: `n${i}`, relation: 'enables' })
    }
    const rules = validateVisual(spec, ctx).issues.map((i) => i.rule)
    expect(rules).toContain('U2.cap')
  })
})

describe('U5 claim tracing', () => {
  it('rejects a label that appears in no cited claim', () => {
    const spec = clone(opportunityCost)
    const p = spec.payload as { nodes: { label: string }[] }
    p.nodes[4]!.label = 'Deadweight loss'
    const issues = validateVisual(spec, ctx).issues
    expect(issues.some((i) => i.rule === 'U5.label_trace')).toBe(true)
  })

  it('rejects a spec with no claim refs at all', () => {
    const spec = clone(opportunityCost)
    spec.claim_refs = []
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('U5.claim_refs')
  })
})

describe('U6 answer leak', () => {
  it('rejects a bank label that is also visible in the diagram', () => {
    const spec = clone(heartChambers) as VisualSpec
    // This is exactly the gallery's fixture: "Right atrium" is a
    // distractor while region r1 shows it.
    spec.assess!.bank = ['Right ventricle', 'Left ventricle', 'Right atrium', 'Vena cava']
    spec.assess!.misconceptions['Right atrium'] = 'The atria sit above the ventricles.'
    const issues = validateVisual(spec, ctx).issues
    expect(issues.some((i) => i.rule === 'U6.answer_leak')).toBe(true)
  })

  it('rejects a distractor with no misconception string', () => {
    const spec = clone(heartChambers) as VisualSpec
    spec.assess!.bank = [...spec.assess!.bank, 'Mitral valve']
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('assess.misconception')
  })

  it('rejects an answer that is missing from the bank', () => {
    const spec = clone(heartChambers) as VisualSpec
    spec.assess!.bank = spec.assess!.bank.filter((b) => b !== 'Left ventricle')
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('assess.bank')
  })
})

describe('process_flow rules', () => {
  it('rejects a decision with one outgoing transition', () => {
    const spec = clone(sqlQueryFlow)
    const p = spec.payload as { transitions: { from: string; to: string }[] }
    p.transitions = p.transitions.filter((t) => !(t.from === 's3' && t.to === 's5'))
    const rules = validateVisual(spec, ctx).issues.map((i) => i.rule)
    expect(rules).toContain('process_flow.decision_arity')
  })

  it('rejects a cycle', () => {
    const spec = clone(sqlQueryFlow)
    const p = spec.payload as { transitions: { from: string; to: string }[] }
    p.transitions.push({ from: 's6', to: 's1' })
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('process_flow.dag')
  })

  it('rejects two entry points', () => {
    const spec = clone(sqlQueryFlow)
    const p = spec.payload as {
      steps: { id: string; label: string; kind: string }[]
      transitions: { from: string; to: string }[]
    }
    p.steps.push({ id: 's7', label: 'Build a plan again', kind: 'step' })
    p.transitions.push({ from: 's7', to: 's6' })
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('process_flow.single_entry')
  })
})

describe('sequence_model rules', () => {
  it('rejects a change to an untracked property', () => {
    const spec = clone(mitosis)
    const p = spec.payload as { stages: { changed: string[] }[] }
    p.stages[0]!.changed.push('centrioles')
    expect(validateVisual(spec, ctx).issues.map((i) => i.rule)).toContain('sequence_model.changed_tracked')
  })
})

describe('quant_chart rules', () => {
  it('rejects a chart whose dataset does not resolve', () => {
    const spec = FIXTURES.find((f) => f.type === 'quant_chart')!
    const issues = validateVisual(spec, { claims: CLAIM_INDEX, datasets: new Map() }).issues
    expect(issues.map((i) => i.rule)).toContain('quant_chart.dataset_ref')
  })
})

describe('U8 palette contrast', () => {
  it('every token pairing meets its minimum in both schemes', () => {
    expect(checkPaletteContrast()).toEqual([])
  })
})
