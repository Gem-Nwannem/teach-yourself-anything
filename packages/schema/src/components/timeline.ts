import { z } from 'zod'
import type { Issue, Label } from '../base.js'
import { type ComponentDef, issue } from '../registry.js'

export const TimelinePayload = z.object({
  events: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    /** Display string. "c. 1500 BCE" and "Q3 1929" both work. */
    when: z.string(),
    /** Numeric sort key the layout uses. */
    sort: z.number(),
    kind: z.enum(['event', 'period_start', 'period_end']).default('event'),
  })).min(2),
  periods: z.array(z.object({
    id: z.string().min(1),
    label: z.string(),
    from: z.string().min(1),
    to: z.string().min(1),
  })).default([]),
  causal_links: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
  })).default([]),
})
export type TimelinePayload = z.infer<typeof TimelinePayload>

export const timeline: ComponentDef<TimelinePayload> = {
  type: 'timeline',
  payload: TimelinePayload,
  tasks: ['order_events', 'place_on_axis', 'identify_cause'],
  orderTasks: ['order_events', 'place_on_axis'],
  caps: { events: 8, periods: 3, causal_links: 4 },
  labelLimits: { event: 40, when: 14, period: 28, link: 20 },

  labels: (p) => [
    ...p.events.flatMap((e): Label[] => [
      { id: e.id, text: e.label, kind: 'event' },
      { id: `${e.id}:when`, text: e.when, kind: 'when' },
    ]),
    ...p.periods.map((x): Label => ({ id: x.id, text: x.label, kind: 'period' })),
    ...p.causal_links.flatMap((l): Label[] =>
      l.label ? [{ id: `${l.from}->${l.to}`, text: l.label, kind: 'link' }] : []),
  ],
  slotIds: (p) => p.events.map((e) => e.id),
  ordering: (p) => p.events.map((e) => e.id),
  reorder: (p, order) => ({ ...p, events: order.flatMap((id) => p.events.filter((e) => e.id === id)) }),
  strip: (p, removed) => {
    const gone = new Set(removed)
    return { ...p, events: p.events.map((e) => (gone.has(e.id) ? { ...e, label: '' } : e)) }
  },

  checkCaps: (p) => {
    const out: Issue[] = []
    if (p.events.length > 8) out.push(issue('U2.cap', `${p.events.length} events exceeds the cap of 8`, 'events'))
    if (p.periods.length > 3) out.push(issue('U2.cap', `${p.periods.length} periods exceeds the cap of 3`, 'periods'))
    if (p.causal_links.length > 4) {
      out.push(issue('U2.cap', `${p.causal_links.length} causal links exceeds the cap of 4`, 'causal_links'))
    }
    return out
  },

  checkRules: (p) => {
    const out: Issue[] = []
    const sorted = [...p.events].sort((a, b) => a.sort - b.sort)
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i]!.sort) <= (sorted[i - 1]!.sort)) {
        out.push(issue('timeline.sort_strict',
          `events "${sorted[i - 1]!.label}" and "${sorted[i]!.label}" share sort key ${sorted[i]!.sort}`, sorted[i]!.id))
      }
    }
    const at = new Map(p.events.map((e) => [e.id, e.sort]))
    for (const period of p.periods) {
      const a = at.get(period.from)
      const b = at.get(period.to)
      if (a === undefined || b === undefined) {
        out.push(issue('timeline.period_endpoint', `period "${period.label}" references an unknown event`, period.id))
        continue
      }
      if (!(a < b)) {
        out.push(issue('timeline.period_direction', `period "${period.label}" does not run forward in time`, period.id))
      }
    }
    for (const link of p.causal_links) {
      const a = at.get(link.from)
      const b = at.get(link.to)
      if (a === undefined || b === undefined) {
        out.push(issue('timeline.link_endpoint', 'causal link references an unknown event', `${link.from}->${link.to}`))
        continue
      }
      if (!(a < b)) {
        out.push(issue('timeline.link_direction', 'a causal link must point forward in time', `${link.from}->${link.to}`))
      }
    }
    return out
  },
}
