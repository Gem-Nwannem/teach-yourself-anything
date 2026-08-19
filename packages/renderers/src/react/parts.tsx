import * as React from 'react'
import type { Geometry, LaidOutElement } from '../geometry.js'

export type Verdict = 'correct' | 'incorrect' | 'missing' | undefined

/**
 * The SVG frame plus the HTML buttons that sit over it.
 *
 * §9: interactive elements are real focusable buttons in tab order, not
 * SVG shapes with click handlers. The buttons are positioned absolutely
 * over the drawing using the same geometry, so keyboard order follows
 * document order and hit areas stay 44px.
 */
export function SvgFrame({
  geometry, label, role, children, slots,
}: {
  geometry: Geometry
  label: string
  role: 'img' | 'group'
  children: React.ReactNode
  slots?: React.ReactNode
}) {
  return (
    <div className="tya__stage" style={{ height: geometry.height }}>
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role={role}
        aria-label={label}
        focusable="false"
      >
        <defs>
          <marker id="tya-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.2" orient="auto">
            <path d="M0,0 L7,3.2 L0,6.4 z" fill="var(--line)" />
          </marker>
        </defs>
        {geometry.paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={`var(--${p.tone})`}
            strokeWidth={p.tone === 'core' ? 2.4 : 1.6}
            strokeDasharray={p.dashed ? '4 3' : undefined}
            markerEnd={p.arrow ? 'url(#tya-arrow)' : undefined}
          />
        ))}
        {children}
        {geometry.texts.map((t) => (
          <text
            key={t.id}
            x={t.x}
            y={t.y}
            textAnchor={t.anchor}
            fontSize={t.size}
            fill={`var(--${t.tone})`}
            transform={t.rotate ? `rotate(${t.rotate} ${t.x} ${t.y})` : undefined}
          >
            {t.text}
          </text>
        ))}
      </svg>
      {slots}
    </div>
  )
}

/** A label drawn inside an element box, wrapped by the layout. */
export function ElementLabel({ element, weight = 400, size = 12 }: {
  element: LaidOutElement
  weight?: number
  size?: number
}) {
  const cx = element.box.x + element.box.w / 2
  const cy = element.box.y + element.box.h / 2
  const first = cy - ((element.lines.length - 1) * size * 0.62)
  return (
    <>
      {element.lines.map((line, i) => (
        <text
          key={`${element.id}:${i}`}
          x={cx}
          y={first + i * size * 1.15 + size * 0.34}
          textAnchor="middle"
          fontSize={size}
          fontWeight={weight}
          fill="var(--ink)"
        >
          {line}
        </text>
      ))}
    </>
  )
}

/**
 * An empty position the learner fills. Keyboard path per §9: Tab to a
 * chip, Enter to pick it up, Tab to a slot, Enter to place, Escape to
 * cancel.
 */
export function Slot({
  id, box, filled, verdict, index, total, onActivate,
}: {
  id: string
  box: { x: number; y: number; w: number; h: number }
  filled?: string
  verdict?: Verdict
  index: number
  total: number
  onActivate: (id: string) => void
}) {
  const className = [
    'tya__slot',
    filled ? 'tya__slot--filled' : '',
    verdict === 'correct' ? 'tya__slot--correct' : '',
    verdict === 'incorrect' ? 'tya__slot--incorrect' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={className}
      data-slot={id}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onClick={() => onActivate(id)}
      aria-label={filled
        ? `${filled}, in position ${index + 1} of ${total}. Activate to remove.`
        : `Empty position ${index + 1} of ${total}. Activate to place the selected label.`}
    >
      {filled ?? ''}
    </button>
  )
}

/** The label bank. Tap to select, tap again to deselect. §4. */
export function Bank({ labels, picked, used, onPick }: {
  labels: string[]
  picked: string | null
  used: Set<string>
  onPick: (label: string | null) => void
}) {
  return (
    <div className="tya__bank" role="group" aria-label="Labels to place">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          className="tya__chip"
          aria-pressed={picked === label}
          disabled={used.has(label)}
          onClick={() => onPick(picked === label ? null : label)}
          onKeyDown={(e) => { if (e.key === 'Escape') onPick(null) }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Shared ordering interaction for order_steps, order_events, order_stages. */
export function OrderList({ items, verdicts, onMove }: {
  items: { id: string; label: string }[]
  verdicts?: Record<string, Verdict>
  onMove: (from: number, to: number) => void
}) {
  return (
    <ol className="tya__order">
      {items.map((item, i) => (
        <li key={item.id} data-verdict={verdicts?.[item.id]}>
          <span>{item.label}</span>
          <button
            type="button"
            onClick={() => onMove(i, i - 1)}
            disabled={i === 0}
            aria-label={`Move ${item.label} earlier, currently ${i + 1} of ${items.length}`}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(i, i + 1)}
            disabled={i === items.length - 1}
            aria-label={`Move ${item.label} later, currently ${i + 1} of ${items.length}`}
            style={{ marginLeft: 0 }}
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  )
}
