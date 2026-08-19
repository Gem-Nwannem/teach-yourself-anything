import {
  type Issue, type ValidationContext, type ValidationResult, type VisualSpec,
  issue, ok, validateVisual,
} from '@tya/schema'
import { TOUCH, boxesOverlap } from './geometry.js'
import { type LayoutOptions, layoutVisual } from './layout/index.js'

/** The viewports §10 requires every fixture to survive. */
export const TEST_WIDTHS = [320, 375, 430]

/**
 * Universal rule U9: the deterministic layout produces no overlapping
 * elements and nothing outside the viewport at 320px.
 *
 * Kept out of @tya/schema because it needs the layout functions; run
 * together with the other eight through `validateFully`.
 */
export function validateGeometry(
  spec: VisualSpec,
  widths: number[] = TEST_WIDTHS,
  options: LayoutOptions = {},
): Issue[] {
  const issues: Issue[] = []
  for (const width of widths) {
    const geometry = layoutVisual(spec.type, spec.payload, width, options)
    if (!geometry) continue

    for (const element of geometry.elements) {
      const { box } = element
      if (box.x < -0.5 || box.y < -0.5 || box.x + box.w > width + 0.5 || box.y + box.h > geometry.height + 0.5) {
        issues.push(issue('U9.overflow',
          `at ${width}px, "${element.label || element.id}" falls outside the frame`, element.id))
      }
      // §6: 44 x 44 minimum for anything the learner touches. Slots are
      // buttons, so this is a correctness rule, not a preference.
      if (element.slot && (box.w < TOUCH || box.h < TOUCH)) {
        issues.push(issue('U9.touch_target',
          `at ${width}px, slot "${element.id}" is ${Math.round(box.w)}x${Math.round(box.h)}, minimum is ${TOUCH}x${TOUCH}`,
          element.id))
      }
    }

    for (let a = 0; a < geometry.elements.length; a++) {
      for (let b = a + 1; b < geometry.elements.length; b++) {
        const ea = geometry.elements[a]!
        const eb = geometry.elements[b]!
        if (boxesOverlap(ea.box, eb.box)) {
          issues.push(issue('U9.overlap',
            `at ${width}px, "${ea.label || ea.id}" overlaps "${eb.label || eb.id}"`, eb.id))
        }
      }
    }
  }
  return issues
}

/** All nine universal rules, the same code path server-side and in the client. */
export function validateFully(
  spec: VisualSpec,
  ctx: ValidationContext = {},
  options: LayoutOptions = {},
): ValidationResult {
  const base = validateVisual(spec, ctx)
  return ok([...base.issues, ...validateGeometry(spec, TEST_WIDTHS, options)])
}
