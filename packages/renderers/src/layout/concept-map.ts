import type { ConceptMapPayload } from '@tya/schema'
import {
  type Geometry, type LaidOutElement, type LaidOutPath, type LaidOutText,
  charsPerLine, textWidth, wrap,
} from '../geometry.js'
import { layerGraph, rowPositions } from './layered.js'

const ROW_H = 82
const NODE_H = 44
const PAD_TOP = 24
const FONT = 12
const MIN_W = 60
const MAX_W = 132

/**
 * §3.1 layout: layered by edge direction, barycentre ordered.
 *
 * A node whose label is empty is a slot — that is how an assess payload
 * arrives after the server strips it, so the renderer needs no separate
 * mode flag to know where the buttons go.
 */
export function layoutConceptMap(payload: ConceptMapPayload, width: number): Geometry {
  const { nodes, edges } = payload
  const { rows } = layerGraph(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const elements: LaidOutElement[] = []
  const centres = new Map<string, { x: number; y: number; w: number }>()

  rows.forEach((row, layer) => {
    const y = PAD_TOP + layer * ROW_H
    const placed = rowPositions(
      row.length, width,
      (i) => textWidth(byId.get(row[i] as string)?.label ?? '', FONT) + 24,
      MIN_W, MAX_W,
    )
    row.forEach((id, i) => {
      const node = byId.get(id)!
      const { x, w } = placed[i]!
      centres.set(id, { x, y, w })
      const slot = node.label.trim() === ''
      elements.push({
        id,
        kind: node.role === 'core' ? 'core_node' : 'node',
        box: { x: x - w / 2, y: y - NODE_H / 2, w, h: NODE_H },
        label: node.label,
        lines: slot ? [] : wrap(node.label, charsPerLine(w, FONT)),
        slot,
      })
    })
  })

  const paths: LaidOutPath[] = []
  const texts: LaidOutText[] = []
  for (const edge of edges) {
    const a = centres.get(edge.from)
    const b = centres.get(edge.to)
    if (!a || !b) continue
    const midY = (a.y + b.y) / 2
    const start = a.y + NODE_H / 2
    const end = b.y - NODE_H / 2
    paths.push({
      id: `${edge.from}->${edge.to}`,
      d: `M${a.x} ${start} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${end}`,
      arrow: true,
      dashed: edge.relation === 'contrasts_with',
      tone: edge.relation === 'contrasts_with' ? 'accent' : 'line',
    })
    if (edge.label) {
      texts.push({
        id: `${edge.from}->${edge.to}:label`,
        x: (a.x + b.x) / 2,
        y: midY + 4,
        text: edge.label,
        anchor: 'middle',
        size: 10.5,
        tone: 'ink-muted',
      })
    }
  }

  const height = PAD_TOP + Math.max(0, rows.length - 1) * ROW_H + NODE_H / 2 + 14
  return { width, height, elements, paths, texts }
}
