import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export const ComparisonMatrixPayload = z.object({
  row_labels: z.array(z.string()).min(1),
  col_labels: z.array(z.string()).min(2),
  cells: z.array(z.array(z.string())).min(1),
})
export type ComparisonMatrixPayload = z.infer<typeof ComparisonMatrixPayload>

/** Slot key for a cell. Row-major, zero-based, matching assess.removed. */
export const cellKey = (r: number, c: number) => `${r}-${c}`

export const comparisonMatrix: ComponentDef<ComparisonMatrixPayload> = {
  type: 'comparison_matrix',
  payload: ComparisonMatrixPayload,
  tasks: ['fill_cells', 'match_column'],
  orderTasks: [],
  caps: { rows: 5, cols: 4 },
  labelLimits: { cell: 40, row: 28, col: 28 },

  labels: (p) => [
    ...p.row_labels.map((t, r): Label => ({ id: `row-${r}`, text: t, kind: 'row' })),
    ...p.col_labels.map((t, c): Label => ({ id: `col-${c}`, text: t, kind: 'col' })),
    ...p.cells.flatMap((row, r) => row.map((t, c): Label => ({ id: cellKey(r, c), text: t, kind: 'cell' }))),
  ],
  slotIds: (p) => p.cells.flatMap((row, r) => row.map((_, c) => cellKey(r, c))),
  ordering: () => [],
  reorder: (p) => p,
  strip: (p, removed) => {
    const gone = new Set(removed)
    return { ...p, cells: p.cells.map((row, r) => row.map((v, c) => (gone.has(cellKey(r, c)) ? '' : v))) }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    if (p.cells.length > 5) out.push(issue('U2.cap', `${p.cells.length} rows exceeds the cap of 5`, 'cells'))
    if (p.col_labels.length > 4) {
      out.push(issue('U2.cap', `${p.col_labels.length} columns exceeds the cap of 4`, 'col_labels'))
    }
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    if (p.cells.length !== p.row_labels.length) {
      out.push(issue('comparison_matrix.dimensions',
        `${p.cells.length} cell rows but ${p.row_labels.length} row labels`, 'cells'))
    }
    p.cells.forEach((row, r) => {
      if (row.length !== p.col_labels.length) {
        out.push(issue('comparison_matrix.dimensions',
          `row ${r} has ${row.length} cells but there are ${p.col_labels.length} columns`, `row-${r}`))
      }
      row.forEach((v, c) => {
        if (v.trim() === '') {
          out.push(issue('comparison_matrix.empty_cell', 'no cell may be empty in teach mode', cellKey(r, c)))
        }
      })
    })
    const columns = p.col_labels.map((_, c) => p.cells.map((row) => row[c] ?? '').join(' '))
    for (let a = 0; a < columns.length; a++) {
      for (let b = a + 1; b < columns.length; b++) {
        if (columns[a] === columns[b]) {
          out.push(issue('comparison_matrix.identical_columns',
            `columns "${p.col_labels[a]}" and "${p.col_labels[b]}" are identical`, `col-${b}`))
        }
      }
    }
    return out
  },
}
