import type { z } from 'zod'
import type { Issue, Label, VisualType } from './base.js'

/**
 * One definition per component type.  Everything generic — the client
 * serializer, the validator, the grader — reaches components only
 * through this interface, so adding a ninth component is one file plus
 * one registry line.
 */
export interface ComponentDef<P = any> {
  type: VisualType
  /** Input type is left open because several payloads use `.default()`. */
  payload: z.ZodType<P, z.ZodTypeDef, any>
  /** Assess task enum from visual-system-spec.md §3. */
  tasks: readonly string[]
  /** Tasks whose answer is the element order rather than slot contents. */
  orderTasks: readonly string[]
  /** Element caps from §3.  Exceeding one fails validation (§1.5). */
  caps: Readonly<Record<string, number>>
  /** Per-label-kind character limits, enforced by universal rule U4. */
  labelLimits: Readonly<Record<string, number>>

  /** Every label in the payload, tagged with the element that owns it. */
  labels(p: P): Label[]
  /** Element ids that may legally appear in `assess.removed`. */
  slotIds(p: P): string[]
  /** Element ids in payload order.  Empty for components with no order task. */
  ordering(p: P): string[]
  /** Return a payload whose elements follow `order`. */
  reorder(p: P, order: string[]): P
  /** Blank the labels of the removed elements. */
  strip(p: P, removed: string[]): P
  /** §1.5 element caps. */
  checkCaps(p: P): Issue[]
  /** The per-component rules listed under each type in §3. */
  checkRules(p: P): Issue[]
}

export const issue = (rule: string, message: string, path?: string): Issue =>
  path === undefined ? { rule, message } : { rule, message, path }
