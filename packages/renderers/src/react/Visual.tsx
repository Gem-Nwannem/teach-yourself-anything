import * as React from 'react'
import type {
  Arrangement, ClientVisual, ComparisonMatrixPayload, ConceptMapPayload, Dataset,
  HierarchyPayload, LabeledDiagramPayload, Mode, ProcessFlowPayload, QuantChartPayload,
  SequenceModelPayload, TimelinePayload,
} from '@tya/schema'
import { walkHierarchy } from '@tya/schema'
import type { Geometry } from '../geometry.js'
import { chartMarkers, layoutVisual } from '../layout/index.js'
import { Bank, ElementLabel, OrderList, Slot, SvgFrame, type Verdict } from './parts.js'

export interface Feedback {
  correct: boolean
  message: string
  per_element?: Record<string, Verdict>
}

export interface VisualProps {
  /** Answer fields are already stripped when mode is 'assess'. */
  spec: ClientVisual
  mode: Mode
  attemptToken?: string
  onAttempt?: (arrangement: Arrangement) => void
  onHint?: (elementId: string) => void
  /** Measured container width in CSS px. */
  width: number
  reducedMotion?: boolean
  datasets?: Map<string, Dataset>
  /** Server verdict. The client never decides correctness itself. */
  feedback?: Feedback
  scheme?: 'light' | 'dark'
}

const ORDER_TASKS = new Set(['order_steps', 'order_events', 'order_stages', 'place_on_axis'])

/* ------------------------------------------------------------------ *
 * Interaction state
 * ------------------------------------------------------------------ */

function useAssessState(spec: ClientVisual, mode: Mode) {
  const isOrder = ORDER_TASKS.has(spec.assess_task ?? '')
  const [picked, setPicked] = React.useState<string | null>(null)
  const [placed, setPlaced] = React.useState<Record<string, string>>({})
  const [order, setOrder] = React.useState<string[] | null>(null)

  // Reset whenever the item changes, so a new block never inherits a
  // previous block's placements.
  React.useEffect(() => {
    setPicked(null)
    setPlaced({})
    setOrder(null)
  }, [spec.id, mode])

  const place = (slot: string) => {
    setPlaced((prev) => {
      if (prev[slot]) {
        const next = { ...prev }
        delete next[slot]
        return next
      }
      if (!picked) return prev
      return { ...prev, [slot]: picked }
    })
    if (!placed[slot] && picked) setPicked(null)
  }

  const move = (ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved as string)
    setOrder(next)
  }

  return { isOrder, picked, setPicked, placed, place, order, setOrder, move }
}

/* ------------------------------------------------------------------ *
 * The shared shell: caption, mode badge, text equivalent, boundary
 * ------------------------------------------------------------------ */

class RendererBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    // §5: a renderer that throws shows the text equivalent, never a
    // broken frame.
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function Visual(props: VisualProps) {
  const { spec, mode, width, feedback, scheme } = props
  const describedBy = `${spec.id}-te`

  return (
    <div className="tya" data-scheme={scheme} style={{ width }}>
      <RendererBoundary
        fallback={<p className="tya__caption">{spec.text_equivalent}</p>}
      >
        <Stage {...props} describedBy={describedBy} />
      </RendererBoundary>
      <p className="tya__caption">
        <span className="tya__badge">{mode}</span> {spec.caption}
      </p>
      <p id={describedBy} className="tya__sr">{spec.text_equivalent}</p>
      {feedback && (
        <p className="tya__feedback" data-tone={feedback.correct ? 'correct' : 'incorrect'} role="status">
          {feedback.message}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

function Stage(props: VisualProps & { describedBy: string }) {
  const { spec, mode, width, datasets, onAttempt, feedback, describedBy } = props
  const state = useAssessState(spec, mode)
  const assessing = mode === 'assess'

  const orderIds = React.useMemo(() => orderedIds(spec), [spec])
  const currentOrder = state.order ?? orderIds

  const geometry = React.useMemo(
    () => layoutVisual(spec.type, spec.payload, width, {
      ...(datasets ? { datasets } : {}),
      sorted: !(assessing && state.isOrder),
    }),
    [spec.type, spec.payload, width, datasets, assessing, state.isOrder],
  )

  const submit = () => {
    if (!onAttempt) return
    onAttempt(state.isOrder
      ? { kind: 'order', order: currentOrder }
      : { kind: 'slots', slots: state.placed })
  }

  const slotProps = {
    placed: state.placed,
    verdicts: feedback?.per_element ?? {},
    onActivate: state.place,
  }

  const body = (() => {
    if (assessing && state.isOrder) {
      return (
        <OrderList
          items={currentOrder.map((id) => ({ id, label: labelOf(spec, id) }))}
          verdicts={feedback?.per_element ?? {}}
          onMove={(from, to) => state.move(currentOrder, from, to)}
        />
      )
    }
    switch (spec.type) {
      case 'concept_map':
        return <ConceptMapView spec={spec} geometry={geometry!} mode={mode} slots={slotProps} describedBy={describedBy} />
      case 'process_flow':
        return <ProcessFlowView spec={spec} geometry={geometry!} mode={mode} slots={slotProps} describedBy={describedBy} />
      case 'timeline':
        return <TimelineView spec={spec} geometry={geometry!} mode={mode} slots={slotProps} describedBy={describedBy} />
      case 'labeled_diagram':
        return <LabeledDiagramView spec={spec} geometry={geometry!} mode={mode} slots={slotProps} describedBy={describedBy} />
      case 'quant_chart':
        return <QuantChartView spec={spec} width={width} datasets={datasets ?? new Map()} describedBy={describedBy} />
      case 'comparison_matrix':
        return <ComparisonMatrixView spec={spec} width={width} mode={mode} slots={slotProps} describedBy={describedBy} />
      case 'hierarchy':
        return <HierarchyView spec={spec} describedBy={describedBy} />
      case 'sequence_model':
        return <SequenceModelView spec={spec} describedBy={describedBy} />
      default:
        return <p className="tya__caption">{spec.text_equivalent}</p>
    }
  })()

  return (
    <>
      {body}
      {assessing && !state.isOrder && spec.assess_bank && (
        <Bank
          labels={spec.assess_bank}
          picked={state.picked}
          used={new Set(Object.values(state.placed))}
          onPick={state.setPicked}
        />
      )}
      {assessing && onAttempt && (
        <div className="tya__bank">
          <button type="button" className="tya__chip" onClick={submit}>Check</button>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Per-type views
 * ------------------------------------------------------------------ */

interface SlotProps {
  placed: Record<string, string>
  verdicts: Record<string, Verdict>
  onActivate: (id: string) => void
}

interface ViewProps {
  spec: ClientVisual
  geometry: Geometry
  mode: Mode
  slots: SlotProps
  describedBy: string
}

function slotNodes(geometry: Geometry, slots: SlotProps) {
  const all = geometry.elements.filter((e) => e.slot)
  return all.map((element, i) => (
    <Slot
      key={element.id}
      id={element.id}
      box={element.box}
      filled={slots.placed[element.id]}
      verdict={slots.verdicts[element.id]}
      index={i}
      total={all.length}
      onActivate={slots.onActivate}
    />
  ))
}

function ConceptMapView({ spec, geometry, mode, slots, describedBy }: ViewProps) {
  return (
    <div aria-describedby={describedBy}>
      <SvgFrame
        geometry={geometry}
        label={spec.caption}
        role={mode === 'teach' ? 'img' : 'group'}
        slots={slotNodes(geometry, slots)}
      >
        {geometry.elements.filter((e) => !e.slot).map((e) => (
          <g key={e.id}>
            <rect
              x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} rx={9}
              fill="var(--surface)"
              stroke={e.kind === 'core_node' ? 'var(--core)' : 'var(--line)'}
              strokeWidth={e.kind === 'core_node' ? 2 : 1.3}
            />
            <ElementLabel element={e} weight={e.kind === 'core_node' ? 600 : 400} />
          </g>
        ))}
      </SvgFrame>
    </div>
  )
}

function ProcessFlowView({ spec, geometry, mode, slots, describedBy }: ViewProps) {
  return (
    <div aria-describedby={describedBy}>
      <SvgFrame
        geometry={geometry}
        label={spec.caption}
        role={mode === 'teach' ? 'img' : 'group'}
        slots={slotNodes(geometry, slots)}
      >
        {geometry.elements.filter((e) => !e.slot).map((e) => {
          const cx = e.box.x + e.box.w / 2
          const cy = e.box.y + e.box.h / 2
          return (
            <g key={e.id}>
              {e.kind === 'decision' ? (
                <path
                  d={`M${cx} ${e.box.y} L${e.box.x + e.box.w} ${cy} L${cx} ${e.box.y + e.box.h} L${e.box.x} ${cy} z`}
                  fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.8}
                />
              ) : (
                <rect
                  x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} rx={9}
                  fill="var(--surface)"
                  stroke={e.kind === 'output' ? 'var(--support)' : 'var(--line)'}
                  strokeWidth={1.4}
                />
              )}
              <ElementLabel element={e} />
            </g>
          )
        })}
      </SvgFrame>
    </div>
  )
}

function TimelineView({ spec, geometry, mode, slots, describedBy }: ViewProps) {
  return (
    <div aria-describedby={describedBy}>
      <SvgFrame
        geometry={geometry}
        label={spec.caption}
        role={mode === 'teach' ? 'img' : 'group'}
        slots={slotNodes(geometry, slots)}
      >
        {geometry.elements.filter((e) => !e.slot).map((e) => (
          <g key={e.id}>
            <circle
              cx={geometry.width * 0.27}
              cy={e.box.y + e.box.h / 2}
              r={6}
              fill="var(--surface)"
              stroke="var(--core)"
              strokeWidth={2.4}
            />
            {e.lines.map((line, i) => (
              <text
                key={`${e.id}:${i}`}
                x={e.box.x}
                y={e.box.y + 16 + i * 14}
                fontSize={12}
                fill="var(--ink)"
              >
                {line}
              </text>
            ))}
          </g>
        ))}
      </SvgFrame>
    </div>
  )
}

function LabeledDiagramView({ spec, geometry, mode, slots, describedBy }: ViewProps) {
  return (
    <div aria-describedby={describedBy}>
      <SvgFrame
        geometry={geometry}
        label={spec.caption}
        role={mode === 'teach' ? 'img' : 'group'}
        slots={slotNodes(geometry, slots)}
      >
        {geometry.elements.filter((e) => !e.slot).map((e) => (
          <g key={e.id}>
            <rect
              x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} rx={8}
              fill="var(--surface)" stroke="var(--core)" strokeWidth={1.6}
            />
            <ElementLabel element={e} weight={600} size={11.5} />
          </g>
        ))}
      </SvgFrame>
    </div>
  )
}

function QuantChartView({ spec, width, datasets, describedBy }: {
  spec: ClientVisual
  width: number
  datasets: Map<string, Dataset>
  describedBy: string
}) {
  const payload = spec.payload as QuantChartPayload
  const [control, setControl] = React.useState(payload.control?.default ?? 0)
  const geometry = layoutVisual(spec.type, payload, width, { datasets, control })!
  const markers = chartMarkers(payload, width, { datasets, control })

  return (
    <div aria-describedby={describedBy}>
      <SvgFrame geometry={geometry} label={spec.caption} role="img">
        {markers.map((m) => (
          <circle key={m.id} cx={m.cx} cy={m.cy} r={3.4} fill="var(--core)" />
        ))}
      </SvgFrame>
      {payload.control && (
        <label style={{ display: 'block', marginTop: 8 }}>
          <input
            type="range"
            style={{ width: '100%' }}
            min={payload.control.min}
            max={payload.control.max}
            step={payload.control.step}
            value={control}
            onChange={(e) => setControl(Number(e.target.value))}
            aria-label={payload.control.variable}
          />
          <span className="tya__caption">
            {payload.control.variable}: <b>{control}</b>{payload.control.unit ?? ''}
          </span>
        </label>
      )}
    </div>
  )
}

function ComparisonMatrixView({ spec, width, mode, slots, describedBy }: {
  spec: ClientVisual
  width: number
  mode: Mode
  slots: SlotProps
  describedBy: string
}) {
  const payload = spec.payload as ComparisonMatrixPayload
  const assessing = mode === 'assess'

  // §3.3: columns become stacked cards below 360px.
  if (width < 360) {
    return (
      <div className="tya__cards" aria-describedby={describedBy}>
        {payload.col_labels.map((col, c) => (
          <section className="tya__card" key={col}>
            <h4>{col}</h4>
            <dl>
              {payload.row_labels.map((row, r) => {
                const key = `${r}-${c}`
                const value = payload.cells[r]?.[c] ?? ''
                return (
                  <React.Fragment key={key}>
                    <dt>{row}</dt>
                    <dd>{value === '' && assessing ? <SlotCell id={key} slots={slots} /> : value}</dd>
                  </React.Fragment>
                )
              })}
            </dl>
          </section>
        ))}
      </div>
    )
  }

  return (
    <table className="tya__table" aria-describedby={describedBy}>
      <caption className="tya__sr">{spec.caption}</caption>
      <thead>
        <tr>
          <td />
          {payload.col_labels.map((c) => <th key={c} scope="col">{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {payload.row_labels.map((row, r) => (
          <tr key={row}>
            <th scope="row">{row}</th>
            {payload.col_labels.map((_, c) => {
              const key = `${r}-${c}`
              const value = payload.cells[r]?.[c] ?? ''
              return (
                <td key={key} data-slot={value === '' && assessing ? key : undefined}>
                  {value === '' && assessing ? <SlotCell id={key} slots={slots} /> : value}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SlotCell({ id, slots }: { id: string; slots: SlotProps }) {
  const filled = slots.placed[id]
  const verdict = slots.verdicts[id]
  return (
    <button
      type="button"
      className={[
        'tya__chip',
        verdict === 'correct' ? 'tya__slot--correct' : '',
        verdict === 'incorrect' ? 'tya__slot--incorrect' : '',
      ].filter(Boolean).join(' ')}
      style={{ width: '100%', minHeight: 44 }}
      onClick={() => slots.onActivate(id)}
      aria-label={filled ? `${filled}. Activate to remove.` : 'Empty cell. Activate to place the selected label.'}
    >
      {filled ?? ''}
    </button>
  )
}

function HierarchyView({ spec, describedBy }: { spec: ClientVisual; describedBy: string }) {
  const payload = spec.payload as HierarchyPayload
  // §3.5: an indented nested list, because a tidy tree does not fit a phone.
  const render = (node: { id: string; label: string; children: unknown[] }): React.ReactElement => (
    <li key={node.id}>
      <span className={`tya__pill ${node.children.length ? 'tya__pill--parent' : ''}`}>{node.label}</span>
      {node.children.length > 0 && (
        <ul>{(node.children as typeof node[]).map(render)}</ul>
      )}
    </li>
  )
  return (
    <ul className="tya__tree" aria-describedby={describedBy}>
      {render(payload.root as never)}
    </ul>
  )
}

function SequenceModelView({ spec, describedBy }: { spec: ClientVisual; describedBy: string }) {
  const payload = spec.payload as SequenceModelPayload
  return (
    <div aria-describedby={describedBy}>
      <div className="tya__film">
        {payload.stages.map((s) => (
          <div key={s.id}><b>{s.label}</b>{s.state}</div>
        ))}
      </div>
      <div className="tya__scrollx">
        <table className="tya__table">
          <caption className="tya__sr">What changes at each stage</caption>
          <thead>
            <tr>
              <td />
              {payload.stages.map((s) => <th key={s.id} scope="col">{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {payload.tracked.map((t) => (
              <tr key={t}>
                <th scope="row">{t}</th>
                {payload.stages.map((s) => (
                  <td key={s.id}>{s.changed.includes(t) ? 'changes' : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function orderedIds(spec: ClientVisual): string[] {
  const p = spec.payload as Partial<ProcessFlowPayload & TimelinePayload & SequenceModelPayload>
  const list = p.steps ?? p.events ?? p.stages ?? []
  return list.map((x) => x.id)
}

function labelOf(spec: ClientVisual, id: string): string {
  const p = spec.payload as Partial<ProcessFlowPayload & TimelinePayload & SequenceModelPayload>
  const list = [...(p.steps ?? []), ...(p.events ?? []), ...(p.stages ?? [])]
  return list.find((x) => x.id === id)?.label ?? id
}

/** Used by the hierarchy view's text fallback and by tests. */
export { walkHierarchy }
export type { ConceptMapPayload, LabeledDiagramPayload }
