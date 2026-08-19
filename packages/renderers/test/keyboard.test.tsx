// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type Arrangement, grade, toClient } from '@tya/schema'
import { fiscalVsMonetary, heartChambers, sqlQueryFlow } from '../../schema/src/fixtures/index.js'
import { Visual } from '@tya/renderers'

// Vitest globals are off, so React Testing Library's automatic cleanup
// does not register itself.
afterEach(cleanup)

/**
 * visual-system-spec.md §9 and §10: every assess task must be
 * completable with the keyboard alone.
 */

describe('keyboard path', () => {
  it('places a label into a diagram slot with Tab and Enter only', async () => {
    const user = userEvent.setup()
    const attempts: Arrangement[] = []
    render(
      <Visual
        spec={toClient(heartChambers, 'assess')}
        mode="assess"
        width={375}
        onAttempt={(a) => attempts.push(a)}
      />,
    )

    // Slots come first in tab order, then the bank, then Check.
    const slots = screen.getAllByRole('button', { name: /empty position/i })
    expect(slots).toHaveLength(2)

    await user.tab()
    expect(document.activeElement).toBe(slots[0])

    const chip = screen.getByRole('button', { name: 'Right ventricle' })
    chip.focus()
    await user.keyboard('{Enter}')
    expect(chip.getAttribute('aria-pressed')).toBe('true')

    slots[0]!.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: /Right ventricle, in position 1 of 2/i })).toBeTruthy()

    screen.getByRole('button', { name: 'Check' }).focus()
    await user.keyboard('{Enter}')

    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toEqual({ kind: 'slots', slots: { r3: 'Right ventricle' } })
  })

  it('reorders a flow with the arrow buttons and submits the learner order', async () => {
    const user = userEvent.setup()
    const attempts: Arrangement[] = []
    render(
      <Visual
        spec={toClient(sqlQueryFlow, 'assess')}
        mode="assess"
        width={375}
        onAttempt={(a) => attempts.push(a)}
      />,
    )

    const up = screen.getAllByRole('button', { name: /move .* earlier/i })
    up[1]!.focus()
    await user.keyboard('{Enter}')

    screen.getByRole('button', { name: 'Check' }).focus()
    await user.keyboard('{Enter}')

    expect(attempts).toHaveLength(1)
    const submitted = attempts[0]!
    expect(submitted.kind).toBe('order')
    // The server, not the client, decides whether that order is right.
    expect(typeof grade(sqlQueryFlow, submitted).correct).toBe('boolean')
  })

  it('announces each slot as a numbered position for a screen reader', () => {
    render(<Visual spec={toClient(heartChambers, 'assess')} mode="assess" width={375} />)
    expect(screen.getByRole('button', { name: /Empty position 2 of 2/i })).toBeTruthy()
  })
})

describe('the shell', () => {
  it('keeps the text equivalent in the DOM and points aria-describedby at it', () => {
    const { container } = render(
      <Visual spec={toClient(fiscalVsMonetary, 'teach')} mode="teach" width={375} />,
    )
    const te = container.querySelector('#vis_matrix_policy-te')
    expect(te?.textContent).toContain('Fiscal policy is set by the legislature')
    const table = container.querySelector('table')
    expect(table?.getAttribute('aria-describedby')).toBe(te?.id)
  })

  it('redacts the answers from the text equivalent in assess mode', () => {
    const { container } = render(
      <Visual spec={toClient(fiscalVsMonetary, 'assess')} mode="assess" width={375} />,
    )
    const te = container.querySelector('#vis_matrix_policy-te')?.textContent ?? ''
    expect(te.toLowerCase()).not.toContain('central bank')
    // and still reads as prose about relationships
    expect(te).toContain('Fiscal policy is set by the legislature')
  })

  it('stacks the matrix into cards below 360px', () => {
    const { container } = render(
      <Visual spec={toClient(fiscalVsMonetary, 'teach')} mode="teach" width={320} />,
    )
    expect(container.querySelector('.tya__cards')).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
  })

  it('falls back to the text equivalent when a renderer throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = { ...toClient(fiscalVsMonetary, 'teach'), payload: null }
    const { container } = render(<Visual spec={broken} mode="teach" width={375} />)
    expect(container.textContent).toContain('Fiscal policy is set by the legislature')
    spy.mockRestore()
  })
})
