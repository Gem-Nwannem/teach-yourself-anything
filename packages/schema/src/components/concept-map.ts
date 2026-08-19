import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export const ConceptRelation = z.enum(['causes', 'requires', 'contrasts_with', 'part_of', 'enables'])

export const ConceptMapPayload = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    role: z.enum(['core', 'supporting', 'example']),
  })).min(2),
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relation: ConceptRelation,
    label: z.string().optional(),
  })).min(1),
})
export type ConceptMapPayload = z.infer<typeof ConceptMapPayload>

const edgeKey = (e: { from: string; to: string }) => `${e.from}->${e.to}`

export const conceptMap: ComponentDef<ConceptMapPayload> = {
  type: 'concept_map',
  payload: ConceptMapPayload,
  tasks: ['place_labels', 'name_relations', 'add_missing_edge'],
  orderTasks: [],
  caps: { nodes: 9, edges: 14, core_max: 3, core_min: 1 },
  labelLimits: { node: 32, edge: 24 },

  labels: (p) => [
    ...p.nodes.map((n): Label => ({ id: n.id, text: n.label, kind: 'node' })),
    ...p.edges.flatMap((e): Label[] =>
      e.label ? [{ id: edgeKey(e), text: e.label, kind: 'edge' }] : []),
  ],
  slotIds: (p) => [...p.nodes.map((n) => n.id), ...p.edges.map(edgeKey)],
  ordering: () => [],
  reorder: (p) => p,
  strip: (p, removed) => {
    const gone = new Set(removed)
    return {
      nodes: p.nodes.map((n) => (gone.has(n.id) ? { ...n, label: '' } : n)),
      edges: p.edges.map((e) => {
        if (!gone.has(edgeKey(e))) return e
        const { label: _drop, ...rest } = e
        return rest
      }),
    }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    const cores = p.nodes.filter((n) => n.role === 'core').length
    if (p.nodes.length > 9) out.push(issue('U2.cap', `${p.nodes.length} nodes exceeds the cap of 9`, 'nodes'))
    if (p.edges.length > 14) out.push(issue('U2.cap', `${p.edges.length} edges exceeds the cap of 14`, 'edges'))
    if (cores < 1) out.push(issue('U2.cap', 'a concept map needs at least one core node', 'nodes'))
    if (cores > 3) out.push(issue('U2.cap', `${cores} core nodes exceeds the cap of 3`, 'nodes'))
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    const ids = new Set(p.nodes.map((n) => n.id))
    const seen = new Set<string>()
    for (const e of p.edges) {
      for (const end of [e.from, e.to]) {
        if (!ids.has(end)) out.push(issue('concept_map.edge_endpoint', `edge references unknown node "${end}"`, edgeKey(e)))
      }
      const k = `${edgeKey(e)}:${e.relation}`
      if (seen.has(k)) out.push(issue('concept_map.duplicate_edge', `duplicate edge ${k}`, edgeKey(e)))
      seen.add(k)
      if (e.from === e.to) out.push(issue('concept_map.self_edge', 'an edge may not start and end on the same node', edgeKey(e)))
    }
    const touched = new Set(p.edges.flatMap((e) => [e.from, e.to]))
    for (const n of p.nodes) {
      if (!touched.has(n.id)) out.push(issue('concept_map.orphan', `node "${n.label || n.id}" has no edges`, n.id))
    }
    return out
  },
}
