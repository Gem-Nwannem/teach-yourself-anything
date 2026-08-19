import type { TimelinePayload } from '@tya/schema'
import {
  type Geometry, type LaidOutElement, type LaidOutPath, type LaidOutText,
  charsPerLine, wrap,
} from '../geometry.js'

const GAP = 66
const PAD_TOP = 28
const AXIS_X_RATIO = 0.27
const FONT = 12
const LABEL_H = 44

/**
 * §3.4 layout: vertical axis on mobile.
 *
 * Events are drawn in `sort` order, never in payload order — except
 * that an assess payload arrives deliberately shuffled, and there the
 * learner's arrangement is the thing on screen. The distinction is made
 * by the caller: `sorted` is false when the learner is ordering.
 */
export function layoutTimeline(payload: TimelinePayload, width: number, sorted = true): Geometry {
  const events = sorted ? [...payload.events].sort((a, b) => a.sort - b.sort) : [...payload.events]
  const axisX = Math.round(width * AXIS_X_RATIO)
  const labelX = axisX + 16
  const labelW = width - labelX - 8

  const elements: LaidOutElement[] = []
  const texts: LaidOutText[] = []
  const paths: LaidOutPath[] = []

  const yOf = (i: number) => PAD_TOP + i * GAP

  paths.push({
    id: 'axis',
    d: `M${axisX} ${yOf(0) - 12} L${axisX} ${yOf(events.length - 1) + 12}`,
    arrow: false,
    dashed: false,
    tone: 'line',
  })

  const indexOf = new Map(events.map((e, i) => [e.id, i]))

  payload.periods.forEach((period, pi) => {
    const a = indexOf.get(period.from)
    const b = indexOf.get(period.to)
    if (a === undefined || b === undefined) return
    const x = axisX - 20 - pi * 10
    paths.push({
      id: `period:${period.id}`,
      d: `M${x} ${yOf(a)} L${x} ${yOf(b)}`,
      arrow: false,
      dashed: false,
      tone: 'support',
    })
    texts.push({
      id: `period:${period.id}:label`,
      x: x - 7,
      y: (yOf(a) + yOf(b)) / 2,
      text: period.label,
      anchor: 'middle',
      size: 10,
      tone: 'support',
      rotate: -90,
    })
  })

  payload.causal_links.forEach((link) => {
    const a = indexOf.get(link.from)
    const b = indexOf.get(link.to)
    if (a === undefined || b === undefined) return
    const bow = axisX + 46
    paths.push({
      id: `link:${link.from}->${link.to}`,
      d: `M${axisX + 8} ${yOf(a)} C ${bow} ${yOf(a)}, ${bow} ${yOf(b)}, ${axisX + 8} ${yOf(b)}`,
      arrow: true,
      dashed: true,
      tone: 'accent',
      ...(link.label
        ? { label: link.label, labelAt: { x: bow, y: (yOf(a) + yOf(b)) / 2, anchor: 'start' as const } }
        : {}),
    })
  })

  events.forEach((event, i) => {
    const y = yOf(i)
    const slot = event.label.trim() === ''
    texts.push({
      id: `${event.id}:when`,
      x: axisX - 14,
      y: y + 4,
      text: event.when,
      anchor: 'end',
      size: 11.5,
      tone: 'ink-muted',
    })
    elements.push({
      id: event.id,
      kind: 'event',
      box: { x: labelX, y: y - LABEL_H / 2, w: labelW, h: LABEL_H },
      label: event.label,
      lines: slot ? [] : wrap(event.label, charsPerLine(labelW, FONT)),
      slot,
    })
  })

  const height = yOf(events.length - 1) + LABEL_H / 2 + 14
  return { width, height, elements, paths, texts }
}
