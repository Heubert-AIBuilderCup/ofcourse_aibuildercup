// G2, source to facts, with the fake provider and an in-memory call log and cache: no network,
// no database. Gemini points at sentences by id and code copies them; the title's own sentences
// are checked with the source check (criteria 95, 96). No model judges a paraphrase.

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
// The provider behind `ai`; a test may wrap it (to read what was asked) and afterEach restores it.
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: { json: (req) => provider.json(req), image: (req) => provider.image(req) },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { extractFacts, extractIdea, splitParagraphs } = await import('./extract')
const { IDEA_KIND } = await import('../model/artifacts')
const { EXTRACT } = await import('./prompts')
const { toModelSchema } = await import('./schema-guard')
const { sourceSentences } = await import('../text/sentences')
const { DEMO_SOURCES } = await import('../demo-sources')
const { EVAL_SOURCES } = await import('./evals/g2-claims')

const paidWork = DEMO_SOURCES.find((s) => s.key === 'paid-work')
const twin = DEMO_SOURCES.find((s) => s.key === 'paid-work-twin')
const sportSource = EVAL_SOURCES.find((s) => s.id === 'sport')
if (!paidWork || !twin || !sportSource) throw new Error('demo or eval sources missing')
const sport = {
  title: sportSource.title,
  kind: sportSource.kind,
  text: sportSource.paragraphs.join('\n\n'),
}

const { extract: fakeExtract, source_check: fakeSourceCheck } = FAKE_ANSWERS

beforeEach(() => store.clear())
afterEach(() => {
  FAKE_ANSWERS.extract = fakeExtract
  FAKE_ANSWERS.source_check = fakeSourceCheck
  provider = fakeProvider
})

function run(source: { title: string; kind: string; text: string }) {
  return extractFacts({ ...source, postId: 'test-post' })
}

/** Every sentence of the text, by its id. */
function sentencesOf(text: string) {
  return new Map(
    splitParagraphs(text)
      .flatMap((p) => sourceSentences(p))
      .map((s) => [s.id, s]),
  )
}

describe('splitParagraphs', () => {
  it('splits on blank lines, trims, drops empties and numbers them', () => {
    expect(splitParagraphs('a\n\n b \n\n\nc')).toEqual([
      { ref: '¶1', text: 'a' },
      { ref: '¶2', text: 'b' },
      { ref: '¶3', text: 'c' },
    ])
  })
})

describe('extractFacts', () => {
  it('on paid-work: five paragraphs, three key ideas, every fact supported; ¶1 states its title, so the title adds no fact (22)', async () => {
    const res = await run(paidWork)
    if (!res.ok) throw new Error(res.error)
    expect(res.source.paragraphs).toHaveLength(5)
    expect(res.source.demoKey).toBe('paid-work')
    expect(res.keyIdeas).toHaveLength(3)
    expect(res.facts.length).toBeGreaterThan(1)
    for (const fact of res.facts) expect(fact.supported).toBe(true)
    expect(res.facts.some((f) => f.headline)).toBe(false)
    expect(res.facts.map((f) => f.id)).toEqual(res.facts.map((_, i) => `f${i + 1}`))
    expect(res.replays).toEqual([])
  })

  it('sends the model each paragraph as numbered sentences', async () => {
    const seen: unknown[] = []
    FAKE_ANSWERS.extract = (data) => {
      seen.push(data)
      return fakeExtract?.(data)
    }
    await run(paidWork)
    const { paragraphs } = seen[0] as {
      paragraphs: { ref: string; sentences: { id: string; text: string }[] }[]
    }
    expect(paragraphs[2]).toEqual({
      ref: '¶3',
      sentences: [
        { id: '¶3.1', text: 'Above 20 hours a week, pass rates fell by 11 percentage points.' },
        { id: '¶3.2', text: 'The drop was largest in the first year of study.' },
      ],
    })
  })

  it('sends the framing line as editor_intent, and null with none (GD20)', async () => {
    const seen: unknown[] = []
    FAKE_ANSWERS.extract = (data) => {
      seen.push(data)
      return fakeExtract?.(data)
    }
    const framing = 'Show first-year students why 20 hours is the limit'
    const framed = await extractFacts({ ...paidWork, postId: 'test-post', framing })
    expect(framed.ok).toBe(true)
    await run(paidWork)
    expect(seen[0]).toMatchObject({ editor_intent: framing })
    expect(seen[1]).toMatchObject({ editor_intent: null })
  })

  it('makes each fact the exact text of the sentence the model named, once each, in its order (95)', async () => {
    FAKE_ANSWERS.extract = () => ({ key_ideas: [], facts: ['¶3.2', '¶5.1', '¶3.2', '¶1.1'] })
    const res = await run(paidWork)
    if (!res.ok) throw new Error(res.error)
    const byId = sentencesOf(paidWork.text)
    const facts = res.facts.filter((f) => !f.headline)
    expect(facts.map((f) => f.sentenceId)).toEqual(['¶3.2', '¶5.1', '¶1.1'])
    for (const fact of facts) {
      const sentence = byId.get(fact.sentenceId ?? '')
      expect(fact).toMatchObject({
        text: sentence?.text,
        quote: sentence?.text,
        ref: sentence?.ref,
        supported: true,
        why: null,
        span: null,
      })
    }
    expect(facts[1].value).toEqual({ number: 24.95, unit: 'aud' })
  })

  it('lists a sentence id that does not exist as a problem for the retry ladder, and keeps none (95)', async () => {
    const asked: string[] = []
    provider = {
      json: async (req) => {
        if (req.useCase === 'extract') asked.push(req.user)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    FAKE_ANSWERS.extract = () =>
      asked.length === 1
        ? { key_ideas: [], facts: ['¶9.1', '¶1.1'] }
        : { key_ideas: [], facts: ['¶1.1'] }
    const res = await run({ title: 'Other', kind: 'news', text: 'One paragraph. Two lines.' })
    if (!res.ok) throw new Error(res.error)
    expect(asked).toHaveLength(2)
    expect(asked[1]).toContain('facts.0: ¶9.1 is not a sentence id in DATA.')
    expect(res.facts.filter((f) => !f.headline).map((f) => f.text)).toEqual(['One paragraph.'])
  })

  it('on the twin: the title is a headline claim not in the article, pointing at the 9 in ¶3 (23, 24, 96)', async () => {
    const res = await run(twin)
    if (!res.ok) throw new Error(res.error)
    const title = res.facts.find((f) => f.text === twin.title)
    expect(title).toMatchObject({
      headline: true,
      supported: false,
      ref: '¶3',
      why: 'The paragraph gives 9, not 11.',
    })
    const p3 = res.source.paragraphs.find((p) => p.ref === '¶3')?.text ?? ''
    expect(title?.span?.ref).toBe('¶3')
    expect(p3.slice(title?.span?.start, title?.span?.end)).toBe('9')
    for (const fact of res.facts.filter((f) => !f.headline)) expect(fact.supported).toBe(true)
  })

  it('keeps the twin title unsupported when the source check says yes to everything (24)', async () => {
    const asked: string[] = []
    FAKE_ANSWERS.source_check = (data) => {
      asked.push((data as { claim: string }).claim)
      return { supported: true, ref: '¶3', why: 'Supported.' }
    }
    const res = await run(twin)
    if (!res.ok) throw new Error(res.error)
    expect(res.facts.find((f) => f.text === twin.title)).toMatchObject({
      headline: true,
      supported: false,
    })
    expect(asked).not.toContain(twin.title)
  })

  it('lists a sports-club title over an article that finds only a link as a headline claim (96)', async () => {
    const res = await run(sport)
    if (!res.ok) throw new Error(res.error)
    const headlines = res.facts.filter((f) => f.headline)
    expect(headlines).toHaveLength(1)
    expect(headlines[0]).toMatchObject({
      text: 'Joining a sports club improves grades',
      supported: false,
      quote: null,
    })
  })

  it('takes the source check’s word on a title sentence with no number to decide (96)', async () => {
    const asked: string[] = []
    FAKE_ANSWERS.source_check = (data) => {
      asked.push((data as { claim: string }).claim)
      return { supported: true, ref: '¶1', why: 'Supported.' }
    }
    const res = await run(sport)
    if (!res.ok) throw new Error(res.error)
    expect(asked).toEqual(['Joining a sports club improves grades'])
    expect(res.facts.some((f) => f.headline)).toBe(false)
  })

  it('makes no headline fact of a label title, and never sends it to the check (96)', async () => {
    const asked: string[] = []
    FAKE_ANSWERS.source_check = (data) => {
      asked.push((data as { claim: string }).claim)
      return { supported: false, ref: '¶1', why: 'Not said.' }
    }
    for (const title of ['Test Feed', 'Paid work and grades']) {
      const res = await run({ title, kind: 'news', text: paidWork.text })
      if (!res.ok) throw new Error(res.error)
      expect(res.facts.some((f) => f.headline)).toBe(false)
    }
    expect(asked).toEqual([])
  })

  it('checks each sentence of a title on its own', async () => {
    const res = await run({
      title: 'Hours of paid work and first-year results. Night shifts cut sleep by 40 percent.',
      kind: 'research summary',
      text: paidWork.text,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.facts.filter((f) => f.headline).map((f) => f.text)).toEqual([
      'Night shifts cut sleep by 40 percent.',
    ])
  })

  it('fails with the standard message on [fake:fail-extract]', async () => {
    const res = await run({
      title: 'Something else',
      kind: 'news',
      text: 'One paragraph [fake:fail-extract].\n\nAnother one.',
    })
    expect(res).toEqual({ ok: false, error: 'This step failed. Your work so far is kept.' })
  })

  it('succeeds on [fake:bad-extract] through the second attempt', async () => {
    const res = await run({
      title: 'Something else',
      kind: 'news',
      text: 'One paragraph [fake:bad-extract].\n\nAnother one.',
    })
    expect(res.ok).toBe(true)
  })

  it('fails without calling a model when there are no paragraphs', async () => {
    const res = await run({ title: 'Empty', kind: 'news', text: ' \n\n ' })
    expect(res.ok).toBe(false)
  })
})

describe('extractIdea', () => {
  // A post started from an idea alone (bug, 18 Oct): an opinion states no fact the model would
  // name, so the model gave none, and every look's factual slot had nothing to cite.
  it('makes each sentence of the idea a supported fact, quoted word for word, with no model call', () => {
    let calls = 0
    provider = {
      ...fakeProvider,
      json: (req) => {
        calls++
        return fakeProvider.json(req)
      },
    }
    const idea = 'Do not always push yourself. Enjoy what we have right now.'
    const res = extractIdea({ title: idea, kind: IDEA_KIND, text: idea })
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(0)
    expect(res.source.paragraphs).toEqual([{ ref: '¶1', text: idea }])
    expect(res.facts).toEqual([
      {
        id: 'f1',
        text: 'Do not always push yourself.',
        value: null,
        ref: '¶1',
        quote: 'Do not always push yourself.',
        supported: true,
        why: null,
        span: null,
        sentenceId: '¶1.1',
      },
      {
        id: 'f2',
        text: 'Enjoy what we have right now.',
        value: null,
        ref: '¶1',
        quote: 'Enjoy what we have right now.',
        supported: true,
        why: null,
        span: null,
        sentenceId: '¶1.2',
      },
    ])
    expect(res.keyIdeas).toEqual(['Do not always push yourself.', 'Enjoy what we have right now.'])
    expect(res.replays).toEqual([])
  })

  it('takes an idea with no full stop as one fact, the whole idea', () => {
    const idea = 'Do not always push yourself enjoy what we have right now'
    const res = extractIdea({ title: idea, kind: IDEA_KIND, text: idea })
    if (!res.ok) throw new Error(res.error)
    expect(res.facts.map((f) => [f.id, f.quote, f.supported])).toEqual([['f1', idea, true]])
    expect(res.keyIdeas).toEqual([idea])
  })

  it('keeps at most three key ideas, the first three sentences', () => {
    const res = extractIdea({ title: 'Count', kind: IDEA_KIND, text: 'One. Two. Three. Four.' })
    if (!res.ok) throw new Error(res.error)
    expect(res.facts).toHaveLength(4)
    expect(res.keyIdeas).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('refuses an idea with no paragraph, as extraction does', () => {
    expect(extractIdea({ title: 'x', kind: IDEA_KIND, text: '  \n\n ' })).toEqual({
      ok: false,
      error: 'The source has no paragraphs.',
    })
  })
})

describe('the extract spec', () => {
  it('has an example that parses with its own schema and passes the schema guard, on Flash', () => {
    expect(EXTRACT.schema.safeParse(EXTRACT.example.answer).success).toBe(true)
    expect(() => toModelSchema(EXTRACT.schema)).not.toThrow()
    expect(EXTRACT).toMatchObject({ version: 'extract.v3', tier: 'flash', temperature: 0.1 })
  })

  it('lets editor_intent choose the key ideas only, never a fact (GD20)', () => {
    const rule = EXTRACT.rules.find((r) => r.includes('DATA.editor_intent'))
    expect(rule).toContain('key ideas')
    expect(rule).toContain('never')
  })

  it('numbers its example sentences as code does, and names only ids they have', () => {
    const data = EXTRACT.example.data as {
      paragraphs: { ref: string; sentences: { id: string; text: string }[] }[]
    }
    for (const p of data.paragraphs) {
      const text = p.sentences.map((s) => s.text).join(' ')
      expect(p.sentences).toEqual(
        sourceSentences({ ref: p.ref, text }).map(({ id, text }) => ({ id, text })),
      )
    }
    const ids = new Set(data.paragraphs.flatMap((p) => p.sentences.map((s) => s.id)))
    const answer = EXTRACT.schema.parse(EXTRACT.example.answer)
    expect(answer.facts.length).toBeGreaterThan(0)
    for (const id of answer.facts) expect(ids.has(id)).toBe(true)
  })
})
