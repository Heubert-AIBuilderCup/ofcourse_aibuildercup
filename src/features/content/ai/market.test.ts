// G5, the market rewording, with the fake provider and an in-memory call log and cache: no network,
// no database. The model rewords only the presentational slots; code checks keys, numbers, limits
// and banned phrases, and still failing is a failed step (criterion 59).

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const store = new Map<string, unknown>()
let puts: unknown[] = []
const memoryCache: Cache = {
  get: async (key) => store.get(key) ?? null,
  put: async (key, row) => {
    puts.push(row.value)
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
/** Recorded answers by demo source and step, as replays/index.ts holds them: empty but in the replay tests. */
const recordings: Record<string, Record<string, unknown>> = {}
mock.module('./replays/index', () => ({ REPLAYS: recordings }))

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

const { marketRewording } = await import('./market')
const { onLiveResult } = await import('./replays')
const { MARKET, RETRY_LEAD, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')
const { toModelSchema } = await import('./schema-guard')
const { FEED_BRAND } = await import('../brands')
const { templateById } = await import('../templates')
const { marketById } = await import('../markets')

const NEPAL = marketById('NP')
const INDIA = marketById('IN')
if (!NEPAL || !INDIA) throw new Error('markets missing')

type Input = Parameters<typeof marketRewording>[0]

const theLine = templateById('the-line')
if (!theLine) throw new Error('the-line template missing')

const FACT = {
  id: 'f2',
  text: 'Students working up to 20 hours a week had grades similar to students who did not work.',
  value: { number: 20, unit: 'number' },
  ref: '¶2',
  quote: null,
  supported: true,
  why: null,
  span: null,
}

const plain = (text: string) => ({ text, factIds: [], factual: false })
const BODY =
  'Students working up to 20 hours a week had grades similar to students who did not work, across eight universities and two semesters of results, in a survey that compared weekly paid-work hours with course results for every student.'

function revision(kicker = 'Research, briefly', template = theLine): Input['revision'] {
  const body = {
    kind: 'body' as const,
    slots: { heading: plain('Grades'), body: { text: BODY, factIds: ['f2'], factual: true } },
  }
  return {
    factsId: 'facts1',
    emotion: null,
    structure: {
      templateId: 'the-line',
      artPrompt: 'A desk.',
      slides: [
        {
          kind: 'cover',
          slots: { kicker: plain(kicker), phrase: plain('The line'), byline: plain('OfCourse') },
        },
        body,
        body,
        body,
        { kind: 'take', slots: { takeaway: plain('Keep paid work under 20 hours a week.') } },
      ],
    },
    template: template as NonNullable<typeof theLine>,
    brand: FEED_BRAND,
    themeId: 'paper',
    by: { userId: 'u1', name: 'Editor', at: '2026-10-05T00:00:00.000Z' },
    note: 'approved',
  }
}

const make = (rev = revision()) =>
  marketRewording({
    revision: rev,
    facts: [FACT],
    market: NEPAL,
    demoKey: null,
    postId: 'test-post',
    sourceTitle: 'Paid work and grades',
  })

let seen: unknown[] = []

beforeEach(() => {
  store.clear()
  puts = []
  seen = []
  provider = {
    json: async (req) => {
      seen.push(req.data)
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})
afterEach(() => {
  provider = fakeProvider
})

/** A provider that answers every market call with this. */
function answering(answer: unknown) {
  provider = {
    json: async (req) => {
      seen.push(req.data)
      return JSON.stringify(answer)
    },
    image: fakeProvider.image,
  }
}

describe('marketRewording', () => {
  it('rewords only the presentational slots, framed for families', async () => {
    const res = await make()
    if (!res.ok) throw new Error(res.error)
    expect(res.slots.map((s) => `${s.slide}:${s.slot}`).sort()).toEqual([
      '1:kicker',
      '1:phrase',
      '5:takeaway',
    ])
    expect(res.slots.find((s) => s.slot === 'takeaway')?.text).toBe(
      'With your family: Keep paid work under 20 hours a week.',
    )
    // Cut to the slot's limit: the phrase takes 10 characters.
    expect(res.slots.find((s) => s.slot === 'phrase')?.text).toBe('With your')
    expect(res.feedExcerpt).toBe("Deciding with your family how many hours you'll work?")
    expect(res.replays).toEqual([])
  })

  it('shows the model only the presentational slots, the fact values and the market', async () => {
    await make()
    const data = JSON.stringify(seen[0])
    expect(data).toContain('Research, briefly')
    expect(data).toContain(NEPAL.notes)
    expect(data).not.toContain('OfCourse')
    expect(data).not.toContain(BODY)
    expect(data).not.toContain(FACT.text)
  })

  it('sends the market it is given, so India is framed as India (85)', async () => {
    await marketRewording({
      revision: revision(),
      facts: [FACT],
      market: INDIA,
      demoKey: null,
      postId: 'test-post',
      sourceTitle: 'Paid work and grades',
    })
    expect(seen[0]).toMatchObject({ market: { id: 'IN', name: 'India', currency: 'INR' } })
    expect(JSON.stringify(seen[0])).toContain(INDIA.notes)
  })

  it('fails when every attempt carries a number that is not a fact value (59)', async () => {
    const res = await make(revision('[fake:market-number]'))
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    // Primary, retry with the problems, then Pro.
    expect(seen).toHaveLength(3)
  })

  it('refuses a slot that is not presentational, one over its limit and a banned phrase', async () => {
    for (const slot of [
      { slide: 1, slot: 'byline', text: 'With your family' },
      { slide: 1, slot: 'kicker', text: 'With your family, every single step of it' },
      { slide: 5, slot: 'takeaway', text: 'The best plan for your family.' },
    ]) {
      answering({ slots: [slot], feed_excerpt: 'Deciding together.' })
      expect(await make()).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    }
  })

  it('refuses a number only an unbound, unsupported fact states, such as the twin claim (59)', async () => {
    const twin = {
      ...FACT,
      id: 'f9',
      text: 'Students who worked saw their grades rise by 11 points.',
      value: { number: 11, unit: 'points' },
      ref: '¶4',
      supported: false,
      why: 'The paragraph says 1 point.',
    }
    const users: string[] = []
    provider = {
      json: async (req) => {
        users.push(req.user)
        return JSON.stringify({
          slots: [{ slide: 5, slot: 'takeaway', text: 'Families: grades rose 11 points.' }],
          feed_excerpt: 'Deciding together.',
        })
      },
      image: fakeProvider.image,
    }
    const res = await marketRewording({
      revision: revision(),
      facts: [FACT, twin],
      market: NEPAL,
      demoKey: null,
      postId: 'test-post',
      sourceTitle: 'Paid work and grades',
    })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    // The guard's line reaches the retry, and the model is never offered the twin's figure.
    expect(users).toHaveLength(3)
    expect(users[1]).toContain('slots.0: "11" is not a number in the facts.')
    expect(users[0]).not.toContain('11')
  })

  it('takes a Nepali, Hindi or Thai excerpt of 200 characters as a reader sees them (GD37)', async () => {
    for (const id of NATIVE_IDS) {
      const excerpt = nativeOf(id, 200)
      store.clear()
      answering({ slots: [], feed_excerpt: excerpt })
      const res = await make()
      expect(res.ok && res.feedExcerpt, id).toBe(excerpt)
    }
  })

  it('takes a number that is a fact value', async () => {
    answering({
      slots: [{ slide: 5, slot: 'takeaway', text: 'Decide together: under 20 hours a week.' }],
      feed_excerpt: 'Deciding together.',
    })
    const res = await make()
    expect(res.ok && res.slots).toEqual([
      { slide: 5, slot: 'takeaway', text: 'Decide together: under 20 hours a week.' },
    ])
  })
})

describe('replays, keyed by market (85, 87)', () => {
  const DEMO = 'paid-work'
  const recorded = (text: string) => ({
    slots: [{ slide: 5, slot: 'takeaway', text }],
    feed_excerpt: 'Deciding together.',
  })
  /** Every attempt names a slot that is not presentational, so the live call fails. */
  const failing = { slots: [{ slide: 1, slot: 'byline', text: 'X' }], feed_excerpt: 'Deciding.' }
  const inMarket = (market: typeof NEPAL) =>
    marketRewording({
      revision: revision(),
      facts: [FACT],
      market,
      demoKey: DEMO,
      postId: 'test-post',
      sourceTitle: 'Paid work and grades',
    })

  afterEach(() => {
    for (const key of Object.keys(recordings)) delete recordings[key]
    onLiveResult(null)
  })

  it('replays the Nepal recording for a failed Nepal call, under the step name recordings already use', async () => {
    recordings[DEMO] = { market: recorded('Decide with your family.') }
    answering(failing)
    expect(await inMarket(NEPAL)).toEqual({
      ok: true,
      slots: [{ slide: 5, slot: 'takeaway', text: 'Decide with your family.' }],
      feedExcerpt: 'Deciding together.',
      replays: ['market'],
    })
  })

  it('never replays the Nepal recording for a failed India call: India replays only its own', async () => {
    recordings[DEMO] = { market: recorded('Decide with your family.') }
    answering(failing)
    expect(await inMarket(INDIA)).toEqual({ ok: false, error: client.AI_ERRORS.failed })

    recordings[DEMO] = { ...recordings[DEMO], 'market-IN': recorded('Talk it over at home.') }
    const res = await inMarket(INDIA)
    expect(res.ok && [res.slots[0]?.text, res.replays]).toEqual([
      'Talk it over at home.',
      ['market-IN'],
    ])
  })

  it('records a live India answer under its own step, so recording India never overwrites Nepal', async () => {
    const steps: string[] = []
    onLiveResult((key, step) => steps.push(`${key}:${step}`))
    await inMarket(INDIA)
    await inMarket(NEPAL)
    expect(steps).toEqual([`${DEMO}:market-IN`, `${DEMO}:market`])
  })
})

describe('a Nepal answer that overflows its box', () => {
  // The kicker box is cut to a sliver, so the reworded kicker is inside its character limit but
  // needs more lines than the box has room for, even at the legibility floor.
  const narrow = {
    ...theLine,
    slides: theLine.slides.map((slide) =>
      slide.spec.kind === 'cover'
        ? {
            ...slide,
            spec: {
              ...slide.spec,
              slots: slide.spec.slots.map((slot) =>
                slot.key === 'kicker' ? { ...slot, box: { ...slot.box, w: 250, h: 50 } } : slot,
              ),
            },
          }
        : slide,
    ),
  } as typeof theLine
  const overflowing = {
    slots: [{ slide: 1, slot: 'kicker', text: 'With your family, every' }],
    feed_excerpt: 'Deciding together.',
  }
  const fitting = {
    slots: [{ slide: 1, slot: 'kicker', text: 'Family' }],
    feed_excerpt: 'Deciding together.',
  }
  const narrowRevision = () => revision('Research', narrow)

  /** Answers in turn, the last one for every call after; the prompts the model saw are kept. */
  function answeringInTurn(...answers: unknown[]) {
    const users: string[] = []
    provider = {
      json: async (req) => {
        users.push(req.user)
        return JSON.stringify(answers[Math.min(users.length - 1, answers.length - 1)])
      },
      image: fakeProvider.image,
    }
    return users
  }

  it('is retried with the box problem, and the fitting answer is taken', async () => {
    const users = answeringInTurn(overflowing, fitting)
    const res = await make(narrowRevision())
    expect(res.ok && res.slots).toEqual([{ slide: 1, slot: 'kicker', text: 'Family' }])
    expect(users).toHaveLength(2)
    expect(users[1]).toMatch(/Slide 1 · kicker needs 2 lines, room for 1/)
    expect(users[1]).toContain('shorten')
  })

  it('fails when every attempt overflows, and the overflowing answer is never cached', async () => {
    const users = answeringInTurn(overflowing)
    const res = await make(narrowRevision())
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(users).toHaveLength(3)
    expect(puts).toEqual([])
  })
})

describe('a Nepal overflow the model cannot fix', () => {
  // A factual slot the model does not reword: the money figure grows by its NPR conversion and the
  // slot, cut to one line, no longer fits. Rewording the presentational slots cannot help.
  const MONEY = {
    ...FACT,
    id: 'f1',
    text: 'The course costs AUD 499.',
    value: { number: 499, unit: 'aud' },
    ref: '¶1',
  }
  const tight = {
    ...theLine,
    slides: theLine.slides.map((slide) =>
      slide.spec.kind === 'body'
        ? {
            ...slide,
            spec: {
              ...slide.spec,
              slots: slide.spec.slots.map((slot) =>
                slot.key === 'body' ? { ...slot, box: { ...slot.box, w: 300, h: 60 } } : slot,
              ),
            },
          }
        : slide,
    ),
  } as typeof theLine
  const moneyRevision = (): Input['revision'] => {
    const rev = revision('Research', tight)
    const [cover] = rev.structure.slides
    return {
      ...rev,
      structure: {
        ...rev.structure,
        slides: [
          cover,
          {
            kind: 'body',
            slots: {
              heading: plain('Cost'),
              body: { text: 'Pay AUD 499.', factIds: ['f1'], factual: true },
            },
          },
          { kind: 'take', slots: { takeaway: plain('Keep paid work modest.') } },
        ],
      },
    }
  }

  it('is not reported to the model: its own slots fit, so one call is enough', async () => {
    const res = await marketRewording({
      revision: moneyRevision(),
      facts: [MONEY],
      market: NEPAL,
      demoKey: null,
      postId: 'test-post',
      sourceTitle: 'Paid work and grades',
    })
    expect(res.ok).toBe(true)
    expect(seen).toHaveLength(1)
  })
})

describe('the market spec', () => {
  it('has an example that parses with its schema and passes the schema guard', () => {
    expect(MARKET.schema.safeParse(MARKET.example.answer).success).toBe(true)
    expect(() => toModelSchema(MARKET.schema)).not.toThrow()
    expect(MARKET).toMatchObject({
      useCase: 'market',
      version: 'market.v2',
      tier: 'lite',
      temperature: 0.4,
    })
  })
})

describe('a market version in the post’s language (GD37)', () => {
  const nepali = (over: Partial<Input> = {}) =>
    marketRewording({
      revision: revision(),
      facts: [FACT],
      market: NEPAL,
      demoKey: null,
      postId: 'test-post',
      sourceTitle: 'Paid work and grades',
      language: 'ne',
      ...over,
    })

  it('sends a Nepali post its language and the rule, and takes the fake’s wording in Devanagari', async () => {
    const systems: string[] = []
    provider = {
      json: async (req) => {
        seen.push(req.data)
        systems.push(req.system)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await nepali()
    if (!res.ok) throw new Error(res.error)
    expect(seen[0]).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(systems[0]).toContain(languageRule('Nepali'))
    const takeaway = res.slots.find((s) => s.slot === 'takeaway')?.text ?? ''
    expect(scriptShare(takeaway, 'devanagari')).toBe(1)
    expect(scriptShare(res.feedExcerpt, 'devanagari')).toBe(1)
  })

  it('refuses wording in English, or with Devanagari digits, for a Nepali post', async () => {
    const asked: string[] = []
    const answeringAsked = (answer: unknown) => {
      provider = {
        json: async (req) => {
          asked.push(req.user)
          return JSON.stringify(answer)
        },
        image: fakeProvider.image,
      }
    }
    answeringAsked({
      slots: [{ slide: 1, slot: 'kicker', text: 'For your family' }],
      feed_excerpt: 'Planning study time together as a family?',
    })
    expect(await nepali()).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(asked[1]).toContain(RETRY_LEAD)
    expect(asked[1]).toContain('slots and feed_excerpt: write it in Nepali, in its own script')
    asked.length = 0
    store.clear()
    answeringAsked({
      slots: [{ slide: 1, slot: 'kicker', text: 'परिवारका लागि' }],
      feed_excerpt: 'परिवारसँग २० घण्टा?',
    })
    expect(await nepali()).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(asked[1]).toContain('feed_excerpt: "२" is not a Western digit')
  })

  it('sends an English post no language and no rule', async () => {
    const systems: string[] = []
    provider = {
      json: async (req) => {
        seen.push(req.data)
        systems.push(req.system)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    expect((await make()).ok).toBe(true)
    expect(seen[0]).not.toHaveProperty('language')
    expect(systems[0]).toBe(buildPrompt(MARKET, seen[0]).system)
  })
})
