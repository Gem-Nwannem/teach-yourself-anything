import type { Dataset, VisualType } from '@tya/schema'
import type { Geometry } from '../geometry.js'
import { layoutConceptMap } from './concept-map.js'
import { layoutProcessFlow } from './process-flow.js'
import { layoutTimeline } from './timeline.js'
import { layoutLabeledDiagram } from './labeled-diagram.js'
import { layoutQuantChart } from './quant-chart.js'

export * from './layered.js'
export { layoutConceptMap } from './concept-map.js'
export { layoutProcessFlow } from './process-flow.js'
export { layoutTimeline } from './timeline.js'
export { layoutLabeledDiagram } from './labeled-diagram.js'
export { layoutQuantChart, chartMarkers, type ChartOptions } from './quant-chart.js'

export interface LayoutOptions {
  datasets?: Map<string, Dataset>
  control?: number
  /** Timeline only: false while the learner is arranging events. */
  sorted?: boolean
}

/**
 * Five of the eight components compute their own geometry in SVG. The
 * other three — comparison_matrix, hierarchy, sequence_model — are laid
 * out by the browser as a table, a nested list and a flex strip,
 * because §3 specifies those native structures and because a phone
 * reflows them better than any coordinate we could compute. They return
 * null here, and their overflow behaviour is a CSS responsibility.
 */
export const FLOW_LAID_OUT: VisualType[] = ['comparison_matrix', 'hierarchy', 'sequence_model']

export function layoutVisual(
  type: VisualType,
  payload: unknown,
  width: number,
  options: LayoutOptions = {},
): Geometry | null {
  switch (type) {
    case 'concept_map':
      return layoutConceptMap(payload as never, width)
    case 'process_flow':
      return layoutProcessFlow(payload as never, width)
    case 'timeline':
      return layoutTimeline(payload as never, width, options.sorted ?? true)
    case 'labeled_diagram':
      return layoutLabeledDiagram(payload as never, width)
    case 'quant_chart':
      return layoutQuantChart(payload as never, width, {
        datasets: options.datasets ?? new Map(),
        ...(options.control === undefined ? {} : { control: options.control }),
      })
    default:
      return null
  }
}
