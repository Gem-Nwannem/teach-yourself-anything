import type { ProcessFlowPayload } from '@tya/schema'
import {
  type Geometry, type LaidOutElement, type LaidOutPath, type LaidOutText,
  charsPerLine, textWidth, wrap,
} from '../geometry.js'
import { layerGraph, rowPositions } from './layered.js'

const ROW_H = 88
const STEP_H = 44
const DECISION_H = 52
const PAD_TOP = 26
const FONT = 12
const MIN_W = 68
const MAX_W = 140

/** §3.2 layout: vertical layered, top to bottom, decisions branch to two. */
export function layoutProcessFlow(payload: ProcessFlowPayload, width: number): Geometry {
  const { steps, transitions } = payload
  const { rows } = layerGraph(steps, transitions)
  const byId = new Map(steps.map((s) => [s.id, s]))

  const elements: LaidOutElement[] = []
  const centres = new Map<string, { x: number; y: number; h: number }>()

  rows.forEach((row, layer) => {
    const y = PAD_TOP + layer * ROW_H
    const placed = rowPositions(
      row.length, width,
      (i) => textWidth(byId.get(row[i] as string)?.label ?? '', FONT) + 26,
      MIN_W, MAX_W,
    )
    row.forEach((id, i) => {
      const step = byId.get(id)!
      const { x, w } = placed[i]!
      const h = step.kind === 'decision' ? DECISION_H : STEP_H
      centres.set(id, { x, y, h })
      const slot = step.label.trim() === ''
      elements.push({
        id,
        kind: step.kind === 'decision' ? 'decision' : step.kind === 'output' ? 'output' : 'step',
        box: { x: x - w / 2, y: y - h / 2, w, h },
        label: step.label,
        lines: slot ? [] : wrap(step.label, charsPerLine(w, FONT)),
        slot,
      })
    })
  })

  const paths: LaidOutPath[] = []
  const texts: LaidOutText[] = []
  for (const t of transitions) {
    const a = centres.get(t.from)
    const b = centres.get(t.to)
    if (!a || !b) continue
    const start = a.y + a.h / 2
    const end = b.y - b.h / 2
    const mid = (start + end) / 2
    paths.push({
      id: `${t.from}->${t.to}`,
      d: `M${a.x} ${start} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${end}`,
      arrow: true,
      dashed: false,
      tone: 'line',
    })
    if (t.condition) {
      const rightward = b.x >= a.x
      texts.push({
        id: `${t.from}->${t.to}:condition`,
        x: (a.x + b.x) / 2 + (rightward ? 14 : -14),
        y: mid + 4,
        text: t.condition,
        anchor: rightward ? 'start' : 'end',
        size: 10.5,
        tone: 'accent',
      })
    }
  }

  const height = PAD_TOP + Math.max(0, rows.length - 1) * ROW_H + DECISION_H / 2 + 14
  return { width, height, elements, paths, texts }
}
