import { GRID_COLS, GRID_ROWS, type LabeledDiagramPayload } from '@tya/schema'
import {
  type Geometry, type LaidOutElement, type LaidOutPath, type LaidOutText,
  charsPerLine, wrap,
} from '../geometry.js'

const ROW_H = 30
const INSET = 3
const FONT = 11.5

/**
 * §3.6 layout: the 6 x 8 grid mapped to pixels, connectors routed
 * orthogonally.
 *
 * Regions are inset inside their grid cells, so two regions that are
 * adjacent on the grid are adjacent on screen without their borders
 * touching — and non-overlap on the grid, which validation enforces,
 * becomes non-overlap in pixels.
 */
export function layoutLabeledDiagram(payload: LabeledDiagramPayload, width: number): Geometry {
  const cellW = width / GRID_COLS
  const box = (g: { col: number; row: number; w: number; h: number }) => ({
    x: g.col * cellW + INSET,
    y: g.row * ROW_H + INSET,
    w: g.w * cellW - INSET * 2,
    h: g.h * ROW_H - INSET * 2,
  })

  const elements: LaidOutElement[] = payload.regions.map((region) => {
    const b = box(region.grid)
    const slot = region.label.trim() === ''
    return {
      id: region.id,
      kind: 'region' as const,
      box: b,
      label: region.label,
      lines: slot ? [] : wrap(region.label, charsPerLine(b.w, FONT), 2),
      slot,
    }
  })

  const centre = new Map(elements.map((e) => [e.id, { x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h / 2 }]))

  const paths: LaidOutPath[] = []
  const texts: LaidOutText[] = []
  for (const c of payload.connectors) {
    const a = centre.get(c.from)
    const b = centre.get(c.to)
    if (!a || !b) continue
    paths.push({
      id: `${c.from}->${c.to}`,
      d: `M${a.x} ${a.y} L${a.x} ${b.y} L${b.x} ${b.y}`,
      arrow: c.kind === 'flow',
      dashed: c.kind !== 'flow',
      tone: 'line',
    })
    if (c.label) {
      texts.push({
        id: `${c.from}->${c.to}:label`,
        x: a.x + 6,
        y: (a.y + b.y) / 2 + 3,
        text: c.label,
        anchor: 'start',
        size: 10,
        tone: 'ink-muted',
      })
    }
  }

  return { width, height: GRID_ROWS * ROW_H + INSET * 2, elements, paths, texts }
}
