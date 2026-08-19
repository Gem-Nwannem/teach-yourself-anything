# Teach Yourself Anything

A Duolingo-shaped learning app where the exercise *is* the visual. One generated
spec per concept renders in three modes — `teach`, `practice`, `assess` — so what
a learner is tested on is literally the same object they were taught from.

This repository currently contains the foundation layer: the shared schema, the
eight visual components, the validation package, and the answer boundary. See
**Status** for what is not here yet.

## Packages

| Package | Contents |
|---|---|
| `packages/schema` | Zod schemas for all eight visual types, the assess/answer model, universal validation rules U1–U8, the client serializer, and server-side grading |
| `packages/renderers` | Pure `layout(spec, width)` functions, universal rule U9, and the React renderers with the shared shell |

The schema exists exactly once and is imported by everything else, per
`core-technical-spec.md` §1. A schema defined twice drifts within a month.

## Commands

```bash
npm install
npm test          # 101 tests
npm run typecheck
```

## What is enforced, and where

**The answer boundary** (`serialize.ts`). `toClient` is an explicit allowlist,
never field deletion — deletion fails open the moment someone adds a column. In
`assess` mode it does three things:

1. blanks the removed elements,
2. re-emits ordering tasks in a seeded shuffle, because for those tasks the
   array order *is* the answer, and
3. redacts the answers from the text equivalent.

`test/answer-leak.test.ts` asserts all three over every fixture.

**Layout purity** (`packages/renderers/src/layout`). Geometry is a pure function
of `(spec, width)`: no randomness, no DOM measurement, no animation state. Text
width uses the deterministic estimate from the spec, `0.55 × fontSize ×
charCount`. The purity test runs each fixture 200 times and compares bytes.

**The nine universal rules.** `validateVisual` covers U1–U8; `validateGeometry`
covers U9 because it needs the layout functions. `validateFully` runs all nine —
the same code path server-side before publish and in the client renderer as a
defensive check.

**Accessibility.** Slots and bank chips are real `<button>` elements positioned
over the SVG, not SVG shapes with click handlers. Every assess task is
completable with the keyboard alone, asserted in `test/keyboard.test.tsx`.

## Decisions this code makes that the specs left open

Each of these came out of writing the validator and finding that the fixtures
did not pass it.

**The text equivalent is redacted, not withheld, in assess mode.** §1.4 requires
a text equivalent on every visual and §9 requires it in the DOM always; §8 rule 6
requires that no answer reach the client in assess mode. Those collide head-on —
a relationship-bearing alternative to "label the ventricles" names the
ventricles. Withholding the field would hand a screen-reader user a harder task
than everyone else, so the answers are replaced in place: "passes to the blank
and out to the lungs". Validation rejects a text equivalent that redaction
destroys, so the fallback is a rewrite, not a silent degradation.

**Ordering tasks ship shuffled.** The gallery shuffled client-side from the
payload, which means the payload carried the answer. The shuffle now happens
server-side, seeded by the spec id so a retry, a refresh, and a second device
all show the same arrangement.

**"Every region reachable via connectors" means no isolated region.** Read as
"one connected component", the rule rejects a correct heart diagram, which has
two circuits. Implemented as an isolation check.

**Matrix row and column headers are exempt from claim tracing.** "Who decides"
carries no factual claim. U5 applies to content labels: nodes, steps, cells,
events, regions, stages, periods.

**Every interactive element is laid out at 44 × 44 minimum**, which sets the
node heights rather than the other way round — the constraint in §6 that
actually drives the caps in §3.

## Fixture changes from `visual-components.html`

The gallery is the reference implementation and most of it ported directly. Four
fixtures needed changes to pass validation:

1. `concept_map` edges carry a `relation` from the §3.1 enum; the gallery had
   only the display label.
2. The heart diagram's distractor bank no longer contains "Right atrium", which
   is visible in the diagram — that is an answer leak under U6, and the test
   suite keeps a case proving the validator catches it.
3. `quant_chart` points live in a `Dataset` with a `source_id` rather than inline
   in the payload; §3.7 says the model never emits data points.
4. Every fixture carries `claim_refs` that resolve, so U5 has something to check.

## Status

Built:

- [x] Shared schema package, all eight component types
- [x] Universal validation U1–U9 and the per-component rules from §3
- [x] Answer boundary, serializer, and server-side grading
- [x] Layout functions for the five SVG components
- [x] React renderers, shared shell, interaction grammar, keyboard path
- [x] One golden fixture per type (§10 asks for three)

Not built:

- [ ] Next.js app, API routes, Supabase schema and RLS
- [ ] The generation pipeline (stages 1–11)
- [ ] Mastery state machine, FSRS scheduler, review queue
- [ ] Drag-to-order as a fallback for the arrow buttons
- [ ] Motion per §4.2
