// Idea cards (GD1, GD3, GD7), with the fake provider and an in-memory call log and cache: no
// network, no database. Code checks the count, the hooks and the looks the model suggests.

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

const client = await import('./client')
const { aiConfig } = await import('./config')
const { makeFake } = await import('./fake')
const fakeProvider = makeFake()
let provider: Provider = fakeProvider
const memoryAi = client.makeAi({
  provider: { json: (req) => provider.json(req), image: (req) => provider.image(req) },
  config: aiConfig(process.env),
  calls: memoryCalls,
  cache: memoryCache,
  sleep: async () => {},
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { ideasProblems, suggestIdeas } = await import('./ideas')
const { IDEAS, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')
const { languageById } = await import('../languages')
const { toModelSchema } = await import('./schema-guard')
const { FORMAT_IDS, LOOK_IDS } = await import('../model/types')
const { FORMATS } = await import('../formats')
const { LOOKS } = await import('../templates')

type Answer = Parameters<typeof ideasProblems>[0]
type Fact = import('../model/types').Fact

const fact = (id: string, text: string, supported = true): Fact => ({
  id,
  text,
  value: null,
  ref: '¶1',
  quote: null,
  supported,
  why: null,
  span: null,
})
const FACTS = [
  fact('f1', 'Students working up to 20 hours a week kept their grades.'),
  fact('f2', 'Most students who work do so in retail or hospitality.'),
]
const SOURCE = {
  title: 'Paid work and grades',
  kind: 'article',
  text: 'Students working up to 20 hours a week kept their grades.',
  paragraphs: [
    { ref: '¶1', text: 'Students working up to 20 hours a week kept their grades.' },
    { ref: '¶2', text: 'Most students who work do so in retail or hospitality.' },
  ],
  demoKey: null,
  language: 'en' as const,
}

const card = (over: Partial<Answer['cards'][number]> = {}): Answer['cards'][number] => ({
  angle: 'The limit that works',
  hook: 'Twenty hours a week is where grades hold.',
  audience: 'First-year students',
  look: 'field-notes',
  format: 'myth-vs-fact',
  slides: 6,
  rank: 1,
  ...over,
})
/** The model's top three formats for the source, best first (GD33). */
const TOP = ['myth-vs-fact', 'step-by-step', 'bullet-points']
const answer = (cards: Answer['cards'], formats: string[] = TOP): Answer => ({ cards, formats })
const four = () =>
  answer([
    card(),
    card({
      angle: 'Where students work',
      hook: 'Retail and hospitality hire most students.',
      rank: 2,
    }),
    card({
      angle: 'Ask first',
      hook: 'Ask your manager about exam weeks.',
      look: 'data-desk',
      rank: 3,
    }),
    card({ angle: 'Keep the pace', hook: 'Protect your study time from the start.', rank: 4 }),
  ])
const context = (over: { places?: string[]; avoid?: string[] } = {}) => ({
  places: over.places ?? [],
  avoid: over.avoid ?? [],
  facts: FACTS,
})

beforeEach(() => store.clear())
afterEach(() => {
  provider = fakeProvider
})

describe('the ideas spec', () => {
  it('has an example that parses with its own schema and passes the schema guard', () => {
    expect(IDEAS.schema.safeParse(IDEAS.example.answer).success).toBe(true)
    expect(() => toModelSchema(IDEAS.schema)).not.toThrow()
    expect(IDEAS).toMatchObject({
      useCase: 'ideas',
      version: 'ideas.v7',
      tier: 'lite',
      temperature: 0.8,
    })
  })

  it('makes the idea ranked 1 the post a framing describes, its slides one per item, the others alternatives', () => {
    expect(IDEAS.rules).toContain(
      'When DATA.editor_intent says what the whole post or each slide holds (a list, a roundup, "one X per slide"), the idea ranked 1 is that post exactly as described: its angle names the whole set (like "Courses that lead to PR, one per slide"), and its slides follow the number of items, between 4 and 8. The other ideas are alternatives to it. Otherwise this rule does not apply.',
    )
  })

  it('names the three looks', () => {
    expect(LOOKS.map((t) => t.id)).toEqual([...LOOK_IDS])
  })
})

describe('ideasProblems (GD1, GD3, GD7)', () => {
  it('passes four distinct cards whose hooks hold only the facts’ numbers', () => {
    expect(ideasProblems(four(), context())).toEqual([])
  })

  it('refuses Postcard when the facts name no place, and allows it when they do', () => {
    const postcard = four()
    postcard.cards[0].look = 'postcard'
    expect(ideasProblems(postcard, context()).some((p) => p.startsWith('cards.0.look'))).toBe(true)
    expect(ideasProblems(postcard, context({ places: ['Perth'] }))).toEqual([])
  })

  it('refuses seven cards and one card, and allows two', () => {
    const seven = answer(
      Array.from({ length: 7 }, (_, i) =>
        card({
          angle: `Angle ${'abcdefg'[i]}`,
          hook: `A plain hook ${'abcdefg'[i]}.`,
          rank: i + 1,
        }),
      ),
    )
    expect(ideasProblems(seven, context())).toContain('cards: return between 2 and 6 ideas.')
    expect(ideasProblems(answer([card()]), context())).toContain(
      'cards: return between 2 and 6 ideas.',
    )
    expect(ideasProblems(answer(four().cards.slice(0, 2)), context())).toEqual([])
  })

  it('refuses ranks that are not each of 1 to the count once (GD29)', () => {
    const problem = 'cards: give each card its own rank from 1 to 4, 1 the best.'
    const tied = four()
    tied.cards[3].rank = 2
    expect(ideasProblems(tied, context())).toEqual([problem])
    const outside = four()
    outside.cards[0].rank = 5
    expect(ideasProblems(outside, context())).toEqual([problem])
  })

  it('accepts only the formats in the file, on each card and in the ranking (GD33)', () => {
    const unknown = four()
    unknown.cards[1].format = 'listicle'
    expect(ideasProblems(unknown, context())).toEqual([
      'cards.1.format: "listicle" is not one of DATA.formats.',
    ])
    const ranking = 'formats: rank three of DATA.formats, best first, each once.'
    for (const formats of [
      ['myth-vs-fact', 'step-by-step', 'listicle'],
      ['myth-vs-fact', 'step-by-step', 'step-by-step'],
      ['myth-vs-fact', 'step-by-step'],
      ['myth-vs-fact', 'step-by-step', 'bullet-points', 'then-vs-now'],
    ]) {
      expect(ideasProblems(answer(four().cards, formats), context())).toEqual([ranking])
    }
    const known = four()
    known.cards[2].format = 'then-vs-now'
    expect(ideasProblems(known, context())).toEqual([])
  })

  it('gives the best card the first of the ranked formats, so both are pre-selected together (GD29, GD33)', () => {
    const apart = four()
    apart.cards[0].format = 'step-by-step'
    expect(ideasProblems(apart, context())).toEqual([
      'cards.0.format: the card ranked 1 takes the first of formats, "myth-vs-fact".',
    ])
  })

  it('refuses a 91-character hook and allows 90', () => {
    const long = four()
    long.cards[1].hook = 'a'.repeat(91)
    expect(ideasProblems(long, context())).toEqual(['cards.1.hook: 91 characters; at most 90.'])
    long.cards[1].hook = 'a'.repeat(90)
    expect(ideasProblems(long, context())).toEqual([])
  })

  it('allows a Nepali, Hindi or Thai hook of 90 characters as a reader sees them, and refuses 91 (GD37)', () => {
    for (const id of NATIVE_IDS) {
      const native = four()
      native.cards[1].hook = nativeOf(id, 90)
      expect(ideasProblems(native, context()), id).toEqual([])
      native.cards[1].hook = nativeOf(id, 91)
      expect(ideasProblems(native, context()), id).toEqual([
        'cards.1.hook: 91 characters; at most 90.',
      ])
    }
  })

  it('refuses a number no fact holds, a banned phrase, a hook already shown, a repeated angle and slides outside 4 to 8', () => {
    const bad = four()
    bad.cards[0].hook = 'Work 25 hours a week and keep your grades.'
    bad.cards[1].hook = 'The best jobs for students.'
    bad.cards[2].hook = 'Ask your manager about exam weeks.'
    bad.cards[3].angle = 'The limit that works'
    bad.cards[3].slides = 9
    const problems = ideasProblems(bad, context({ avoid: ['ask your manager about exam weeks.'] }))
    expect(problems.some((p) => p.startsWith('cards.0.hook') && p.includes('25'))).toBe(true)
    expect(problems).toContain('cards.1.hook: remove "best".')
    expect(problems.some((p) => p.startsWith('cards.2.hook') && p.includes('shown'))).toBe(true)
    expect(problems.some((p) => p.startsWith('cards.3.angle'))).toBe(true)
    expect(problems).toContain('cards.3.slides: between 4 and 8.')
  })
})

describe('suggestIdeas', () => {
  /** The ideas calls that reached the provider, by their data. */
  function recordIdeasCalls(): unknown[] {
    const data: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') data.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return data
  }

  it('gives the fake’s four cards, sending the framing line as editor_intent, the places, the looks and what to avoid (GD1, GD20)', async () => {
    const sent = recordIdeasCalls()
    const framing = 'Show first-year students why 20 hours is the limit'
    const res = await suggestIdeas({
      source: { ...SOURCE, framing, notes: 'My own opinion.' },
      facts: [...FACTS, fact('f3', 'Rents in Perth rose.')],
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.cards).toHaveLength(4)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ editor_intent: framing, places: ['Perth'], avoid: [] })
    const data = sent[0] as { looks: { id: string }[]; brand_voice: string }
    expect(data.looks.map((l) => l.id)).toEqual([...LOOK_IDS])
    expect(data.brand_voice.length).toBeGreaterThan(0)
    expect(JSON.stringify(sent[0])).not.toContain('My own opinion.')
  })

  it('sends the ten formats with their descriptions, and gives each card its format and the top three ranked (GD33)', async () => {
    const sent = recordIdeasCalls()
    const res = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    const data = sent[0] as { formats: { id: string; label: string; description: string }[] }
    expect(data.formats).toEqual(
      FORMATS.map(({ id, label, description }) => ({ id, label, description })),
    )
    expect(res.formats).toHaveLength(3)
    for (const id of res.formats) expect(FORMAT_IDS).toContain(id)
    expect(new Set(res.formats).size).toBe(3)
    for (const c of res.cards) expect(FORMAT_IDS).toContain(c.format as (typeof FORMAT_IDS)[number])
    // The best card carries the first format, so the two are pre-selected together (GD29).
    expect(res.cards[0].format).toBe(res.formats[0])
  })

  it('sends no framing line as null, and the fake suggests no Postcard without a place (GD7, GD20)', async () => {
    const sent = recordIdeasCalls()
    const res = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(sent[0]).toMatchObject({ editor_intent: null, places: [] })
    expect(res.cards.some((c) => c.look === 'postcard')).toBe(false)
  })

  it('gives new hooks when told which were shown (GD3)', async () => {
    const first = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    if (!first.ok) throw new Error(first.error)
    const avoid = first.cards.map((c) => c.hook)
    const more = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid,
      postId: 'test-post',
      attempt: 2,
    })
    if (!more.ok) throw new Error(more.error)
    expect(more.cards.length).toBeGreaterThanOrEqual(2)
    for (const c of more.cards) expect(avoid).not.toContain(c.hook)
  })

  it('orders the cards by rank and marks the top three Recommended (GD29)', async () => {
    // The fake's four cards, ranked 4, 2, 1, 3: best first is the third, second, fourth, first.
    const ranks = [4, 2, 1, 3]
    const hooks: string[] = []
    provider = {
      json: async (req) => {
        const text = await fakeProvider.json(req)
        if (req.useCase !== 'ideas') return text
        const { cards, formats } = JSON.parse(text) as Answer
        hooks.push(...cards.map((c) => c.hook))
        // The best card carries the first format (GD29), whichever card that is.
        const ranked = cards.map((c, i) => ({ ...c, rank: ranks[i], format: formats[0] }))
        return JSON.stringify({ cards: ranked, formats })
      },
      image: fakeProvider.image,
    }
    const res = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.cards.map((c) => c.hook)).toEqual([2, 1, 3, 0].map((i) => hooks[i]))
    expect(res.cards.map((c) => c.recommended)).toEqual([true, true, true, false])
  })

  it('fails the step with the standard message on [fake:fail-ideas]', async () => {
    const marked = {
      ...SOURCE,
      paragraphs: [...SOURCE.paragraphs, { ref: '¶3', text: 'Marked [fake:fail-ideas].' }],
    }
    const res = await suggestIdeas({
      source: marked,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
    })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('ideas for a blog (BR1)', () => {
  const blogCard = (over: Partial<Answer['cards'][number]> = {}) => card({ format: '', ...over })
  const blogFour = () =>
    answer(
      four().cards.map((c) => ({ ...c, format: '' })),
      [],
    )

  it('takes angles with no format and no ranked formats: GD33’s formats are not used for blogs', () => {
    expect(ideasProblems(blogFour(), { ...context(), kind: 'blog' })).toEqual([])
    // The same answer for a post is refused for its formats.
    expect(ideasProblems(blogFour(), context()).length).toBeGreaterThan(0)
  })

  it('counts a blog angle’s sections, 3 to 8, in place of slides', () => {
    const sections = blogFour()
    sections.cards[0] = blogCard({ slides: 3 })
    expect(ideasProblems(sections, { ...context(), kind: 'blog' })).toEqual([])
    sections.cards[0] = blogCard({ slides: 9 })
    expect(ideasProblems(sections, { ...context(), kind: 'blog' })).toEqual([
      'cards.0.slides: between 3 and 8.',
    ])
  })

  it('asks for blog angles with the kind in its data and no formats, and marks the top three Recommended', async () => {
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await suggestIdeas({
      source: SOURCE,
      facts: FACTS,
      avoid: [],
      postId: 'test-post',
      attempt: 1,
      kind: 'blog',
    })
    if (!res.ok) throw new Error(res.error)
    expect(sent[0]).toMatchObject({ kind: 'blog', formats: [] })
    expect(res.formats).toEqual([])
    expect(res.cards.every((c) => c.format === undefined)).toBe(true)
    expect(res.cards.map((c) => c.recommended)).toEqual([true, true, true, false])
  })

  it('sends the headings of the blog a source was made from as from_blog_sections, and null for any other source (BR6)', async () => {
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const headings = ['How many hours can students work?', 'Where do students find work?']
    const fromBlog = { ...SOURCE, blogSections: headings }
    await suggestIdeas({ source: fromBlog, facts: FACTS, avoid: [], postId: 'p', attempt: 1 })
    await suggestIdeas({ source: SOURCE, facts: FACTS, avoid: [], postId: 'p', attempt: 2 })
    expect(sent[0]).toMatchObject({ kind: 'feed', from_blog_sections: headings })
    expect(sent[1]).toMatchObject({ from_blog_sections: null })
  })

  it('tells the model a post is a post', async () => {
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    await suggestIdeas({ source: SOURCE, facts: FACTS, avoid: [], postId: 'test-post', attempt: 1 })
    expect(sent[0]).toMatchObject({ kind: 'feed' })
  })
})

describe('ideas in the post’s language (GD37)', () => {
  const NEPALI = { ...SOURCE, language: 'ne' as const }

  it('refuses a card under 60% in the script for a Nepali post, and nothing for an English one', () => {
    const nepali = { ...context(), language: languageById('ne') ?? undefined }
    expect(ideasProblems(four(), nepali)).toEqual(
      [0, 1, 2, 3].map((i) =>
        expect.stringMatching(new RegExp(`^cards[.]${i}: write it in Nepali`)),
      ),
    )
    expect(ideasProblems(four(), context())).toEqual([])
  })

  it('sends the language and its rule, and the fake’s cards come in Devanagari, new ones when told which were shown', async () => {
    const seen: { system: string; data: unknown }[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') seen.push({ system: req.system, data: req.data })
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const first = await suggestIdeas({
      source: NEPALI,
      facts: FACTS,
      avoid: [],
      postId: 'p',
      attempt: 1,
    })
    if (!first.ok) throw new Error(first.error)
    expect(seen).toHaveLength(1)
    expect(seen[0].data).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(seen[0].system).toContain(languageRule('Nepali'))
    for (const c of first.cards) expect(scriptShare(c.hook, 'devanagari')).toBe(1)
    const avoid = first.cards.map((c) => c.hook)
    const more = await suggestIdeas({
      source: NEPALI,
      facts: FACTS,
      avoid,
      postId: 'p',
      attempt: 2,
    })
    if (!more.ok) throw new Error(more.error)
    for (const c of more.cards) expect(avoid).not.toContain(c.hook)
  })

  it('sends an English post no language and no rule', async () => {
    const seen: { system: string; data: unknown }[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'ideas') seen.push({ system: req.system, data: req.data })
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    await suggestIdeas({ source: SOURCE, facts: FACTS, avoid: [], postId: 'p', attempt: 1 })
    expect(seen[0].data).not.toHaveProperty('language')
    expect(seen[0].system).toBe(buildPrompt(IDEAS, seen[0].data).system)
  })
})
