import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export interface HierarchyNode {
  id: string
  label: string
  children: HierarchyNode[]
}

const HierarchyNodeSchema: z.ZodType<HierarchyNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    label: z.string(),
    children: z.array(HierarchyNodeSchema).default([]),
  }),
)

export const HierarchyPayload = z.object({ root: HierarchyNodeSchema })
export type HierarchyPayload = z.infer<typeof HierarchyPayload>

/** Depth-first walk. Level 1 is the root, matching the "3 levels" cap. */
export function walkHierarchy(
  n: HierarchyNode,
  level = 1,
  parent: HierarchyNode | null = null,
): { node: HierarchyNode; level: number; parent: HierarchyNode | null }[] {
  return [{ node: n, level, parent }, ...n.children.flatMap((c) => walkHierarchy(c, level + 1, n))]
}

export const hierarchy: ComponentDef<HierarchyPayload> = {
  type: 'hierarchy',
  payload: HierarchyPayload,
  tasks: ['place_into_levels', 'identify_parent', 'find_misplaced'],
  orderTasks: [],
  caps: { nodes: 12, levels: 3, children_per_node: 4 },
  labelLimits: { node: 28 },

  labels: (p) => walkHierarchy(p.root).map(({ node }): Label => ({ id: node.id, text: node.label, kind: 'node' })),
  slotIds: (p) => walkHierarchy(p.root).map(({ node }) => node.id),
  ordering: () => [],
  reorder: (p) => p,
  strip: (p, removed) => {
    const gone = new Set(removed)
    const blank = (n: HierarchyNode): HierarchyNode => ({
      ...n,
      label: gone.has(n.id) ? '' : n.label,
      children: n.children.map(blank),
    })
    return { root: blank(p.root) }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    const all = walkHierarchy(p.root)
    if (all.length > 12) out.push(issue('U2.cap', `${all.length} nodes exceeds the cap of 12`, 'root'))
    const depth = Math.max(...all.map((x) => x.level))
    if (depth > 3) out.push(issue('U2.cap', `depth ${depth} exceeds the cap of 3 levels`, 'root'))
    for (const { node } of all) {
      if (node.children.length > 4) {
        out.push(issue('U2.cap', `node "${node.label || node.id}" has ${node.children.length} children, cap is 4`, node.id))
      }
    }
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    const all = walkHierarchy(p.root)
    const seenIds = new Set<string>()
    const seenLabels = new Map<string, string>()
    for (const { node } of all) {
      if (seenIds.has(node.id)) out.push(issue('hierarchy.duplicate_id', `duplicate node id "${node.id}"`, node.id))
      seenIds.add(node.id)
      const key = node.label.trim().toLowerCase()
      if (key === '') continue
      const prior = seenLabels.get(key)
      if (prior !== undefined) {
        out.push(issue('hierarchy.duplicate_label', `label "${node.label}" appears on more than one node`, node.id))
      } else {
        seenLabels.set(key, node.id)
      }
    }
    return out
  },
}
