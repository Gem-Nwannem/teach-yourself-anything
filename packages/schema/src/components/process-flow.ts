import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export const ProcessFlowPayload = z.object({
  steps: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    kind: z.enum(['step', 'decision', 'input', 'output']),
  })).min(2),
  transitions: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    condition: z.string().optional(),
  })).min(1),
})
export type ProcessFlowPayload = z.infer<typeof ProcessFlowPayload>

/** Kahn's algorithm. Returns false if any cycle remains. */
export function isDag(nodes: readonly string[], edges: readonly { from: string; to: string }[]): boolean {
  const indeg = new Map(nodes.map((n) => [n, 0]))
  const adj = new Map(nodes.map((n) => [n, [] as string[]]))
  for (const e of edges) {
    if (!indeg.has(e.to) || !adj.has(e.from)) continue
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
    adj.get(e.from)!.push(e.to)
  }
  const q = nodes.filter((n) => indeg.get(n) === 0)
  let seen = 0
  while (q.length) {
    const u = q.shift() as string
    seen++
    for (const v of adj.get(u) ?? []) {
      const d = (indeg.get(v) ?? 0) - 1
      indeg.set(v, d)
      if (d === 0) q.push(v)
    }
  }
  return seen === nodes.length
}

/** Longest path from any source, used for the branch-depth cap. */
function maxDepth(nodes: readonly string[], edges: readonly { from: string; to: string }[]): number {
  const adj = new Map(nodes.map((n) => [n, [] as string[]]))
  const indeg = new Map(nodes.map((n) => [n, 0]))
  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  const depth = new Map(nodes.map((n) => [n, 0]))
  const q = nodes.filter((n) => indeg.get(n) === 0)
  const deg = new Map(indeg)
  while (q.length) {
    const u = q.shift() as string
    for (const v of adj.get(u) ?? []) {
      depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(u) ?? 0) + 1))
      const d = (deg.get(v) ?? 0) - 1
      deg.set(v, d)
      if (d === 0) q.push(v)
    }
  }
  return Math.max(0, ...depth.values())
}

export const processFlow: ComponentDef<ProcessFlowPayload> = {
  type: 'process_flow',
  payload: ProcessFlowPayload,
  tasks: ['order_steps', 'place_decision_conditions', 'predict_next'],
  orderTasks: ['order_steps'],
  caps: { steps: 8, decisions: 2, branch_depth: 2 },
  labelLimits: { step: 32, condition: 16 },

  labels: (p) => [
    ...p.steps.map((s): Label => ({ id: s.id, text: s.label, kind: 'step' })),
    ...p.transitions.flatMap((t): Label[] =>
      t.condition ? [{ id: `${t.from}->${t.to}`, text: t.condition, kind: 'condition' }] : []),
  ],
  slotIds: (p) => [...p.steps.map((s) => s.id), ...p.transitions.map((t) => `${t.from}->${t.to}`)],
  ordering: (p) => p.steps.map((s) => s.id),
  reorder: (p, order) => ({
    ...p,
    steps: order.flatMap((id) => p.steps.filter((s) => s.id === id)),
  }),
  strip: (p, removed) => {
    const gone = new Set(removed)
    return {
      steps: p.steps.map((s) => (gone.has(s.id) ? { ...s, label: '' } : s)),
      transitions: p.transitions.map((t) => {
        if (!gone.has(`${t.from}->${t.to}`)) return t
        const { condition: _drop, ...rest } = t
        return rest
      }),
    }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    const decisions = p.steps.filter((s) => s.kind === 'decision').length
    if (p.steps.length > 8) out.push(issue('U2.cap', `${p.steps.length} steps exceeds the cap of 8`, 'steps'))
    if (decisions > 2) out.push(issue('U2.cap', `${decisions} decisions exceeds the cap of 2`, 'steps'))
    const depth = maxDepth(p.steps.map((s) => s.id), p.transitions)
    if (depth > 8) out.push(issue('U2.cap', `flow depth ${depth} exceeds what fits a phone`, 'transitions'))
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    const ids = p.steps.map((s) => s.id)
    const idSet = new Set(ids)
    for (const t of p.transitions) {
      for (const end of [t.from, t.to]) {
        if (!idSet.has(end)) {
          out.push(issue('process_flow.endpoint', `transition references unknown step "${end}"`, `${t.from}->${t.to}`))
        }
      }
    }
    if (!isDag(ids, p.transitions)) {
      out.push(issue('process_flow.dag', 'transitions must form a directed acyclic graph', 'transitions'))
    }
    for (const s of p.steps) {
      if (s.kind !== 'decision') continue
      const outgoing = p.transitions.filter((t) => t.from === s.id)
      if (outgoing.length !== 2) {
        out.push(issue('process_flow.decision_arity',
          `decision "${s.label || s.id}" has ${outgoing.length} outgoing transitions, needs exactly 2`, s.id))
      }
      for (const t of outgoing) {
        if (!t.condition) {
          out.push(issue('process_flow.decision_condition',
            `transition out of decision "${s.label || s.id}" has no condition`, `${t.from}->${t.to}`))
        }
      }
    }
    const entry = ids.filter((id) => !p.transitions.some((t) => t.to === id))
    if (entry.length !== 1) {
      out.push(issue('process_flow.single_entry',
        `expected exactly one step with no incoming transition, found ${entry.length}`, 'steps'))
    }
    return out
  },
}
