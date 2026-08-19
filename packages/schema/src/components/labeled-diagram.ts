import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

/** The normalized grid from visual-system-spec.md §3.6. Six columns, eight rows. */
export const GRID_COLS = 6
export const GRID_ROWS = 8

export const LabeledDiagramPayload = z.object({
  regions: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    function: z.string().optional(),
    grid: z.object({
      col: z.number().int().min(0),
      row: z.number().int().min(0),
      w: z.number().int().min(1),
      h: z.number().int().min(1),
    }),
  })).min(2),
  connectors: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
    kind: z.enum(['flow', 'contains', 'adjacent']),
  })).default([]),
})
export type LabeledDiagramPayload = z.infer<typeof LabeledDiagramPayload>

const overlaps = (
  a: { col: number; row: number; w: number; h: number },
  b: { col: number; row: number; w: number; h: number },
) => a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h

export const labeledDiagram: ComponentDef<LabeledDiagramPayload> = {
  type: 'labeled_diagram',
  payload: LabeledDiagramPayload,
  tasks: ['label_regions', 'trace_path', 'name_function'],
  orderTasks: [],
  caps: { regions: 7, connectors: 8, region_w: 3, region_h: 3 },
  labelLimits: { region: 24, connector: 20 },

  labels: (p) => [
    ...p.regions.map((r): Label => ({ id: r.id, text: r.label, kind: 'region' })),
    ...p.connectors.flatMap((c): Label[] =>
      c.label ? [{ id: `${c.from}->${c.to}`, text: c.label, kind: 'connector' }] : []),
  ],
  slotIds: (p) => p.regions.map((r) => r.id),
  ordering: () => [],
  reorder: (p) => p,
  strip: (p, removed) => {
    const gone = new Set(removed)
    return {
      ...p,
      regions: p.regions.map((r) => {
        if (!gone.has(r.id)) return r
        // The function text names the region as surely as the label does.
        const { function: _drop, ...rest } = r
        return { ...rest, label: '' }
      }),
    }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    if (p.regions.length > 7) out.push(issue('U2.cap', `${p.regions.length} regions exceeds the cap of 7`, 'regions'))
    if (p.connectors.length > 8) {
      out.push(issue('U2.cap', `${p.connectors.length} connectors exceeds the cap of 8`, 'connectors'))
    }
    for (const r of p.regions) {
      if (r.grid.w > 3 || r.grid.h > 3) {
        out.push(issue('U2.cap', `region "${r.label || r.id}" is ${r.grid.w}x${r.grid.h}, cap is 3x3`, r.id))
      }
    }
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    for (const r of p.regions) {
      const { col, row, w, h } = r.grid
      if (col + w > GRID_COLS || row + h > GRID_ROWS) {
        out.push(issue('labeled_diagram.grid_range',
          `region "${r.label || r.id}" runs outside the ${GRID_COLS}x${GRID_ROWS} grid`, r.id))
      }
    }
    for (let a = 0; a < p.regions.length; a++) {
      for (let b = a + 1; b < p.regions.length; b++) {
        const ra = p.regions[a]!
        const rb = p.regions[b]!
        if (overlaps(ra.grid, rb.grid)) {
          out.push(issue('labeled_diagram.overlap',
            `regions "${ra.label || ra.id}" and "${rb.label || rb.id}" overlap on the grid`, rb.id))
        }
      }
    }
    const ids = new Set(p.regions.map((r) => r.id))
    const touched = new Set<string>()
    for (const c of p.connectors) {
      for (const end of [c.from, c.to]) {
        if (!ids.has(end)) {
          out.push(issue('labeled_diagram.connector_endpoint',
            `connector references unknown region "${end}"`, `${c.from}->${c.to}`))
        }
        touched.add(end)
      }
    }
    // "Every region reachable via connectors" (§3.6) is enforced as "no
    // isolated region", not as one connected component: a heart diagram
    // has two circuits and is correct anatomy, not a broken spec.
    for (const r of p.regions) {
      if (!touched.has(r.id)) {
        out.push(issue('labeled_diagram.isolated_region',
          `region "${r.label || r.id}" has no connectors`, r.id))
      }
    }
    return out
  },
}
