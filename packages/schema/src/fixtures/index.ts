import type { VisualSpec } from '../base.js'
import type { Dataset } from '../components/quant-chart.js'

/**
 * The golden fixtures, ported from visual-components.html.
 *
 * Four differences from the gallery, each forced by a rule in §8 that
 * the gallery did not run:
 *
 *  1. concept_map edges carry `relation` from the §3.1 enum. The gallery
 *     had only the display label.
 *  2. the heart diagram's distractor bank no longer contains "Right
 *     atrium", which is visible in the diagram — U6 answer leak.
 *  3. quant_chart points live in a Dataset with a source id rather than
 *     inline in the payload — §3.7 says the model never emits data.
 *  4. every fixture carries claim_refs, and CLAIMS below resolves them,
 *     so U5 has something to check against.
 */

export interface Claim {
  id: string
  statement: string
  span_quote: string
  source_id: string
}

const claim = (id: string, statement: string, source_id: string): Claim =>
  ({ id, statement, span_quote: statement, source_id })

export const CLAIMS: Claim[] = [
  // Fiscal vs monetary
  claim('c_policy_actor', 'Fiscal policy is decided by the legislature, while monetary policy is decided by the central bank.', 'src_policy'),
  claim('c_policy_instrument', 'The main instruments are taxes and spending for fiscal policy and the policy rate for monetary policy.', 'src_policy'),
  claim('c_policy_lag', 'Fiscal policy acts over months to years, whereas monetary policy acts over weeks to months.', 'src_policy'),
  // SQL execution
  claim('c_sql_parse', 'The database will parse the query into a syntax tree and then build a plan for executing it.', 'src_sql'),
  claim('c_sql_access', 'Where a usable index exists the planner chooses an index scan, otherwise it performs a sequential scan.', 'src_sql'),
  claim('c_sql_assemble', 'Both access paths feed the step that will assemble the result rows returned to the caller.', 'src_sql'),
  // Haitian Revolution
  claim('c_haiti_1791', 'A slave uprising began in the north of the colony in 1791.', 'src_haiti'),
  claim('c_haiti_1794', 'France abolishes slavery in its colonies by decree in 1794.', 'src_haiti'),
  claim('c_haiti_1801', 'Toussaint Louverture governs the colony under a constitution promulgated in 1801.', 'src_haiti'),
  claim('c_haiti_1802', 'In 1802 Napoleon moves to restore slavery, which triggers the war of independence.', 'src_haiti'),
  claim('c_haiti_1804', 'Independence is declared on the first day of 1804.', 'src_haiti'),
  // Opportunity cost
  claim('c_oc_scarcity', 'Scarcity forces choice, and every choice carries an opportunity cost.', 'src_econ'),
  claim('c_oc_measure', 'Opportunity cost is measured as the value of the next best alternative forgone.', 'src_econ'),
  claim('c_oc_sunk', 'A sunk cost is already spent and is irrelevant to the decision at hand.', 'src_econ'),
  // Classification
  claim('c_bio_chordata', 'The phylum Chordata contains the classes Mammalia, Aves and Reptilia.', 'src_bio'),
  claim('c_bio_mammalia', 'Mammalia contains the orders Primates and Carnivora among others.', 'src_bio'),
  // Heart
  claim('c_heart_right', 'Deoxygenated blood enters the right atrium and passes to the right ventricle, which pumps it to the lungs.', 'src_heart'),
  claim('c_heart_left', 'Oxygenated blood returns to the left atrium, passes to the left ventricle, and leaves through the aorta to the body.', 'src_heart'),
  // Investment
  claim('c_inv_rate', 'Business investment falls as the interest rate rises, because fewer projects clear a higher cost of capital.', 'src_macro'),
  // Mitosis
  claim('c_mitosis_early', 'In prophase the chromosomes condense and the spindle begins to form; in metaphase they align on the equatorial plate.', 'src_cell'),
  claim('c_mitosis_late', 'In anaphase sister chromatids are pulled to opposite poles; in telophase the nuclear membrane reforms.', 'src_cell'),
]

export const CLAIM_INDEX = new Map(CLAIMS.map((c) => [c.id, c]))

export const DATASETS: Dataset[] = [
  {
    id: 'ds_investment',
    label: 'Investment against the interest rate, by sensitivity',
    unit_x: '%',
    unit_y: '$bn',
    source_id: 'src_macro',
    points: [
      { x: 0, y: 100, k: 1 }, { x: 2, y: 94, k: 1 }, { x: 4, y: 88, k: 1 }, { x: 6, y: 83, k: 1 },
      { x: 8, y: 79, k: 1 }, { x: 10, y: 76, k: 1 }, { x: 12, y: 74, k: 1 },
      { x: 0, y: 100, k: 2 }, { x: 2, y: 86, k: 2 }, { x: 4, y: 72, k: 2 }, { x: 6, y: 60, k: 2 },
      { x: 8, y: 52, k: 2 }, { x: 10, y: 47, k: 2 }, { x: 12, y: 44, k: 2 },
      { x: 0, y: 100, k: 3 }, { x: 2, y: 74, k: 3 }, { x: 4, y: 54, k: 3 }, { x: 6, y: 39, k: 3 },
      { x: 8, y: 30, k: 3 }, { x: 10, y: 25, k: 3 }, { x: 12, y: 22, k: 3 },
    ],
  },
]

export const DATASET_INDEX = new Map(DATASETS.map((d) => [d.id, d]))

export const fiscalVsMonetary: VisualSpec = {
  id: 'vis_matrix_policy',
  type: 'comparison_matrix',
  purpose: 'Separate fiscal from monetary policy by actor, instrument and lag rather than by goal.',
  concepts: ['con_fiscal_policy', 'con_monetary_policy'],
  claim_refs: ['c_policy_actor', 'c_policy_instrument', 'c_policy_lag'],
  dataset_ref: null,
  caption: 'Two levers, two very different actors and lags.',
  text_equivalent:
    'Fiscal policy is set by the legislature through taxes and spending and acts over months to years, whereas monetary policy is set by the central bank through the policy rate and acts over weeks to months.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    row_labels: ['Who decides', 'Main instrument', 'Typical lag'],
    col_labels: ['Fiscal', 'Monetary'],
    cells: [
      ['Legislature', 'Central bank'],
      ['Taxes and spending', 'Policy rate'],
      ['Months to years', 'Weeks to months'],
    ],
  },
  assess: {
    task: 'fill_cells',
    removed: ['0-1', '1-0', '2-1'],
    bank: ['Central bank', 'Taxes and spending', 'Weeks to months', 'Treasury department', 'Reserve ratio'],
    answer_key: {
      kind: 'slots',
      slots: { '0-1': 'Central bank', '1-0': 'Taxes and spending', '2-1': 'Weeks to months' },
    },
    misconceptions: {
      'Treasury department': 'The Treasury executes fiscal policy but does not set monetary policy — that is the central bank.',
      'Reserve ratio': 'Reserve ratios are one monetary tool, but the primary instrument is the policy rate.',
    },
    correct_feedback: 'Correct. The actor is what separates these two, not the goal.',
  },
}

export const sqlQueryFlow: VisualSpec = {
  id: 'vis_flow_sql',
  type: 'process_flow',
  purpose: 'Show that planning precedes access, so an index added later still helps.',
  concepts: ['con_query_planner'],
  claim_refs: ['c_sql_parse', 'c_sql_access', 'c_sql_assemble'],
  dataset_ref: null,
  caption: 'The planner decides before anything touches disk.',
  text_equivalent:
    'A query is parsed, then planned; if a usable index exists the engine performs an index scan, otherwise it falls back to a sequential scan, and either path feeds the result assembly step.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    steps: [
      { id: 's1', label: 'Parse the query', kind: 'step' },
      { id: 's2', label: 'Build a plan', kind: 'step' },
      { id: 's3', label: 'Usable index?', kind: 'decision' },
      { id: 's4', label: 'Index scan', kind: 'step' },
      { id: 's5', label: 'Sequential scan', kind: 'step' },
      { id: 's6', label: 'Assemble result', kind: 'output' },
    ],
    transitions: [
      { from: 's1', to: 's2' },
      { from: 's2', to: 's3' },
      { from: 's3', to: 's4', condition: 'yes' },
      { from: 's3', to: 's5', condition: 'no' },
      { from: 's4', to: 's6' },
      { from: 's5', to: 's6' },
    ],
  },
  assess: {
    task: 'order_steps',
    removed: [],
    bank: [],
    answer_key: { kind: 'order', order: ['s1', 's2', 's3', 's4', 's5', 's6'] },
    misconceptions: {},
    correct_feedback: 'Correct. Planning always precedes access — that is why an index added later still helps.',
  },
}

export const haitianRevolution: VisualSpec = {
  id: 'vis_timeline_haiti',
  type: 'timeline',
  purpose: 'Fix the order of the revolution so the causal story holds together.',
  concepts: ['con_haitian_revolution'],
  claim_refs: ['c_haiti_1791', 'c_haiti_1794', 'c_haiti_1801', 'c_haiti_1802', 'c_haiti_1804'],
  dataset_ref: null,
  caption: 'Thirteen years from uprising to independence.',
  text_equivalent:
    'A slave uprising in 1791 prompted France to abolish slavery in 1794; Napoleon attempted to restore it in 1802, which triggered the final war and independence in 1804.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    events: [
      { id: 'e1', label: 'Slave uprising in the north', when: '1791', sort: 1791, kind: 'event' },
      { id: 'e2', label: 'France abolishes slavery', when: '1794', sort: 1794, kind: 'event' },
      { id: 'e3', label: 'Louverture governs the colony', when: '1801', sort: 1801, kind: 'event' },
      { id: 'e4', label: 'Napoleon moves to restore slavery', when: '1802', sort: 1802, kind: 'event' },
      { id: 'e5', label: 'Independence declared', when: '1804', sort: 1804, kind: 'event' },
    ],
    periods: [{ id: 'p1', label: 'War of independence', from: 'e4', to: 'e5' }],
    causal_links: [
      { from: 'e1', to: 'e2', label: 'prompts' },
      { from: 'e4', to: 'e5', label: 'triggers' },
    ],
  },
  assess: {
    task: 'order_events',
    removed: [],
    bank: [],
    answer_key: { kind: 'order', order: ['e1', 'e2', 'e3', 'e4', 'e5'] },
    misconceptions: {},
    correct_feedback: 'Correct. Abolition came before Louverture governed — the order matters for the causal story.',
  },
}

export const opportunityCost: VisualSpec = {
  id: 'vis_map_opportunity_cost',
  type: 'concept_map',
  purpose: 'Distinguish opportunity cost from money spent, and from sunk cost.',
  concepts: ['con_opportunity_cost'],
  claim_refs: ['c_oc_scarcity', 'c_oc_measure', 'c_oc_sunk'],
  dataset_ref: null,
  caption: 'Scarcity forces a choice; the choice has a cost you never pay in cash.',
  text_equivalent:
    'Scarcity requires choice; choice creates opportunity cost, which is the value of the next-best forgone alternative, and this is distinct from sunk cost, which is already spent and irrelevant to the decision.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    nodes: [
      { id: 'n1', label: 'Scarcity', role: 'supporting' },
      { id: 'n2', label: 'Choice', role: 'supporting' },
      { id: 'n3', label: 'Opportunity cost', role: 'core' },
      { id: 'n4', label: 'Next-best forgone', role: 'supporting' },
      { id: 'n5', label: 'Sunk cost', role: 'example' },
    ],
    edges: [
      { from: 'n1', to: 'n2', relation: 'requires', label: 'forces' },
      { from: 'n2', to: 'n3', relation: 'causes', label: 'creates' },
      { from: 'n3', to: 'n4', relation: 'part_of', label: 'measured as' },
      { from: 'n3', to: 'n5', relation: 'contrasts_with', label: 'not' },
    ],
  },
  assess: {
    task: 'place_labels',
    removed: ['n3', 'n4'],
    bank: ['Opportunity cost', 'Next-best forgone', 'Total expenditure', 'Marginal utility'],
    answer_key: { kind: 'slots', slots: { n3: 'Opportunity cost', n4: 'Next-best forgone' } },
    misconceptions: {
      'Total expenditure': 'Opportunity cost is not what you spent — it is the value of what you gave up.',
      'Marginal utility': 'Marginal utility describes the benefit of one more unit, not the cost of the road not taken.',
    },
    correct_feedback: 'Correct. The cost is the forgone alternative, not the money.',
  },
}

export const biologicalClassification: VisualSpec = {
  id: 'vis_hierarchy_chordata',
  type: 'hierarchy',
  purpose: 'Show containment: each rank includes every rank beneath it.',
  concepts: ['con_taxonomy'],
  claim_refs: ['c_bio_chordata', 'c_bio_mammalia'],
  dataset_ref: null,
  caption: 'Each level contains every level beneath it.',
  text_equivalent:
    'The phylum Chordata contains the classes Mammalia, Aves and Reptilia; Mammalia in turn contains the orders Primates and Carnivora.',
  modes_supported: ['teach'],
  payload: {
    root: {
      id: 'h1',
      label: 'Chordata (phylum)',
      children: [
        {
          id: 'h2',
          label: 'Mammalia',
          children: [
            { id: 'h5', label: 'Primates', children: [] },
            { id: 'h6', label: 'Carnivora', children: [] },
          ],
        },
        { id: 'h3', label: 'Aves', children: [] },
        { id: 'h4', label: 'Reptilia', children: [] },
      ],
    },
  },
}

export const heartChambers: VisualSpec = {
  id: 'vis_diagram_heart',
  type: 'labeled_diagram',
  purpose: 'Fix which chambers receive and which pump, using position rather than illustration.',
  concepts: ['con_heart_circulation'],
  claim_refs: ['c_heart_right', 'c_heart_left'],
  dataset_ref: null,
  caption: 'Structure shown as spatial arrangement, not anatomical illustration.',
  text_equivalent:
    'Deoxygenated blood enters the right atrium, passes to the right ventricle and out to the lungs; oxygenated blood returns to the left atrium, passes to the left ventricle and out through the aorta to the body.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    regions: [
      { id: 'r1', label: 'Right atrium', function: 'receives deoxygenated blood', grid: { col: 0, row: 0, w: 3, h: 2 } },
      { id: 'r2', label: 'Left atrium', function: 'receives oxygenated blood', grid: { col: 3, row: 0, w: 3, h: 2 } },
      { id: 'r3', label: 'Right ventricle', function: 'pumps blood to the lungs', grid: { col: 0, row: 3, w: 3, h: 2 } },
      { id: 'r4', label: 'Left ventricle', function: 'pumps blood to the body', grid: { col: 3, row: 3, w: 3, h: 2 } },
      { id: 'r5', label: 'To lungs', function: 'pulmonary circulation', grid: { col: 0, row: 6, w: 3, h: 2 } },
      { id: 'r6', label: 'To body (aorta)', function: 'systemic circulation', grid: { col: 3, row: 6, w: 3, h: 2 } },
    ],
    connectors: [
      { from: 'r1', to: 'r3', kind: 'flow' },
      { from: 'r3', to: 'r5', kind: 'flow', label: 'pulmonary' },
      { from: 'r2', to: 'r4', kind: 'flow' },
      { from: 'r4', to: 'r6', kind: 'flow', label: 'aorta' },
    ],
  },
  assess: {
    task: 'label_regions',
    removed: ['r3', 'r4'],
    // "Right atrium" was a distractor in the gallery, but it is also
    // visible as r1 — U6 rejects that. These two are not on the diagram.
    bank: ['Right ventricle', 'Left ventricle', 'Vena cava', 'Pulmonary vein'],
    answer_key: { kind: 'slots', slots: { r3: 'Right ventricle', r4: 'Left ventricle' } },
    misconceptions: {
      'Vena cava': 'The vena cava delivers blood to the right atrium; it is a vessel, not a chamber.',
      'Pulmonary vein': 'The pulmonary vein returns blood from the lungs into the left atrium; it is a vessel, not a chamber.',
    },
    correct_feedback: 'Correct. Ventricles pump out; atria receive.',
  },
}

export const interestAndInvestment: VisualSpec = {
  id: 'vis_chart_investment',
  type: 'quant_chart',
  purpose: 'Let the learner feel how sharply investment responds to the cost of capital.',
  concepts: ['con_investment_demand'],
  claim_refs: ['c_inv_rate'],
  dataset_ref: 'ds_investment',
  caption: 'Move the rate and watch investment respond.',
  text_equivalent:
    'Business investment falls as the interest rate rises, steeply between two and six percent and more gradually above eight percent, because fewer projects clear a higher cost of capital.',
  modes_supported: ['teach', 'practice'],
  payload: {
    chart: 'line',
    x: { label: 'Interest rate (%)', unit: '%' },
    y: { label: 'Investment ($bn)', unit: '$bn' },
    series: [{ id: 'sr1', label: 'Investment', dataset_ref: 'ds_investment' }],
    control: { variable: 'Sensitivity', min: 1, max: 3, step: 1, default: 2 },
  },
}

export const mitosis: VisualSpec = {
  id: 'vis_sequence_mitosis',
  type: 'sequence_model',
  purpose: 'Track what changes at each stage rather than memorising four names.',
  concepts: ['con_mitosis'],
  claim_refs: ['c_mitosis_early', 'c_mitosis_late'],
  dataset_ref: null,
  caption: 'Track what changes at each stage, not just the names.',
  text_equivalent:
    'Across prophase, metaphase, anaphase and telophase the chromosomes condense, align, separate and decondense, while the nuclear membrane dissolves early and reforms at the end.',
  modes_supported: ['teach', 'practice', 'assess'],
  payload: {
    tracked: ['chromosomes', 'nuclear membrane', 'spindle'],
    stages: [
      { id: 'st1', label: 'Prophase', state: 'Chromosomes condense; spindle begins to form', changed: ['chromosomes', 'spindle'] },
      { id: 'st2', label: 'Metaphase', state: 'Chromosomes align on the equatorial plate', changed: ['chromosomes'] },
      { id: 'st3', label: 'Anaphase', state: 'Sister chromatids pulled to opposite poles', changed: ['chromosomes', 'spindle'] },
      { id: 'st4', label: 'Telophase', state: 'Nuclear membrane reforms; chromosomes decondense', changed: ['chromosomes', 'nuclear membrane'] },
    ],
  },
  assess: {
    task: 'order_stages',
    removed: [],
    bank: [],
    answer_key: { kind: 'order', order: ['st1', 'st2', 'st3', 'st4'] },
    misconceptions: {},
    correct_feedback: 'Correct. Alignment always precedes separation.',
  },
}

/** One fixture per component type. §10 asks for three; these are the first. */
export const FIXTURES: VisualSpec[] = [
  fiscalVsMonetary,
  sqlQueryFlow,
  haitianRevolution,
  opportunityCost,
  biologicalClassification,
  heartChambers,
  interestAndInvestment,
  mitosis,
]
