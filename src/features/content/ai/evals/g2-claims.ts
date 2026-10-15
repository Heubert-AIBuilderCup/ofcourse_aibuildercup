// The G2 eval: 30 claims over 5 small sources, 10 of them planted. A planted claim looks like the
// source but is not backed by it; the check must not find it. The other 20 are true, and the
// check must find each. Pass bar (build plan, G2): 10 of 10 planted caught, at most 2 false
// alarms. Facts are source sentences copied by code (criterion 95), so what is checked is what a
// post says: each claim as a slide sentence goes to the source check, and a title claim to the
// headline rule (extraction lists a title sentence no paragraph supports, criterion 96). A slide
// sentence is read against the paragraph it is about, standing in for the facts its slot binds
// (ADR-129). Plants whose wrong number is a digit are caught by code (numberVerdict) before any
// model is asked, so only the other plants test a model. Pure: scripts/ai-eval.ts runs it on the
// real models.

import type { Body } from '../../model/artifacts'
import type { ClaimResult, Fact } from '../../model/types'
import { normalise } from '../../text/verbatim'
import type { CheckClaim } from '../source-check'

export type PlantedKind = 'number' | 'unit' | 'generalisation' | 'number_word' | 'title'

export type EvalSource = { id: string; title: string; kind: string; paragraphs: string[] }

export type EvalCase = {
  source: string
  /** One sentence. For a title case, the title of the source itself. */
  claim: string
  /** The 1-based paragraph the claim is about (or, for a plant, would be about). */
  paragraph: number
  planted: PlantedKind | null
  /** True when numberVerdict alone catches this plant. */
  numeric: boolean
}

export const EVAL_SOURCES: EvalSource[] = [
  {
    id: 'bus',
    title: 'A new night bus route for the north campus',
    kind: 'news',
    paragraphs: [
      'The council added a night bus on the north campus route in March. It runs every 30 minutes between 10 pm and 2 am.',
      'In the first eight weeks, 4,200 students rode it. About 15 percent of those trips began after midnight.',
      'Fares stay at AUD 3.20 a trip, the same as the day service. Students with a travel card ride at half price.',
      'The council will review the route in September and says it may extend the hours if demand holds.',
    ],
  },
  {
    id: 'rent',
    title: 'Student rents rise again in two cities',
    kind: 'research summary',
    paragraphs: [
      'A report on student rents in Hobart and Perth found that average weekly rent rose by 8 percent over the year.',
      'In Hobart the average student room cost AUD 285 a week. In Perth it cost AUD 310 a week.',
      'Four in ten students surveyed said they had skipped meals to cover rent. The report did not ask why prices rose.',
      'Landlords were not surveyed, and the authors say the findings describe students, not the whole rental market.',
    ],
  },
  {
    id: 'sleep',
    title: 'Night shifts cut student sleep by 40 percent',
    kind: 'research summary',
    paragraphs: [
      'Researchers followed 240 students who worked night shifts and asked each to keep a sleep diary for 12 weeks.',
      'On shift days, the students slept an average of 5.5 hours, against 7 hours on days off.',
      'Students who worked more than three night shifts a week reported more missed classes.',
      'The study is small and relied on self-reported diaries, so the authors urge caution.',
    ],
  },
  {
    id: 'sport',
    title: 'Joining a sports club improves grades',
    kind: 'research summary',
    paragraphs: [
      'A survey of 900 undergraduates found that members of sports clubs had slightly higher average grades than non-members.',
      'The difference was 2 marks out of 100, and it was smaller for students in their final year.',
      'Club members also reported spending 6 more hours a week on campus.',
      'The authors say the data show a link, and they cannot say whether clubs raise grades or whether keen students join clubs.',
    ],
  },
  {
    id: 'visa',
    title: 'Student visa decisions are getting faster',
    kind: 'news',
    paragraphs: [
      'The department decided 90 percent of student visa applications within 28 days in the latest quarter.',
      'A year earlier, the same share of decisions took 45 days.',
      'Applications from offshore applicants took longer than onshore ones, at a median of 31 days.',
      'The department said staffing, not changes to the rules, explained the improvement.',
    ],
  },
]

const ok = (source: string, paragraph: number, claim: string): EvalCase => ({
  source,
  claim,
  paragraph,
  planted: null,
  numeric: false,
})

const plant = (
  source: string,
  paragraph: number,
  planted: PlantedKind,
  numeric: boolean,
  claim: string,
): EvalCase => ({ source, claim, paragraph, planted, numeric })

export const EVAL_CASES: EvalCase[] = [
  // bus: a changed number, a generalisation
  ok('bus', 1, 'It runs every 30 minutes between 10 pm and 2 am.'),
  ok('bus', 1, 'The night bus on the north campus route started in March.'),
  ok('bus', 3, 'Fares stay at AUD 3.20 a trip.'),
  ok('bus', 3, 'Students with a travel card pay half price.'),
  plant('bus', 2, 'number', true, 'In the first eight weeks, 5,200 students rode it.'),
  plant('bus', 2, 'generalisation', false, 'Most trips began after midnight.'),

  // rent: a changed unit, a changed number word
  ok('rent', 2, 'In Hobart the average student room cost AUD 285 a week.'),
  ok('rent', 2, 'Perth student rooms averaged AUD 310 a week.'),
  ok('rent', 3, 'Four in ten students surveyed said they had skipped meals to cover rent.'),
  ok('rent', 4, 'The authors say the findings describe students, not the whole rental market.'),
  plant('rent', 1, 'unit', true, 'Average weekly rent rose by AUD 8 over the year.'),
  plant(
    'rent',
    3,
    'number_word',
    false,
    'Three in ten students surveyed said they had skipped meals to cover rent.',
  ),

  // sleep: a claim only in the title, a changed unit
  ok(
    'sleep',
    2,
    'On shift days, the students slept an average of 5.5 hours, against 7 hours on days off.',
  ),
  ok('sleep', 1, 'Researchers followed 240 students who worked night shifts.'),
  ok('sleep', 3, 'Working more than three night shifts a week went with more missed classes.'),
  ok('sleep', 4, 'The authors urge caution because the study is small.'),
  plant('sleep', 2, 'title', true, 'Night shifts cut student sleep by 40 percent'),
  plant('sleep', 1, 'unit', false, 'The students kept a sleep diary for 12 months.'),

  // sport: a claim only in the title, a generalisation
  ok('sport', 2, 'The difference was 2 marks out of 100.'),
  ok('sport', 1, 'Sports club members had slightly higher average grades than non-members.'),
  ok('sport', 3, 'Club members spent 6 more hours a week on campus.'),
  ok('sport', 4, 'The authors cannot say whether clubs raise grades.'),
  plant('sport', 4, 'title', false, 'Joining a sports club improves grades'),
  plant('sport', 4, 'generalisation', false, 'Sports clubs raise the grades of all students.'),

  // visa: a changed number, a changed number word
  ok('visa', 2, 'A year earlier, the same share of decisions took 45 days.'),
  ok('visa', 1, 'Ninety percent of decisions came within 28 days in the latest quarter.'),
  ok('visa', 3, 'Offshore applications took longer, with a median of 31 days.'),
  ok('visa', 4, 'The department credits staffing for the improvement.'),
  plant('visa', 2, 'number', true, 'A year earlier, the same share of decisions took 54 days.'),
  plant(
    'visa',
    3,
    'number_word',
    false,
    'Offshore applicants waited a median of thirty days, longer than onshore applicants.',
  ),
]

export const MAX_FALSE_ALARMS = 2

export type EvalOutcome = { case: EvalCase; found: boolean; verdict: string }

type Failed = { ok: false; error: string }

/** The two steps the eval runs: extraction (for the headline rule) and the source check. */
export type EvalSteps = {
  extract: (source: {
    title: string
    kind: string
    text: string
  }) => Promise<{ ok: true; facts: Fact[] } | Failed>
  check: (
    source: Body<'source'>,
    claims: CheckClaim[],
  ) => Promise<{ ok: true; claims: ClaimResult[] } | Failed>
}

/**
 * Every case's outcome. A title case is found unless extraction lists it as a headline claim;
 * every other case is one slide sentence of its own, found when the source check finds it. One
 * source at a time, so a run stays under the models' per-minute limits.
 */
export async function runG2Eval(
  steps: EvalSteps,
): Promise<{ ok: true; outcomes: EvalOutcome[] } | Failed> {
  const outcomes: EvalOutcome[] = []
  for (const source of EVAL_SOURCES) {
    const cases = EVAL_CASES.filter((c) => c.source === source.id)
    const text = source.paragraphs.join('\n\n')
    const body: Body<'source'> = {
      title: source.title,
      kind: source.kind,
      text,
      paragraphs: source.paragraphs.map((p, i) => ({ ref: `¶${i + 1}`, text: p })),
      demoKey: null,
      language: 'en',
    }

    const titleCase = cases.find((c) => c.planted === 'title')
    if (titleCase) {
      const extracted = await steps.extract({ title: source.title, kind: source.kind, text })
      if (!extracted.ok)
        return { ok: false, error: `${source.id}: extraction failed: ${extracted.error}` }
      const headline = extracted.facts.find(
        (f) => f.headline && normalise(f.text) === normalise(titleCase.claim),
      )
      outcomes.push({
        case: titleCase,
        found: !headline,
        verdict: headline
          ? ['Headline claim not in the article', headline.why].filter(Boolean).join(': ')
          : 'supported',
      })
    }

    const checked = cases.filter((c) => c !== titleCase)
    // Each sentence rests on the paragraph it is about, as a slide's sentence rests on the source
    // sentences of the facts its slot binds (ADR-129).
    const claims = checked.map((c, i) => ({
      slide: i + 1,
      slot: 'body',
      text: c.claim,
      evidence: [body.paragraphs[c.paragraph - 1]],
    }))
    const result = await steps.check(body, claims)
    if (!result.ok)
      return { ok: false, error: `${source.id}: source check failed: ${result.error}` }
    if (result.claims.length !== checked.length) {
      return {
        ok: false,
        error: `${source.id}: ${result.claims.length} results for ${checked.length} claims`,
      }
    }
    for (const [i, c] of checked.entries()) {
      const verdict = result.claims[i].result
      outcomes.push({ case: c, found: verdict === 'found', verdict })
    }
  }
  return { ok: true, outcomes }
}

/** The bar: every planted claim caught, at most MAX_FALSE_ALARMS true claims not found. */
export function scoreG2(outcomes: EvalOutcome[]) {
  const misses = outcomes.filter((o) => o.case.planted !== null && o.found)
  const alarms = outcomes.filter((o) => o.case.planted === null && !o.found)
  const planted = outcomes.filter((o) => o.case.planted !== null).length
  return {
    planted,
    misses,
    alarms,
    passed: misses.length === 0 && alarms.length <= MAX_FALSE_ALARMS,
  }
}
