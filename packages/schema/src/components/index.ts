import type { VisualType } from '../base.js'
import type { ComponentDef } from '../registry.js'
import { conceptMap } from './concept-map.js'
import { processFlow } from './process-flow.js'
import { comparisonMatrix } from './comparison-matrix.js'
import { timeline } from './timeline.js'
import { hierarchy } from './hierarchy.js'
import { labeledDiagram } from './labeled-diagram.js'
import { quantChart } from './quant-chart.js'
import { sequenceModel } from './sequence-model.js'

export const COMPONENTS: Record<VisualType, ComponentDef> = {
  concept_map: conceptMap,
  process_flow: processFlow,
  comparison_matrix: comparisonMatrix,
  timeline,
  hierarchy,
  labeled_diagram: labeledDiagram,
  quant_chart: quantChart,
  sequence_model: sequenceModel,
}

export function componentFor(type: VisualType): ComponentDef {
  const def = COMPONENTS[type]
  if (!def) throw new Error(`unknown visual type: ${type}`)
  return def
}

export * from './concept-map.js'
export * from './process-flow.js'
export * from './comparison-matrix.js'
export * from './timeline.js'
export * from './hierarchy.js'
export * from './labeled-diagram.js'
export * from './quant-chart.js'
export * from './sequence-model.js'
