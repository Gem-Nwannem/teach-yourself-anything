import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export const SequenceModelPayload = z.object({
  stages: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    state: z.string(),
    changed: z.array(z.string()).default([]),
  })).min(2),
  tracked: z.array(z.string()).min(1),
})
export type SequenceModelPayload = z.infer<typeof SequenceModelPayload>

export const sequenceModel: ComponentDef<SequenceModelPayload> = {
  type: 'sequence_model',
  payload: SequenceModelPayload,
  tasks: ['order_stages', 'predict_next_state', 'identify_change'],
  orderTasks: ['order_stages'],
  caps: { stages: 6, tracked: 4 },
  labelLimits: { stage: 20, state: 80, tracked: 20 },

  labels: (p) => [
    ...p.stages.flatMap((s): Label[] => [
      { id: s.id, text: s.label, kind: 'stage' },
      { id: `${s.id}:state`, text: s.state, kind: 'state' },
    ]),
    ...p.tracked.map((t, i): Label => ({ id: `tracked-${i}`, text: t, kind: 'tracked' })),
  ],
  slotIds: (p) => p.stages.map((s) => s.id),
  ordering: (p) => p.stages.map((s) => s.id),
  reorder: (p, order) => ({ ...p, stages: order.flatMap((id) => p.stages.filter((s) => s.id === id)) }),
  strip: (p, removed) => {
    const gone = new Set(removed)
    return { ...p, stages: p.stages.map((s) => (gone.has(s.id) ? { ...s, label: '' } : s)) }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    if (p.stages.length > 6) out.push(issue('U2.cap', `${p.stages.length} stages exceeds the cap of 6`, 'stages'))
    if (p.tracked.length > 4) {
      out.push(issue('U2.cap', `${p.tracked.length} tracked properties exceeds the cap of 4`, 'tracked'))
    }
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    const tracked = new Set(p.tracked)
    for (const s of p.stages) {
      for (const c of s.changed) {
        if (!tracked.has(c)) {
          out.push(issue('sequence_model.changed_tracked',
            `stage "${s.label || s.id}" reports a change to "${c}", which is not a tracked property`, s.id))
        }
      }
    }
    const seen = new Map<string, string>()
    for (const s of p.stages) {
      const key = s.state.trim().toLowerCase()
      const prior = seen.get(key)
      if (prior !== undefined) {
        out.push(issue('sequence_model.identical_state',
          `stages "${prior}" and "${s.label || s.id}" describe the same state`, s.id))
      } else {
        seen.set(key, s.label || s.id)
      }
    }
    return out
  },
}
