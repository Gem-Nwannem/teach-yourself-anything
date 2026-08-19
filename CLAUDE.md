# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Commands

```bash
npm install
npm test              # vitest, 101 tests
npm run typecheck     # tsc -b, must be clean before any commit
npx vitest run packages/schema      # one package
npx vitest watch                    # while iterating
```

There is no linter yet. `npm run typecheck` is the gate.

## What this is

A learning app that turns a topic into an interactive course. The defining
idea, from `visual-system-spec.md` §0: **the exercise is the visual**. One
generated spec per concept renders in three modes — `teach`, `practice`,
`assess` — so a learner is tested on the same object they were taught from.

Four specs govern the work and are the source of truth. When code and spec
disagree, say so rather than silently picking one:

- `scope-v0.2.md` — product scope, release phases, §32 open questions
- `core-technical-spec.md` — stack, schema, API, generation pipeline
- `visual-system-spec.md` — the eight visual components, in full
- `visual-components.html` — the working reference gallery

## Architecture

```
packages/schema      Zod schemas, validation U1-U8, serializer, grading
packages/renderers   layout(spec, width), validation U9, React components
```

**The schema exists exactly once.** Every visual type is defined in
`packages/schema/src/components/` and imported by the generator, the
validator, the API and the renderer. A schema defined twice drifts within a
month — this is the rule in `core-technical-spec.md` §1 and it is not
negotiable.

**Components are reached through one interface.** `ComponentDef` in
`registry.ts` gives every component the same surface: `labels`, `slotIds`,
`ordering`, `strip`, `checkCaps`, `checkRules`. The serializer, validator and
grader touch components only through it, so a ninth component is one file plus
one registry line — never a new branch in three places.

**Layout is a pure function of `(spec, width)`.** No randomness, no DOM
measurement, no animation state. Text width uses the deterministic estimate
`0.55 × fontSize × charCount`. This is what makes visuals reproducible in a
test and identical between a server snapshot and the client. A layout test
runs each fixture 200 times and compares bytes; do not introduce anything that
would break it.

**The answer never reaches the client in assess mode.** `toClient` is an
explicit allowlist in `serialize.ts`, never field deletion — deletion fails
open the moment someone adds a column. Three things happen in assess mode:
removed elements are blanked, ordering tasks are re-emitted in a seeded
shuffle, and the answers are redacted from the text equivalent. If you add a
field to `VisualSpec`, it does not reach a client until you add it to
`CLIENT_VISUAL_FIELDS`, and `test/answer-leak.test.ts` will tell you if that
was a mistake.

**Grading is server-side.** `grade()` needs the answer key, so it never runs
in the browser. The client submits an `Arrangement` and renders the verdict it
gets back.

## Conventions

- TypeScript, ESM, `.js` extensions on relative imports (NodeNext resolution).
- Comments explain why, not what. Cite the spec section when a rule comes from
  one — `§3.6`, `U6` — so the next reader can check it.
- Every new component rule needs a test that fails without it.
- Fixtures live in `packages/schema/src/fixtures/`. They double as the gallery
  and as the input to every validation test.

## Decisions already made

- **Models: Anthropic only.** Sonnet-class for curriculum, lessons and
  visuals; Haiku 4.5 for the high-volume extraction and validation stages.
  Do not add a second vendor without asking.
- **Sequencing: learning loop and research pipeline in parallel.** The schema,
  renderer and validation core depends on neither, which is why it was built
  first.
- **Visual build order** follows `visual-system-spec.md` §11 —
  comparison_matrix, process_flow, timeline, concept_map — not the P0 list in
  scope §6.3, because timeline reuses the flow's ordering interaction and
  concept_map has the hardest layout.

## Decisions still open

These block later phases, not current work. Ask before assuming an answer:

- **§32 Q2** — which 20–40 subjects form the curated shelf, and who reviews them
- **§32 Q4** — cost ceiling per generated course and per month
- **§32 Q9** — the day-4 return target
- Whether short constructed response is in P0 with server grading, or slips to
  P1 with the rubric work

## Where the code departs from the specs

Each of these came from writing the validator and finding the fixtures failed
it. They are documented at length in `README.md`; in short:

1. The text equivalent is **redacted, not withheld**, in assess mode. §1.4 and
   §9 require it always; §8 rule 6 forbids answers on the client. Withholding
   it would hand a screen-reader user a harder task than everyone else.
2. Ordering tasks are shuffled **server-side**, seeded by spec id. The
   gallery shuffled on the client, which meant the payload carried the answer.
3. "Every region reachable via connectors" is read as **no isolated region**.
   A connected-component reading rejects a correct heart diagram.
4. Matrix row and column headers are **exempt from claim tracing**. "Who
   decides" carries no factual claim.

## Not built yet

The Next.js app, API routes, Supabase schema and RLS, the generation pipeline,
the mastery state machine and FSRS scheduler. Nothing in this repository talks
to a database or a model yet.
