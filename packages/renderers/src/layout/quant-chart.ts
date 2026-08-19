import type { Dataset, QuantChartPayload } from '@tya/schema'
import type { Geometry, LaidOutPath, LaidOutText } from '../geometry.js'

const LEFT = 44
const BOTTOM = 34
const RIGHT = 8
const TOP = 10
/** §3.7 fixed aspect 4:3. */
const ASPECT = 3 / 4

export interface ChartOptions {
  datasets: Map<string, Dataset>
  /** Current control value; defaults to the control's own default. */
  control?: number
}

/**
 * §3.7 layout. Every number drawn comes from a Dataset row — the model
 * never emits data points, so an unresolved dataset yields an empty
 * plot rather than an invented one.
 */
export function layoutQuantChart(
  payload: QuantChartPayload,
  width: number,
  options: ChartOptions,
): Geometry {
  const height = Math.round(width * ASPECT)
  const controlValue = options.control ?? payload.control?.default
  const paths: LaidOutPath[] = []
  const texts: LaidOutText[] = []

  const series = payload.series.map((s) => {
    const ds = options.datasets.get(s.dataset_ref)
    const points = (ds?.points ?? [])
      .filter((p) => p.series === undefined || p.series === s.id)
      .filter((p) => p.k === undefined || controlValue === undefined || p.k === controlValue)
      .sort((a, b) => a.x - b.x)
    return { id: s.id, label: s.label, points }
  })

  const all = series.flatMap((s) => s.points)
  const xs = all.map((p) => p.x)
  const ys = all.map((p) => p.y)
  const x0 = xs.length ? Math.min(...xs) : 0
  const x1 = xs.length ? Math.max(...xs) : 1
  const y0 = 0
  const y1 = ys.length ? Math.max(...ys) * 1.1 : 1

  const X = (v: number) => LEFT + ((v - x0) / (x1 - x0 || 1)) * (width - LEFT - RIGHT)
  const Y = (v: number) => height - BOTTOM - ((v - y0) / (y1 - y0 || 1)) * (height - BOTTOM - TOP)

  // Four gridlines, and none below 400px per §3.7 — the axis labels stay.
  const showGrid = width >= 400
  for (let i = 0; i <= 4; i++) {
    const v = y0 + ((y1 - y0) * i) / 4
    if (showGrid) {
      paths.push({
        id: `grid-${i}`,
        d: `M${LEFT} ${Y(v)} L${width - RIGHT} ${Y(v)}`,
        arrow: false,
        dashed: false,
        tone: 'line',
      })
    }
    texts.push({
      id: `tick-${i}`,
      x: LEFT - 7,
      y: Y(v) + 4,
      text: v.toFixed(0),
      anchor: 'end',
      size: 10.5,
      tone: 'ink-muted',
    })
  }

  const TONES = ['core', 'support', 'accent'] as const
  series.forEach((s, i) => {
    if (s.points.length === 0) return
    paths.push({
      id: `series:${s.id}`,
      d: s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${X(p.x)} ${Y(p.y)}`).join(' '),
      arrow: false,
      // Series differ by dash pattern as well as colour, §6.
      dashed: i > 0,
      tone: TONES[Math.min(i, TONES.length - 1)]!,
    })
  })

  texts.push({
    id: 'x-label',
    x: (LEFT + width - RIGHT) / 2,
    y: height - 6,
    text: payload.x.label,
    anchor: 'middle',
    size: 11,
    tone: 'ink-muted',
  })
  texts.push({
    id: 'y-label',
    x: 10,
    y: (height - BOTTOM) / 2,
    text: payload.y.label,
    anchor: 'middle',
    size: 11,
    tone: 'ink-muted',
    rotate: -90,
  })

  return {
    width,
    height,
    // The plot frame is one element so overlap checks have something to
    // anchor on; the marks themselves are paths.
    elements: [{
      id: 'plot',
      kind: 'axis',
      box: { x: LEFT, y: TOP, w: width - LEFT - RIGHT, h: height - TOP - BOTTOM },
      label: `${payload.y.label} against ${payload.x.label}`,
      lines: [],
      slot: false,
    }],
    paths,
    texts,
  }
}

/** Point markers, exposed so the renderer does not recompute the scales. */
export function chartMarkers(
  payload: QuantChartPayload,
  width: number,
  options: ChartOptions,
): { id: string; cx: number; cy: number; series: number }[] {
  const geometry = layoutQuantChart(payload, width, options)
  const out: { id: string; cx: number; cy: number; series: number }[] = []
  geometry.paths
    .filter((p) => p.id.startsWith('series:'))
    .forEach((p, si) => {
      const coords = p.d.match(/[ML]([\d.-]+) ([\d.-]+)/g) ?? []
      coords.forEach((c, i) => {
        const m = c.match(/[ML]([\d.-]+) ([\d.-]+)/)
        if (!m) return
        out.push({ id: `${p.id}:${i}`, cx: Number(m[1]), cy: Number(m[2]), series: si })
      })
    })
  return out
}
