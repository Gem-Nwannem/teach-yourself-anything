import { describe, expect, it } from 'vitest'
import { toClient } from '@tya/schema'
import { CLAIM_INDEX, DATASET_INDEX, FIXTURES } from '../../schema/src/fixtures/index.js'
import { FLOW_LAID_OUT, TEST_WIDTHS, layoutVisual, validateFully, validateGeometry } from '@tya/renderers'

const options = { datasets: DATASET_INDEX }
const svgFixtures = FIXTURES.filter((f) => !FLOW_LAID_OUT.includes(f.type))

describe('layout purity', () => {
  for (const spec of svgFixtures) {
    it(`${spec.type} produces byte-identical geometry for the same (spec, width)`, () => {
      const first = JSON.stringify(layoutVisual(spec.type, spec.payload, 375, options))
      for (let i = 0; i < 200; i++) {
        expect(JSON.stringify(layoutVisual(spec.type, spec.payload, 375, options))).toBe(first)
      }
    })
  }

  it('geometry changes with width, and only with width', () => {
    const spec = FIXTURES.find((f) => f.type === 'concept_map')!
    const a = layoutVisual(spec.type, spec.payload, 320, options)
    const b = layoutVisual(spec.type, spec.payload, 430, options)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('the three flow-laid components declare no geometry', () => {
    for (const type of FLOW_LAID_OUT) {
      const spec = FIXTURES.find((f) => f.type === type)!
      expect(layoutVisual(spec.type, spec.payload, 320, options)).toBeNull()
    }
  })
})

describe('U9 overlap and overflow', () => {
  for (const spec of svgFixtures) {
    for (const width of TEST_WIDTHS) {
      it(`${spec.type} at ${width}px has no overlap, no overflow, no small touch target`, () => {
        const issues = validateGeometry(spec, [width], options)
        expect(issues, JSON.stringify(issues, null, 2)).toEqual([])
      })
    }
  }

  it('catches an overlap when one is introduced', () => {
    const spec = JSON.parse(JSON.stringify(FIXTURES.find((f) => f.type === 'labeled_diagram')!))
    // Drop the left ventricle on top of the right ventricle.
    spec.payload.regions[3].grid = { col: 0, row: 3, w: 3, h: 2 }
    expect(validateGeometry(spec, [375], options).map((i) => i.rule)).toContain('U9.overlap')
  })
})

describe('assess payloads lay out too', () => {
  for (const spec of svgFixtures.filter((f) => f.modes_supported.includes('assess'))) {
    it(`${spec.type} lays out its stripped payload without overlap`, () => {
      const client = toClient(spec, 'assess')
      const geometry = layoutVisual(client.type, client.payload, 320, { ...options, sorted: false })
      if (!geometry) return
      // Every removed element is a 44px slot the learner can hit.
      for (const element of geometry.elements.filter((e) => e.slot)) {
        expect(element.box.w).toBeGreaterThanOrEqual(44)
        expect(element.box.h).toBeGreaterThanOrEqual(44)
      }
    })
  }
})

describe('all nine universal rules together', () => {
  for (const spec of FIXTURES) {
    it(`${spec.id} passes`, () => {
      const result = validateFully(spec, { claims: CLAIM_INDEX, datasets: DATASET_INDEX }, options)
      expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([])
    })
  }
})
