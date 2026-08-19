import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

/**
 * A point belongs to a series and, when the visual has a control, to one
 * value of that control. `k` is the control key: moving the slider swaps
 * which subset of the dataset is drawn. Nothing here is model-generated
 * (§3.7 data rule) — every row traces to a source.
 */
export const DatasetPoint = z.object({
  x: z.number(),
  y: z.number(),
  series: z.string().optional(),
  k: z.number().optional(),
})

export const Dataset = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  unit_x: z.string().min(1),
  unit_y: z.string().min(1),
  points: z.array(DatasetPoint).min(2),
  source_id: z.string().min(1),
})
export type Dataset = z.infer<typeof Dataset>

export const QuantChartPayload = z.object({
  chart: z.enum(['line', 'bar', 'scatter']),
  x: z.object({ label: z.string(), unit: z.string() }),
  y: z.object({ label: z.string(), unit: z.string() }),
  series: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    dataset_ref: z.string().min(1),
  })).min(1),
  control: z.object({
    variable: z.string().min(1),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    default: z.number(),
    unit: z.string().optional(),
  }).optional(),
})
export type QuantChartPayload = z.infer<typeof QuantChartPayload>

export const quantChart: ComponentDef<QuantChartPayload> = {
  type: 'quant_chart',
  payload: QuantChartPayload,
  tasks: ['predict_before_reveal', 'read_value', 'explain_direction'],
  orderTasks: [],
  caps: { series: 3, points_per_series: 40, controls: 1 },
  labelLimits: { axis: 28, series: 24, control: 24 },

  labels: (p) => [
    { id: 'x', text: p.x.label, kind: 'axis' },
    { id: 'y', text: p.y.label, kind: 'axis' },
    ...p.series.map((s): Label => ({ id: s.id, text: s.label, kind: 'series' })),
    ...(p.control ? [{ id: 'control', text: p.control.variable, kind: 'control' } as Label] : []),
  ],
  // A quant chart is assessed by prediction and reading, never by blanking
  // an element, so it has no slots.
  slotIds: () => [],
  ordering: () => [],
  reorder: (p) => p,
  strip: (p) => p,

  checkCaps: (p) => {
    const out: Issue[] = []
    if (p.series.length > 3) out.push(issue('U2.cap', `${p.series.length} series exceeds the cap of 3`, 'series'))
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    if (!p.x.unit.trim()) out.push(issue('quant_chart.axis_unit', 'the x axis has no unit', 'x'))
    if (!p.y.unit.trim()) out.push(issue('quant_chart.axis_unit', 'the y axis has no unit', 'y'))
    if (p.control && !(p.control.min < p.control.max)) {
      out.push(issue('quant_chart.control_range', 'control min must be below control max', 'control'))
    }
    if (p.control && (p.control.default < p.control.min || p.control.default > p.control.max)) {
      out.push(issue('quant_chart.control_default', 'control default falls outside its own range', 'control'))
    }
    return out
  },
}

/**
 * Rules that need the datasets resolved. Kept separate because the
 * renderer validates defensively without a database.
 */
export function checkQuantChartData(p: QuantChartPayload, datasets: Map<string, Dataset>): Issue[] {
  const out: Issue[] = []
  const keys: number[] = []
  for (const s of p.series) {
    const ds = datasets.get(s.dataset_ref)
    if (!ds) {
      // §3.7: no dataset, no chart. The pipeline downgrades to comparison_matrix.
      out.push(issue('quant_chart.dataset_ref', `dataset "${s.dataset_ref}" does not resolve`, s.id))
      continue
    }
    if (ds.points.length > 40) {
      out.push(issue('U2.cap', `dataset "${ds.id}" has ${ds.points.length} points, cap is 40`, s.id))
    }
    for (const pt of ds.points) if (pt.k !== undefined) keys.push(pt.k)
  }
  if (p.control && keys.length > 0) {
    const lo = Math.min(...keys)
    const hi = Math.max(...keys)
    if (p.control.min > lo || p.control.max < hi) {
      out.push(issue('quant_chart.control_coverage',
        `control range ${p.control.min}..${p.control.max} does not cover dataset keys ${lo}..${hi}`, 'control'))
    }
  }
  return out
}
