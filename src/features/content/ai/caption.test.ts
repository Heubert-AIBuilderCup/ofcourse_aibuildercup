// G6, the social caption, with the fake provider and an in-memory call log and cache: no network,
// no database. The model writes only the hook and the call to action (criterion 109); code
// assembles the rest from the post's own lines, the search line and the tags, and checks the
// model's part: no number, no banned phrase, within the platform's words (criterion 65).

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

const { HASHTAG, writeCaption } = await import('./caption')
const { CAPTION, RETRY_LEAD, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { toModelSchema } = await import('./schema-guard')
const { PAGE_BRANDS } = await import('../brands')
const { GUIDELINE } = await import('../brands/guideline')
const { templateById } = await import('../templates')
const { TAGS } = await import('../tags')

type Input = Parameters<typeof writeCaption>[0]

const theLine = templateById('the-line')
if (!theLine) throw new Error('the-line template missing')
const CEREBRAL = PAGE_BRANDS.find((b) => b.id === 'cerebral')
if (!CEREBRAL) throw new Error('cerebral brand missing')

/** What the fake writes for every caption. */
const HOOK = 'Before you decide, read what the research says.'
const CALL = 'Save this for later and share it with a friend who needs it.'
const TITLE = 'Paid work'
const SEARCH = `To find this again, search “OfCourse ${TITLE}”`
const TAKEAWAY = 'Keep paid work modest.'
/** The post's sources by name, and the line every caption ends with (GD31). */
const SOURCES = ['abc.net.au', 'studyaustralia.gov.au']
const SOURCES_TAIL = 'Sources: abc.net.au, studyaustralia.gov.au'

const fact = (id: string, text: string, number: number | null) => ({
  id,
  text,
  value: number === null ? null : { number, unit: 'number' },
  ref: '¶1',
  quote: text,
  supported: true,
  why: null,
  span: null,
})
const F1 = fact('f1', 'Students working up to 20 hours a week had similar grades.', 20)
const F2 = fact('f2', 'The survey covered 8 universities.', 8)
const UNBOUND = fact('f9', 'A fact no slide uses, from 1999.', 1999)

const plain = (text: string) => ({ text, factIds: [], factual: false })
const bound = (text: string, factIds: string[]) => ({ text, factIds, factual: true })
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

function revision(
  bodies: { text: string; factIds: string[] }[] = [
    { text: F1.text, factIds: ['f1'] },
    { text: F2.text, factIds: ['f2'] },
  ],
): Input['revision'] {
  return {
    factsId: 'facts1',
    emotion: null,
    structure: {
      templateId: 'the-line',
      artPrompt: 'A desk.',
      slides: [
        {
          kind: 'cover',
          slots: {
            kicker: plain('Research'),
            phrase: plain('The line'),
            byline: plain('OfCourse'),
          },
        },
        ...bodies.map((b, i) => ({
          kind: 'body' as const,
          slots: { heading: plain(`Point ${i + 1}`), body: bound(b.text, b.factIds) },
        })),
        { kind: 'take', slots: { takeaway: plain(TAKEAWAY) } },
      ],
    },
    template: theLine as NonNullable<typeof theLine>,
    brand: CEREBRAL as NonNullable<typeof CEREBRAL>,
    themeId: 'cerebral',
    by: { userId: 'u1', name: 'Editor', at: '2026-10-05T00:00:00.000Z' },
    note: 'social: Cerebral',
  }
}

const write = (over: Partial<Input> = {}) =>
  writeCaption({
    platform: 'instagram',
    brand: CEREBRAL as NonNullable<typeof CEREBRAL>,
    revision: revision(),
    facts: [F1, F2, UNBOUND],
    demoKey: null,
    postId: 'test-post',
    title: TITLE,
    tags: ['theme:books-movies', 'destination:NZ'],
    sources: SOURCES,
    ...over,
  })

let seen: unknown[] = []
let asked: string[] = []

beforeEach(() => {
  store.clear()
  seen = []
  asked = []
  provider = {
    json: async (req) => {
      seen.push(req.data)
      asked.push(req.user)
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})
afterEach(() => {
  provider = fakeProvider
})

/** A provider that answers every caption call with this. */
function answering(answer: unknown) {
  provider = {
    json: async (req) => {
      seen.push(req.data)
      asked.push(req.user)
      return JSON.stringify(answer)
    },
    image: fakeProvider.image,
  }
}

describe('writeCaption', () => {
  it('assembles the hook, the post’s own lines in slide order, the call to action, the search line and the sources last, with hashtags from the tags (109, GD31)', async () => {
    const res = await write()
    if (!res.ok) throw new Error(res.error)
    expect(res.text).toBe(
      `${HOOK}\n\n${F1.text}\n${F2.text}\n${TAKEAWAY}\n\n${CALL}\n\n${SEARCH}\n\n${SOURCES_TAIL}`,
    )
    expect(res.hashtags).toEqual(['#BooksAndMovies', '#NewZealand'])
    expect(res.replays).toEqual([])
  })

  it('ends with "Read the full guide" and the blog’s address, after the sources, only when given one (BR7)', async () => {
    const url = 'https://ofcourse.example/blog/paid-work-in-australia'
    const guided = await write({ guide: url })
    if (!guided.ok) throw new Error(guided.error)
    expect(guided.text.endsWith(`${SOURCES_TAIL}\n\nRead the full guide: ${url}`)).toBe(true)
    // The model never writes it: the line is not in what it is shown.
    expect(JSON.stringify(seen)).not.toContain(url)
    const plain = await write({ guide: null })
    if (!plain.ok) throw new Error(plain.error)
    expect(plain.text.endsWith(SOURCES_TAIL)).toBe(true)
    expect(plain.text).not.toContain('Read the full guide')
  })

  it('writes LinkedIn post text with no hashtags, whatever the tags', async () => {
    const res = await write({ platform: 'linkedin' })
    if (!res.ok) throw new Error(res.error)
    expect(res.text).toContain(`${F1.text}\n${F2.text}\n${TAKEAWAY}`)
    expect(res.hashtags).toEqual([])
  })

  it('leaves out a factual slot bound to no supported fact, and keeps a line as it is on the slide', async () => {
    const paraphrase = 'Working as much as 20 hours a week left grades where they were.'
    const res = await write({
      revision: revision([
        { text: paraphrase, factIds: ['f1'] },
        { text: 'A line bound to nothing.', factIds: [] },
        { text: 'A line bound to an unsupported fact.', factIds: ['f8'] },
      ]),
      facts: [F1, { ...fact('f8', 'Not supported.', null), supported: false }],
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.text).toContain(`${paraphrase}\n${TAKEAWAY}`)
    expect(res.text).not.toContain('bound to')
  })

  it('shows the model the slides, the body lines and the brand, with the page’s copy style when it has one; never an unbound fact (105)', async () => {
    await write({ copyStyle: 'Short lines. One question at the end.' })
    expect(seen[0]).toMatchObject({
      platform: 'instagram',
      brand: {
        name: CEREBRAL.name,
        copy_style: 'Short lines. One question at the end.',
      },
      body: [F1.text, F2.text, TAKEAWAY],
    })
    const data = JSON.stringify(seen[0])
    // The guideline's voice, not the page's own tone (GD15).
    expect(data).not.toContain(CEREBRAL.tone)
    for (const rule of GUIDELINE.voice.rules) expect(data).toContain(rule)
    expect(data).toContain('The line')
    expect(data).not.toContain(UNBOUND.text)
    store.clear()
    await write({ copyStyle: null })
    expect(JSON.stringify(seen[1])).not.toContain('copy_style')
  })

  it('carries the guideline voice, and a change to it into the next caption (GD15)', async () => {
    await write()
    expect(JSON.stringify(seen[0])).toContain(GUIDELINE.voice.rules[0])
    store.clear()
    const changed = {
      ...GUIDELINE,
      voice: { ...GUIDELINE.voice, rules: ['Sound like a patient tutor.'] },
    }
    await write({ guideline: changed })
    expect(JSON.stringify(seen[1])).toContain('Sound like a patient tutor.')
    expect(JSON.stringify(seen[1])).not.toContain(GUIDELINE.voice.rules[0])
  })

  it('refuses a hook with a number, retries with the problem, and fails when every attempt carries one (65, 109)', async () => {
    const marked = revision()
    marked.structure.slides[3].slots.takeaway.text = 'Keep it modest. [fake:caption-number]'
    const res = await write({ revision: marked })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    // Primary, retry with the problems, then Pro.
    expect(seen).toHaveLength(3)
    expect(asked[1]).toContain(RETRY_LEAD)
    expect(asked[1]).toContain('hook: "999" is a number')
  })

  it('refuses a number word in the hook, a number in the call to action, a banned phrase, an empty hook, and too many words', async () => {
    const good = { hook: HOOK, call_to_action: CALL }
    const cases: unknown[] = [
      { ...good, hook: 'Twenty hours a week, and your grades hold.' },
      { ...good, call_to_action: 'Read the full study, all 8 universities of it.' },
      { ...good, hook: 'The best plan for first year.' },
      { ...good, hook: '   ' },
      { ...good, call_to_action: '' },
      { ...good, hook: Array.from({ length: 21 }, () => 'word').join(' ') },
      { ...good, call_to_action: Array.from({ length: 16 }, () => 'word').join(' ') },
    ]
    for (const answer of cases) {
      answering(answer)
      store.clear()
      expect(await write()).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    }
  })

  it('keeps an Instagram caption within 150 words: the first lines that fit, then the takeaway, never a line cut in two', async () => {
    const body = (n: number) =>
      `Point ${n}: ${Array.from({ length: 38 }, (_, i) => `word${i}`).join(' ')}.`
    const res = await write({
      revision: revision(
        Array.from({ length: 5 }, (_, i) => ({ text: body(i + 1), factIds: ['f1'] })),
      ),
    })
    if (!res.ok) throw new Error(res.error)
    expect(words(res.text)).toBeLessThanOrEqual(150)
    expect(res.text.endsWith(SOURCES_TAIL)).toBe(true)
    expect(res.text).toContain(`${body(1)}\n${body(2)}\n${TAKEAWAY}`)
    expect(res.text).not.toContain('Point 3')
    expect(seen[0]).toMatchObject({ body: [body(1), body(2), TAKEAWAY] })
  })

  it('makes hashtags from the tag labels, capitalised and without spaces: unknown ids and labels without a letter are skipped, at most 8', async () => {
    const res = await write({ tags: ['nope:x', 'age:21-25', ...TAGS.map((t) => t.id)] })
    if (!res.ok) throw new Error(res.error)
    expect(res.hashtags).toEqual([
      '#Australia',
      '#UnitedKingdom',
      '#NewZealand',
      '#UnitedStates',
      '#Nepal',
      '#India',
      '#Thailand',
      '#WorkAndStudyLife',
    ])
  })
})

describe('the caption spec', () => {
  it('has an example that parses with its schema and passes the schema guard', () => {
    expect(CAPTION.schema.safeParse(CAPTION.example.answer).success).toBe(true)
    expect(() => toModelSchema(CAPTION.schema)).not.toThrow()
    expect(CAPTION).toMatchObject({
      useCase: 'caption',
      version: 'caption.v5',
      tier: 'lite',
      temperature: 0.5,
    })
    expect(CAPTION.rules.some((r) => r.includes('DATA.brand.copy_style'))).toBe(true)
    expect(CAPTION.rules.some((r) => /never write a number/i.test(r))).toBe(true)
  })
})

describe('a caption in the post’s language (GD37)', () => {
  it('takes a hashtag an editor types in Nepali, Hindi or Thai, its vowel signs and marks among its letters', () => {
    for (const tag of ['#नेपाल', '#विद्यार्थी', '#भारत', '#पढ़ाई', '#การศึกษา', '#ทุนการศึกษา']) {
      expect(HASHTAG.test(tag), tag).toBe(true)
    }
    for (const tag of ['#', 'नेपाल', '#नेपाल घूम', '#"ไทย"'])
      expect(HASHTAG.test(tag), tag).toBe(false)
  })

  it('sends a Thai post its language and the rule, and takes the fake’s hook in Thai', async () => {
    const systems: string[] = []
    provider = {
      json: async (req) => {
        seen.push(req.data)
        systems.push(req.system)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await write({ language: 'th' })
    if (!res.ok) throw new Error(res.error)
    expect(seen[0]).toMatchObject({ language: { id: 'th', label: 'Thai' } })
    expect(systems[0]).toContain(languageRule('Thai'))
    const hook = res.text.split('\n\n')[0]
    expect(scriptShare(hook, 'thai')).toBe(1)
  })

  it('refuses a hook and call to action in English, or with Thai digits, for a Thai post', async () => {
    answering({ hook: HOOK, call_to_action: CALL })
    expect(await write({ language: 'th' })).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(asked[1]).toContain('hook and call_to_action: write it in Thai, in its own script')
    asked = []
    answering({ hook: 'อ่านก่อน ๓ ครั้ง', call_to_action: 'บันทึกไว้' })
    expect(await write({ language: 'th' })).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(asked[1]).toContain('hook: "๓" is not a Western digit')
  })

  it('ends a Nepali caption with the search line, the sources heading and the guide line in Nepali (GD39)', async () => {
    const url = 'https://ofcourse.example/blog/paid-work-in-australia'
    const res = await write({ language: 'ne', guide: url })
    if (!res.ok) throw new Error(res.error)
    expect(res.text.split('\n\n').slice(-3)).toEqual([
      `यो फेरि भेट्टाउन “OfCourse ${TITLE}” खोज्नुहोस्`,
      'स्रोतहरू: abc.net.au, studyaustralia.gov.au',
      `पूरा गाइड पढ्नुहोस्: ${url}`,
    ])
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
    expect((await write()).ok).toBe(true)
    expect(seen[0]).not.toHaveProperty('language')
    expect(systems[0]).toBe(buildPrompt(CAPTION, seen[0]).system)
  })
})
