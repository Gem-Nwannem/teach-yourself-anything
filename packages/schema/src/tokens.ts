/**
 * The one palette, from visual-system-spec.md §6.
 *
 * Colour never carries meaning alone: role is also border weight and
 * shape, series is also dash pattern, correctness is also icon and
 * motion. These values exist so universal rule U8 can be checked
 * automatically rather than asserted in a design review.
 */

export const TOKENS = {
  light: {
    surface: '#FFFFFF',
    ink: '#14181C',
    'ink-muted': '#5B6770',
    line: '#C9D1D6',
    core: '#2F6DF6',
    support: '#00A38C',
    accent: '#B4530A',
    correct: '#1B7F3B',
    incorrect: '#B4272B',
    slot: '#EEF2F5',
    page: '#F4F6F8',
  },
  dark: {
    surface: '#14181C',
    ink: '#ECEFF1',
    'ink-muted': '#9AA5AD',
    line: '#3A434B',
    core: '#6C9BFF',
    support: '#3FD3BC',
    accent: '#F0913D',
    correct: '#4FC97A',
    incorrect: '#FF7B7E',
    slot: '#212932',
    page: '#0C0F12',
  },
} as const

export type Scheme = keyof typeof TOKENS
export type TokenName = keyof (typeof TOKENS)['light']

/** Pairings that carry text or a meaningful mark, checked by U8. */
export const CONTRAST_PAIRS: { fg: TokenName; bg: TokenName; min: number; note: string }[] = [
  { fg: 'ink', bg: 'surface', min: 4.5, note: 'labels on canvas' },
  { fg: 'ink', bg: 'slot', min: 4.5, note: 'placed label in a slot' },
  { fg: 'ink-muted', bg: 'surface', min: 4.5, note: 'units and secondary text' },
  { fg: 'ink-muted', bg: 'page', min: 4.5, note: 'captions on the page ground' },
  { fg: 'core', bg: 'surface', min: 3.0, note: 'core node border and primary series' },
  { fg: 'support', bg: 'surface', min: 3.0, note: 'second series' },
  { fg: 'accent', bg: 'surface', min: 3.0, note: 'third series and emphasis' },
  { fg: 'correct', bg: 'surface', min: 4.5, note: 'correct feedback text' },
  { fg: 'incorrect', bg: 'surface', min: 4.5, note: 'incorrect feedback text' },
  { fg: 'line', bg: 'surface', min: 1.4, note: 'edges and borders, non-text' },
]

function srgbChannel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export interface ContrastFailure {
  scheme: Scheme
  fg: TokenName
  bg: TokenName
  ratio: number
  min: number
  note: string
}

/** Universal rule U8, run over the whole palette rather than per spec. */
export function checkPaletteContrast(): ContrastFailure[] {
  const out: ContrastFailure[] = []
  for (const scheme of ['light', 'dark'] as Scheme[]) {
    for (const pair of CONTRAST_PAIRS) {
      const ratio = contrastRatio(TOKENS[scheme][pair.fg], TOKENS[scheme][pair.bg])
      if (ratio + 1e-9 < pair.min) {
        out.push({ scheme, fg: pair.fg, bg: pair.bg, ratio, min: pair.min, note: pair.note })
      }
    }
  }
  return out
}
