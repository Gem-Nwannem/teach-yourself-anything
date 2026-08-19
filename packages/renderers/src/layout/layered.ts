/**
 * Layered layout for the two node-and-edge components.
 *
 * Longest-path layering plus one barycentre ordering pass — Sugiyama
 * without the crossing-minimisation sweep, which §3.1 says is enough at
 * nine nodes. Deterministic throughout: ties break on id, never on
 * iteration order.
 */

export interface GraphNode {
  id: string
}

export interface GraphEdge {
  from: string
  to: string
}

export interface Layering {
  /** Layer index per node id. */
  layer: Record<string, number>
  /** Node ids per layer, in draw order left to right. */
  rows: string[][]
  maxLayer: number
}

export function layerGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Layering {
  const ids = nodes.map((n) => n.id)
  const idSet = new Set(ids)
  const clean = edges.filter((e) => idSet.has(e.from) && idSet.has(e.to))

  const indeg = new Map(ids.map((id) => [id, 0]))
  const adj = new Map(ids.map((id) => [id, [] as string[]]))
  for (const e of clean) {
    adj.get(e.from)!.push(e.to)
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  for (const list of adj.values()) list.sort()

  const layer: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
  const queue = ids.filter((id) => indeg.get(id) === 0).sort()
  const deg = new Map(indeg)
  const settled = new Set<string>()

  while (queue.length) {
    const u = queue.shift() as string
    settled.add(u)
    for (const v of adj.get(u) ?? []) {
      layer[v] = Math.max(layer[v] ?? 0, (layer[u] ?? 0) + 1)
      const d = (deg.get(v) ?? 0) - 1
      deg.set(v, d)
      if (d === 0) queue.push(v)
    }
    queue.sort()
  }
  // Cycle guard: anything Kahn could not settle sits on layer 0 rather
  // than vanishing. Validation rejects cycles in process_flow; a concept
  // map may legitimately have one.
  for (const id of ids) if (!settled.has(id)) layer[id] = 0

  const rows: string[][] = []
  for (const id of ids) {
    const l = layer[id] ?? 0
    ;(rows[l] ??= []).push(id)
  }
  for (let l = 0; l < rows.length; l++) rows[l] ??= []

  // Barycentre ordering, one downward pass.
  for (let l = 1; l < rows.length; l++) {
    const above = rows[l - 1] as string[]
    const bary = (id: string): number => {
      const parents = clean.filter((e) => e.to === id).map((e) => above.indexOf(e.from)).filter((i) => i >= 0)
      return parents.length ? parents.reduce((s, x) => s + x, 0) / parents.length : Number.MAX_SAFE_INTEGER
    }
    ;(rows[l] as string[]).sort((a, b) => bary(a) - bary(b) || a.localeCompare(b))
  }
  rows[0]?.sort()

  return { layer, rows, maxLayer: Math.max(0, rows.length - 1) }
}

/**
 * Evenly spaced x positions for one row, with a width budget that makes
 * overlap structurally impossible rather than merely unlikely.
 */
export function rowPositions(
  count: number,
  width: number,
  desired: (index: number) => number,
  minWidth: number,
  maxWidth: number,
  gap = 8,
): { x: number; w: number }[] {
  const step = width / (count + 1)
  const budget = Math.max(minWidth, step - gap)
  return Array.from({ length: count }, (_, i) => ({
    x: step * (i + 1),
    w: Math.min(Math.max(minWidth, desired(i)), maxWidth, budget),
  }))
}
