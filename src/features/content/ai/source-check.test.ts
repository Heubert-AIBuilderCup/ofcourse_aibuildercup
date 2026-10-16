// The source check after render, with the fake provider and an in-memory call log and cache: no
// network, no database. Code decides verbatim claims and numbers; the judge sees the rest.

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const store = new Map<string, unknown>()
const memoryCache: Cache = {
  get: async (key) => store.get(key) ?? null,
  put: async (key, row) => {
    store.set(key, row.value)
  },
}
const memoryCalls: CallLog = {
  countToday: async () => 0,
  record: async () => {},
  reserve: async () => 'reserved',
  settle: async () => {},
}

mock.module('server-only', () => ({}))
mock.module('./calls', () => ({ dbCallLog: memoryCalls }))
mock.module('./cache', () => ({ dbCache: memoryCache }))

// Another test file may have loaded ./client first, with the database log and cache in its `ai`;
// this swaps in one built on the in-memory ones.
const client = await import('./client')
const { aiConfig } = await import('./config')
const { FAKE_ANSWERS, makeFake } = await import('./fake')
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: { json: (req) => provider.json(req), image: (req) => provider.image(req) },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { runSourceCheck } = await import('./source-check')
const { draftStructures } = await import('./draft')
const { extractFacts } = await import('./extract')
const { SOURCE_CHECK, buildPrompt, sourceCheckRule } = await import('./prompts')
const { toModelSchema } = await import('./schema-guard')
const { templateById } = await import('../templates')
const { DEMO_SOURCES } = await import('../demo-sources')
const { REPLAYS } = await import('./replays/index')
const { sha256Hex } = await import('../server/hash')
const { EVAL_SOURCES } = await import('./evals/g2-claims')
const { normalise } = await import('../text/verbatim')

const found = DEMO_SOURCES.find((s) => s.key === 'paid-work')
if (!found) throw new Error('demo source missing')
const paidWork = found
const theLine = templateById('the-line')
if (!theLine) throw new Error('the-line template missing')
const lineTemplate = theLine

const PLANTED = 'First year is the worst time to find out where your limit is.'

const fakeSourceCheck = FAKE_ANSWERS.source_check

beforeEach(() => store.clear())
afterEach(() => {
  FAKE_ANSWERS.source_check = fakeSourceCheck
  provider = fakeProvider
})

type Input = Parameters<typeof runSourceCheck>[0]
type Text = Pick<Input, 'structure' | 'template' | 'facts'>
type Source = Input['source']
type Fact = Input['facts'][number]

const paragraphs = paidWork.text.split('\n\n').map((text, i) => ({ ref: `¶${i + 1}`, text }))
const demoSource: Source = { ...paidWork, paragraphs, demoKey: 'paid-work', language: 'en' }

/** The fake the-line draft of paid-work, with the facts it binds. */
async function fakeLineDraft(): Promise<{ text: Text; source: Source }> {
  const extracted = await extractFacts({ ...paidWork, postId: 'test-post' })
  if (!extracted.ok) throw new Error(extracted.error)
  const drafted = await draftStructures({
    templateIds: ['the-line'],
    source: extracted.source,
    facts: extracted.facts,
    attempt: 1,
    postId: 'test-post',
  })
  if (!drafted.ok) throw new Error(drafted.error)
  const { structure, template } = drafted.items[0]
  return { text: { structure, template, facts: extracted.facts }, source: extracted.source }
}

/** A source sentence as a fact, as extraction makes one (criterion 95). */
function sentenceFact(id: string, ref: string, text: string): Fact {
  return { id, text, quote: text, ref, value: null, supported: true, why: null, span: null }
}

/** Text whose only claims are the sentences of one body slot, bound to `facts`. */
function saying(text: string, facts: Fact[] = []): Text {
  return {
    structure: {
      templateId: 'the-line',
      artPrompt: 'A desk.',
      slides: [
        {
          kind: 'body',
          slots: {
            heading: { text: 'Finding', factIds: [], factual: false },
            body: { text, factIds: facts.map((f) => f.id), factual: true },
          },
        },
      ],
    },
    template: lineTemplate,
    facts,
  }
}

function countingProvider() {
  const calls: string[] = []
  provider = {
    json: async (req) => {
      calls.push(req.useCase)
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
  return calls
}

function check(text: Text, source: Source = demoSource, previous: Input['previous'] = null) {
  return runSourceCheck({ ...text, source, previous, postId: 'test-post' })
}

describe('runSourceCheck', () => {
  it('on the fake the-line draft of paid-work, every claim is found but the planted one (42)', async () => {
    const { text, source } = await fakeLineDraft()
    const res = await check(text, source)
    if (!res.ok) throw new Error(res.error)
    expect(res.claims.length).toBeGreaterThan(3)
    const notFound = res.claims.filter((c) => c.result !== 'found')
    expect(notFound.map((c) => [c.text, c.result, c.ref])).toEqual([[PLANTED, 'not_found', null]])
    for (const claim of res.claims.filter((c) => c.result === 'found')) {
      expect(claim.ref).toMatch(/^¶\d$/)
    }
    expect(res.replays).toEqual([])
  })

  it('finds a claim copied from ¶2 as ¶2 with no provider call', async () => {
    const calls = countingProvider()
    const p2 = paragraphs[1].text
    const res = await check(saying(p2))
    if (!res.ok) throw new Error(res.error)
    expect(res.claims).toEqual([
      { text: p2, slide: 1, slot: 'body', result: 'found', ref: '¶2', basis: expect.any(String) },
    ])
    expect(calls).toEqual([])
  })

  it('keeps "pass rates fell by 12 percentage points" not_found even when the judge says supported', async () => {
    const asked: unknown[] = []
    FAKE_ANSWERS.source_check = (data) => {
      asked.push(data)
      return { supported: true, ref: '¶3', why: 'Supported.' }
    }
    const res = await check(
      saying('Above 20 hours a week, pass rates fell by 12 percentage points.'),
    )
    if (!res.ok) throw new Error(res.error)
    expect(res.claims[0]).toMatchObject({ result: 'not_found', ref: null })
    expect(asked).toEqual([])
  })

  it('does not let the judge pass a number the paragraph it cites lacks', async () => {
    // 11 is only in ¶3; the judge points at ¶5, so numberVerdict against its ref refuses.
    FAKE_ANSWERS.source_check = () => ({ supported: true, ref: '¶5', why: 'Supported.' })
    const res = await check(saying('Pass rates fell by 11 percentage points above the limit.'))
    if (!res.ok) throw new Error(res.error)
    expect(res.claims[0]).toMatchObject({ result: 'not_found', ref: null })
  })

  it('takes the judge’s yes for a paraphrase whose numbers its ref holds', async () => {
    FAKE_ANSWERS.source_check = () => ({ supported: true, ref: '¶2', why: 'Supported.' })
    const res = await check(saying('Working up to 20 hours a week did not change grades.'))
    if (!res.ok) throw new Error(res.error)
    expect(res.claims[0]).toMatchObject({ result: 'found', ref: '¶2' })
  })

  it('treats a judge that says not supported, or cites no paragraph, as not_found', async () => {
    const claim = saying('Working up to 20 hours a week did not change grades.')
    FAKE_ANSWERS.source_check = () => ({ supported: false, ref: '¶2', why: 'No.' })
    const no = await check(claim)
    FAKE_ANSWERS.source_check = () => ({ supported: true, ref: null, why: 'Yes.' })
    const noRef = await check(claim)
    FAKE_ANSWERS.source_check = () => ({ supported: true, ref: '¶9', why: 'Yes.' })
    const badRef = await check(claim)
    for (const res of [no, noRef, badRef]) {
      if (!res.ok) throw new Error(res.error)
      expect(res.claims[0]).toMatchObject({ result: 'not_found', ref: null })
    }
  })

  it('keeps a claim opinion when the previous check marked that exact text opinion', async () => {
    const { text, source } = await fakeLineDraft()
    const res = await check(text, source, {
      revisionId: 'earlier',
      claims: [{ text: PLANTED, slide: 3, slot: 'body', result: 'opinion', ref: null }],
      replays: [],
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.claims.find((c) => c.text === PLANTED)).toMatchObject({
      result: 'opinion',
      ref: null,
    })
    expect(res.claims.filter((c) => c.result === 'opinion')).toHaveLength(1)
  })

  it('fails with the standard message on [fake:fail-source_check] in a claim', async () => {
    const res = await check(
      saying('Working a few hours might help students settle [fake:fail-source_check].'),
      { ...demoSource, demoKey: null },
    )
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('the check against the bound fact (ADR-129)', () => {
  const evalSource = (id: string): Source => {
    const s = EVAL_SOURCES.find((e) => e.id === id)
    if (!s) throw new Error(`no eval source ${id}`)
    return {
      title: s.title,
      kind: s.kind,
      text: s.paragraphs.join('\n\n'),
      paragraphs: s.paragraphs.map((text, i) => ({ ref: `¶${i + 1}`, text })),
      demoKey: null,
      language: 'en',
    }
  }
  /** The judge as the fake answers, keeping what it was shown. */
  function watchedJudge() {
    const shown: unknown[] = []
    FAKE_ANSWERS.source_check = (data) => {
      shown.push(data)
      return fakeSourceCheck?.(data)
    }
    return shown
  }
  const p2Fact = sentenceFact('f2', '¶2', paragraphs[1].text)
  const p3Fact = sentenceFact(
    'f3',
    '¶3',
    'Above 20 hours a week, pass rates fell by 11 percentage points.',
  )

  // The two false alarms of the live G2 run on 9 Oct 2026: fair paraphrases of one sentence each.
  for (const [id, ref, claim] of [
    ['sleep', '¶3', 'Working more than three night shifts a week went with more missed classes.'],
    ['visa', '¶1', 'Ninety percent of decisions came within 28 days in the latest quarter.'],
  ] as const) {
    it(`finds "${claim}" against its bound fact alone`, async () => {
      const source = evalSource(id)
      const sentence = source.paragraphs.find((p) => p.ref === ref)?.text ?? ''
      const shown = watchedJudge()
      const res = await check(saying(claim, [sentenceFact('f1', ref, sentence)]), source)
      if (!res.ok) throw new Error(res.error)
      expect(res.claims[0]).toMatchObject({ text: claim, result: 'found', ref })
      expect(shown).toEqual([{ claim, paragraphs: [{ ref, text: sentence }] }])
    })
  }

  it('holds a figure to the bound fact: one only another paragraph gives is not found, with no call', async () => {
    const shown = watchedJudge()
    const res = await check(
      saying('Pass rates fell by 11 percentage points for students who worked more.', [p2Fact]),
    )
    if (!res.ok) throw new Error(res.error)
    expect(res.claims[0]).toMatchObject({ result: 'not_found', ref: null })
    expect(shown).toEqual([])
  })

  it('shows a flagged sentence the source sentence it should match: its bound fact, else the best sentence (104)', async () => {
    const bound = await check(saying(PLANTED, [p3Fact]))
    if (!bound.ok) throw new Error(bound.error)
    expect(bound.claims[0]).toMatchObject({
      result: 'not_found',
      suggestion: { ref: '¶3', text: p3Fact.text },
    })

    const unbound = await check(saying('In the first year the fall was the steepest.'))
    if (!unbound.ok) throw new Error(unbound.error)
    expect(unbound.claims[0]).toMatchObject({
      result: 'not_found',
      suggestion: { ref: '¶3', text: 'The drop was largest in the first year of study.' },
    })

    const found = await check(saying(paragraphs[1].text, [p2Fact]))
    if (!found.ok) throw new Error(found.error)
    expect(found.claims[0].result).toBe('found')
    expect(found.claims[0].suggestion).toBeUndefined()
  })

  it('takes an earlier result for the same sentence on the same evidence and asks no one again (98)', async () => {
    const said = 'Working up to 20 hours a week did not change grades.'
    const first = await check(saying(said, [p2Fact]))
    if (!first.ok) throw new Error(first.error)
    expect(first.claims[0].result).toBe('found')
    // An earlier check said otherwise on the same evidence: that result stands, unasked.
    const previous = {
      revisionId: null,
      draft: { draftsId: 'drafts_1', index: 0 },
      claims: first.claims.map((c) => ({ ...c, result: 'not_found' as const, ref: null })),
      replays: [],
    }
    const calls = countingProvider()
    const again = await check(saying(said, [p2Fact]), demoSource, previous)
    if (!again.ok) throw new Error(again.error)
    expect(again.claims[0]).toMatchObject({ result: 'not_found', basis: first.claims[0].basis })
    expect(calls).toEqual([])

    // Bound to another fact, or from a check that kept no basis, the sentence is read afresh.
    const rebound = await check(saying(said, [p3Fact]), demoSource, previous)
    if (!rebound.ok) throw new Error(rebound.error)
    expect(calls).toEqual(['source_check'])
    const unmarked = {
      ...previous,
      claims: previous.claims.map(({ basis: _basis, ...c }) => c),
    }
    const fresh = await check(saying(said, [p2Fact]), demoSource, unmarked)
    if (!fresh.ok) throw new Error(fresh.error)
    expect(fresh.claims[0].result).toBe('found')
  })
})

describe('source-check replays', () => {
  const stepFor = (claim: string) => `source_check:${sha256Hex(normalise(claim)).slice(0, 16)}`
  // The marker makes the live call fail, so the recording is the only way to an answer.
  const claimA = 'Working up to 20 hours a week did not change grades [fake:fail-source_check].'
  const claimB = 'Working up to 20 hours a week did not change results [fake:fail-source_check].'

  afterEach(() => {
    delete REPLAYS['paid-work']
  })

  it('answers the identical claim from its recording when the live call fails', async () => {
    const step = stepFor(claimA)
    REPLAYS['paid-work'] = { [step]: { supported: true, ref: '¶2', why: 'Supported.' } }
    const res = await check(saying(claimA))
    if (!res.ok) throw new Error(res.error)
    expect(res.claims[0]).toMatchObject({ result: 'found', ref: '¶2' })
    expect(res.replays).toEqual([step])
  })

  it('never answers a different claim in the same slot from that recording', async () => {
    REPLAYS['paid-work'] = { [stepFor(claimA)]: { supported: true, ref: '¶2', why: 'Supported.' } }
    const res = await check(saying(claimB))
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('the source_check spec', () => {
  it('has an example that parses with its schema and passes the schema guard', () => {
    expect(SOURCE_CHECK.schema.safeParse(SOURCE_CHECK.example.answer).success).toBe(true)
    expect(() => toModelSchema(SOURCE_CHECK.schema)).not.toThrow()
    expect(SOURCE_CHECK).toMatchObject({
      useCase: 'source_check',
      version: 'source_check.v3',
      tier: 'lite',
      temperature: 0,
    })
  })

  // The live eval on 9 Oct read "adding and changing nothing" literally and rejected five faithful
  // rewordings (for example "Ninety percent…" for "…90 percent…"). Meaning decides, not wording.
  it('lets a rewording through and names what still makes a claim unsupported', () => {
    const rules = SOURCE_CHECK.rules.join(' ')
    expect(rules).toMatch(/reword/i)
    expect(rules).toMatch(/numbers written as words/i)
    expect(rules).toMatch(/cause where the paragraph only reports a link/i)
    expect(rules).not.toMatch(/changing nothing/i)
  })
})

describe('the source check for a post in another language (GD37)', () => {
  /** The judge's system text, for every claim it was asked about. */
  function judgeSystems(): string[] {
    const systems: string[] = []
    provider = {
      json: async (req) => {
        if (req.useCase === 'source_check') systems.push(req.system)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return systems
  }
  const paraphrase = saying('Working up to 20 hours a week did not change grades.')

  it('tells the judge the sentence may be in Nepali while the source is in English: meaning decides', async () => {
    const systems = judgeSystems()
    const res = await check(paraphrase, { ...demoSource, demoKey: null, language: 'ne' })
    if (!res.ok) throw new Error(res.error)
    expect(systems).toHaveLength(1)
    expect(systems[0]).toContain(sourceCheckRule('Nepali'))
    expect(sourceCheckRule('Nepali')).toMatch(/meaning/i)
  })

  it('asks the judge of an English post as it always did', async () => {
    const systems = judgeSystems()
    const res = await check(paraphrase, { ...demoSource, demoKey: null })
    if (!res.ok) throw new Error(res.error)
    expect(systems[0]).not.toContain(sourceCheckRule('Nepali'))
    expect(systems[0]).toBe(
      buildPrompt(SOURCE_CHECK, {
        claim: 'Working up to 20 hours a week did not change grades.',
        paragraphs,
      }).system,
    )
  })
})
