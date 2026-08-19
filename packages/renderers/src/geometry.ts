/**
 * Geometry types and the deterministic text metric.
 *
 * visual-system-spec.md §5: layout must be a pure function of
 * (spec, width) — no randomness, no DOM measurement, no animation
 * state. That is what makes a visual reproducible in a test and
 * identical between a server snapshot and the client.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A boxed element: a node, a step, a region, a slot. */
export interface LaidOutElement {
  id: string
  /** Drives the shape and border weight, never the colour alone. */
  kind: 'node' | 'core_node' | 'step' | 'decision' | 'output' | 'region' | 'event' | 'axis'
  box: Box
  label: string
  /** Wrapped label lines, already broken to fit `box`. */
  lines: string[]
  /** True when this element is a slot the learner fills in assess mode. */
  slot: boolean
}

export interface LaidOutPath {
  id: string
  /** SVG path data, computed here so the renderer stays declarative. */
  d: string
  arrow: boolean
  dashed: boolean
  tone: 'line' | 'accent' | 'support' | 'core'
  label?: string
  labelAt?: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

export interface LaidOutText {
  id: string
  x: number
  y: number
  text: string
  anchor: 'start' | 'middle' | 'end'
  size: number
  tone: 'ink' | 'ink-muted' | 'support' | 'accent'
  rotate?: number
}

export interface Geometry {
  width: number
  height: number
  elements: LaidOutElement[]
  paths: LaidOutPath[]
  texts: LaidOutText[]
}

/** Minimum touch target, §6. Nothing interactive may be smaller. */
export const TOUCH = 44

/** Smallest type the system permits, §6. */
export const MIN_FONT = 12

/**
 * Deterministic width estimate, §5.1: 0.55 x fontSize x charCount,
 * clamped. Never call getComputedTextLength — that would make layout
 * depend on a rendered DOM and break every purity guarantee.
 */
export function textWidth(text: string, fontSize = 12.5): number {
  return Math.min(text.length * fontSize * 0.55, 240)
}

/** Greedy word wrap to a character budget. Deterministic. */
export function wrap(text: string, maxChars: number, maxLines = 3): string[] {
  if (maxChars <= 0) return [text]
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines.length ? lines : ['']
  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1] as string
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1))}…`
  return kept
}

/** Characters that fit a box at a given font size. */
export const charsPerLine = (boxWidth: number, fontSize: number) =>
  Math.max(4, Math.floor((boxWidth - 10) / (fontSize * 0.55)))

export const boxesOverlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
