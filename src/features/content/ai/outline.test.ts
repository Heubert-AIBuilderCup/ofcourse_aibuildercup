// A post's outline (GD32), with the fake provider and an in-memory call log and cache: no network,
// no database. Code checks the count and order against the look, its layouts, and each point.

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

const { outlinePost, outlineProblems } = await import('./outline')
const { OUTLINE, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { languageById } = await import('../languages')
const { toModelSchema } = await import('./schema-guard')
const { templateById } = await import('../templates')
const { outlineShape } = await import('../lib/outline')
const { FORMATS } = await import('../formats')
const { POINT_MAX } = await import('../model/types')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')

type Answer = Parameters<typeof outlineProblems>[0]
type Fact = import('../model/types').Fact
type IdeaCard = import('../model/types').IdeaCard

const found = templateById('field-notes')
if (!found) throw new Error('field-notes missing')
const look = found

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
  fact('f3', 'One in 3 students skipped classes for shifts.', false),
]
const CARD: IdeaCard = {
  angle: 'The limit that works',
  hook: 'There is a point where paid work starts to cost you.',
  audience: 'First-year students',
  look: 'field-notes',
  slides: 5,
}

const slide = (layout: Answer['slides'][number]['layout'], job = 'point', point = 'A point.') =>
  ({ job, layout, point }) as Answer['slides'][number]
const clean = (): Answer => ({
  slides: [
    slide('cover', 'hook', 'Paid work has a limit.'),
    slide('picture', 'point', 'Most students who work do so in retail.'),
    slide('number', 'proof', 'Up to 20 hours a week kept grades steady.'),
    slide('checklist', 'step', 'Plan your shifts around your study.'),
    slide('takeaway', 'takeaway', 'Protect your study time.'),
  ],
})
const context = { template: look, facts: FACTS }

beforeEach(() => store.clear())
afterEach(() => {
  provider = fakeProvider
})

describe('the outline spec', () => {
  it('has an example that parses with its own schema and passes the schema guard', () => {
    expect(OUTLINE.schema.safeParse(OUTLINE.example.answer).success).toBe(true)
    expect(() => toModelSchema(OUTLINE.schema)).not.toThrow()
    expect(OUTLINE).toMatchObject({ useCase: 'outline', version: 'outline.v3', tier: 'lite' })
    // The bullets layout is one an outline may choose (GD34).
    expect(OUTLINE.rules.some((r) => r.includes('bullets for three to five short points'))).toBe(
      true,
    )
  })
})

describe('outlineProblems (GD32)', () => {
  it("passes an outline in the look's counts, order and layouts whose points hold only the facts' numbers", () => {
    expect(outlineProblems(clean(), context)).toEqual([])
  })

  it('takes the bullets layout for a middle slide (GD34)', () => {
    const listed = clean()
    listed.slides[3] = slide('bullets', 'point', 'What to check before a shift.')
    expect(outlineProblems(listed, context)).toEqual([])
  })

  it("names a count outside the look's and slides out of its order", () => {
    const short = clean()
    short.slides.splice(1, 2)
    expect(outlineProblems(short, context)).toContain(
      'slides: A Field Notes post has 5 to 7 slides.',
    )
    const swapped = clean()
    swapped.slides.reverse()
    expect(outlineProblems(swapped, context)).toContain(
      "slides: Keep the slides in the look's order: cover, then middle, then takeaway.",
    )
  })

  it('names an empty point, one over 120 characters, and a number no supported fact holds', () => {
    const bad = clean()
    bad.slides[1].point = ' '
    bad.slides[2].point = 'x'.repeat(121)
    // 20 is a supported fact's; 25 is no fact's, and 3 only an unsupported one's.
    bad.slides[3].point = 'Not 20 but 25 hours, and 3 shifts.'
    const problems = outlineProblems(bad, context)
    expect(problems.slice(0, 2)).toEqual([
      'slides.1.point: write it.',
      'slides.2.point: 121 characters; at most 120.',
    ])
    const numbers = problems.slice(2)
    expect(numbers).toHaveLength(2)
    expect(
      numbers.every(
        (p) => p.startsWith('slides.3.point: "') && p.endsWith('" is a number no fact holds.'),
      ),
    ).toBe(true)
    expect(numbers[0]).toContain('25')
    expect(numbers[1]).toContain('3')
  })
})

describe('outlinePost (GD32)', () => {
  function recordOutlineCalls(): unknown[] {
    const data: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'outline') data.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return data
  }

  it("outlines the idea in its look from the supported facts, the idea, the format and the brand's voice", async () => {
    const sent = recordOutlineCalls()
    const res = await outlinePost({
      template: look,
      ideas: [CARD],
      format: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    if (!res.ok) throw new Error(res.error)
    expect(
      outlineShape(
        look,
        res.slides.map((s) => s.layout),
      ),
    ).toEqual([])
    expect(res.slides[0]).toMatchObject({ job: 'hook', layout: 'cover' })
    expect(res.slides.at(-1)).toMatchObject({ job: 'takeaway', layout: 'takeaway' })
    expect(sent).toHaveLength(1)
    const data = sent[0] as {
      look: { id: string; layouts: { id: string; kind: string }[] }
      idea: unknown
      format: unknown
      brand_voice: string
      facts: { id: string }[]
    }
    expect(data.look.id).toBe('field-notes')
    expect(data.look.layouts.map((l) => l.id)).toEqual(Object.keys(look.layouts ?? {}))
    expect(data.idea).toEqual({
      combine: false,
      cards: [{ angle: CARD.angle, hook: CARD.hook, audience: CARD.audience }],
    })
    expect(data.format).toBeNull()
    expect(data.brand_voice.length).toBeGreaterThan(0)
    expect(data.facts.map((f) => f.id)).toEqual(['f1', 'f2'])
  })

  it('sends the chosen format with its description and slide jobs, and a new attempt is a new call (GD33)', async () => {
    const sent = recordOutlineCalls()
    const ask = (attempt: number) =>
      outlinePost({
        template: look,
        ideas: [CARD],
        format: 'myth-vs-fact',
        facts: FACTS,
        postId: 'test-post',
        attempt,
      })
    expect((await ask(1)).ok).toBe(true)
    const myth = FORMATS.find((x) => x.id === 'myth-vs-fact')
    expect((sent[0] as { format: unknown }).format).toEqual({
      id: 'myth-vs-fact',
      label: myth?.label,
      description: myth?.description,
      jobs: myth?.jobs,
    })
    expect((await ask(1)).ok).toBe(true)
    expect(sent).toHaveLength(1)
    expect((await ask(2)).ok).toBe(true)
    expect(sent).toHaveLength(2)
  })

  it('fails with the standard message on [fake:fail-outline]', async () => {
    const res = await outlinePost({
      template: look,
      ideas: [{ ...CARD, hook: `${CARD.hook} [fake:fail-outline]` }],
      format: null,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
    })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('an outline in the post’s language (GD37)', () => {
  it('refuses Latin points for a Thai post, and nothing for an English one', () => {
    const thai = { ...context, language: languageById('th') ?? undefined }
    expect(outlineProblems(clean(), thai)).toEqual([
      expect.stringMatching(/^slides: write it in Thai, in its own script/),
    ])
    expect(outlineProblems(clean(), context)).toEqual([])
  })

  it('counts a Nepali, Hindi or Thai point of 120 characters as a reader sees them as within the limit', () => {
    for (const id of NATIVE_IDS) {
      const answer = clean()
      const slides = answer.slides.map((s) => ({ ...s, point: nativeOf(id, POINT_MAX) }))
      const language = languageById(id) ?? undefined
      expect(outlineProblems({ ...answer, slides }, { ...context, language }), id).toEqual([])
    }
  })

  it('sends a Thai post its language and the rule, and the fake outlines in Thai; English gets neither', async () => {
    const seen: { system: string; data: unknown }[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'outline') seen.push({ system: req.system, data: req.data })
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const ask = (language: 'th' | 'en') =>
      outlinePost({
        template: look,
        ideas: [CARD],
        format: null,
        facts: FACTS,
        postId: 'test-post',
        attempt: 1,
        language,
      })
    const thai = await ask('th')
    if (!thai.ok) throw new Error(thai.error)
    expect(seen[0].data).toMatchObject({ language: { id: 'th', label: 'Thai' } })
    expect(seen[0].system).toContain(languageRule('Thai'))
    expect(scriptShare(thai.slides.map((s) => s.point).join('\n'), 'thai')).toBe(1)
    expect((await ask('en')).ok).toBe(true)
    expect(seen[1].data).not.toHaveProperty('language')
    expect(seen[1].system).toBe(buildPrompt(OUTLINE, seen[1].data).system)
  })
})
