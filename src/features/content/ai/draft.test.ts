// G3, facts to structures, with the fake provider and an in-memory call log and cache: no network,
// no database. Code checks keys, counts, fact ids, the art prompt, banned phrases and numbers.

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

const {
  ART_PROMPT_ERROR,
  artPromptError,
  draftStructures,
  redraftSlide,
  redraftVersion,
  toStructure,
} = await import('./draft')
type DraftAnswer = import('./draft').DraftAnswer
type DraftVersion = import('./draft').DraftVersion
type SlideAnswer = import('./draft').SlideAnswer
const { extractFacts } = await import('./extract')
const { DRAFT, DRAFT_SLIDE, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare, wordCount: thaiAwareCount } = await import('../text/script')
const { NATIVE, NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')
const { toModelSchema } = await import('./schema-guard')
const { templateById } = await import('../templates')
const { unboundSlots } = await import('../lib/claims')
const { NO_FACTS_ERROR } = await import('../lib/failure')
const { DEMO_SOURCES } = await import('../demo-sources')
const { EMOTIONS, emotionById } = await import('../emotions')
const { FEED_BRAND } = await import('../brands')
const { GUIDELINE, compile } = await import('../brands/guideline')

const found = DEMO_SOURCES.find((s) => s.key === 'paid-work')
if (!found) throw new Error('demo source missing')
const paidWork = found
const theLine = templateById('the-line')
if (!theLine) throw new Error('the-line template missing')

const fakeDraft = FAKE_ANSWERS.draft
const fakeSlide = FAKE_ANSWERS.draft_slide

beforeEach(() => store.clear())
afterEach(() => {
  FAKE_ANSWERS.draft = fakeDraft
  FAKE_ANSWERS.draft_slide = fakeSlide
  provider = fakeProvider
})

async function paidWorkFacts() {
  const res = await extractFacts({ ...paidWork, postId: 'test-post' })
  if (!res.ok) throw new Error(res.error)
  return res
}

function draft(
  templateIds: string[],
  extracted: Awaited<ReturnType<typeof paidWorkFacts>>,
  over: {
    source?: typeof extracted.source
    attempt?: number
    emotion?: string | null
    copyStyle?: string | null
    guideline?: typeof GUIDELINE
  } = {},
) {
  return draftStructures({
    templateIds,
    source: over.source ?? extracted.source,
    facts: extracted.facts,
    attempt: over.attempt ?? 1,
    postId: 'test-post',
    emotion: over.emotion ?? null,
    ...(over.copyStyle !== undefined && { copyStyle: over.copyStyle }),
    ...(over.guideline && { guideline: over.guideline }),
  })
}

/** draftStructures' input for one Field Notes call. */
function base(extracted: Awaited<ReturnType<typeof paidWorkFacts>>) {
  return {
    templateIds: ['field-notes'],
    source: extracted.source,
    facts: extracted.facts,
    attempt: 1,
    postId: 'test-post',
    emotion: null,
  }
}

/** A correct version for the-line: cover, three bodies bound to f1, take. */
function lineAnswer(): DraftVersion {
  const body = (n: number) => ({
    kind: 'body' as const,
    layout: null,
    slots: [
      { key: 'heading', text: `Finding ${n}`, fact_ids: [] },
      { key: 'body', text: 'Students who worked had similar grades.', fact_ids: ['f1'] },
    ],
  })
  return {
    angle: 'The surprising number',
    slides: [
      {
        kind: 'cover',
        layout: null,
        slots: [
          { key: 'kicker', text: 'Research, briefly', fact_ids: [] },
          { key: 'phrase', text: 'Hours', fact_ids: [] },
          { key: 'byline', text: 'OfCourse · 5 min read', fact_ids: [] },
        ],
      },
      body(1),
      body(2),
      body(3),
      {
        kind: 'take',
        layout: null,
        slots: [{ key: 'takeaway', text: 'Keep it sensible.', fact_ids: [] }],
      },
    ],
    art_prompt: 'A student at a window at dusk, flat illustration.',
  }
}

const FACTS = [
  {
    id: 'f1',
    text: 'Students working up to 20 hours a week had grades similar to students who did not work.',
    value: { number: 20, unit: 'number' },
    ref: '¶2',
    quote: null,
    supported: true,
    why: null,
    span: null,
  },
]

describe('artPromptError (38)', () => {
  it('allows a scene with no words, numbers or brands', () => {
    expect(artPromptError('a student at a window at dusk, flat illustration')).toBeNull()
  })

  it('refuses quoted words, a digit and a brand name', () => {
    expect(artPromptError('a sign reading "OPEN"')).toBe(ART_PROMPT_ERROR)
    expect(artPromptError('a sign reading “OPEN”')).toBe(ART_PROMPT_ERROR)
    expect(artPromptError('3 students')).toBe(ART_PROMPT_ERROR)
    expect(artPromptError('the OfCourse logo on a mug')).toBe(ART_PROMPT_ERROR)
    expect(artPromptError('a cerebral poster on a wall')).toBe(ART_PROMPT_ERROR)
  })
})

describe('toStructure', () => {
  it('turns a correct answer into a Structure with the template’s factual flags', () => {
    const res = toStructure(theLine, lineAnswer(), FACTS)
    if (!res.ok) throw new Error(res.problems.join('\n'))
    expect(res.structure.templateId).toBe('the-line')
    expect(res.structure.artPrompt).toBe('A student at a window at dusk, flat illustration.')
    expect(res.structure.slides).toHaveLength(5)
    expect(res.structure.slides[1].slots.body).toEqual({
      text: 'Students who worked had similar grades.',
      factIds: ['f1'],
      factual: true,
    })
    expect(res.structure.slides[0].slots.kicker.factual).toBe(false)
  })

  it('names an unknown slot key, a missing one, a body count over repeat.max and an unknown fact', () => {
    const answer = lineAnswer()
    answer.slides[0].slots.push({ key: 'subtitle', text: 'More', fact_ids: [] })
    answer.slides[0].slots = answer.slides[0].slots.filter((s) => s.key !== 'byline')
    const extra = answer.slides[1]
    answer.slides.splice(2, 0, extra, extra, extra)
    answer.slides[1] = {
      kind: 'body',
      layout: null,
      slots: [
        { key: 'heading', text: 'Finding 1', fact_ids: [] },
        { key: 'body', text: 'Students who worked had similar grades.', fact_ids: ['f99'] },
      ],
    }
    const res = toStructure(theLine, answer, FACTS)
    if (res.ok) throw new Error('expected problems')
    expect(res.problems.some((p) => p.includes('subtitle'))).toBe(true)
    expect(res.problems.some((p) => p.includes('byline'))).toBe(true)
    expect(res.problems.some((p) => p.includes('6 body slides'))).toBe(true)
    expect(res.problems.some((p) => p.includes('f99'))).toBe(true)
  })

  it('names a slide kind the template does not have and slides out of order', () => {
    const answer = lineAnswer()
    answer.slides.push({ kind: 'single', layout: null, slots: [] })
    const unknown = toStructure(theLine, answer, FACTS)
    if (unknown.ok) throw new Error('expected problems')
    expect(unknown.problems.some((p) => p.includes('single'))).toBe(true)

    const swapped = lineAnswer()
    swapped.slides.reverse()
    const order = toStructure(theLine, swapped, FACTS)
    if (order.ok) throw new Error('expected problems')
    expect(order.problems.some((p) => p.includes('order'))).toBe(true)
  })
})

describe('toStructure for a look (GD4)', () => {
  const fieldNotes = templateById('field-notes')
  if (!fieldNotes) throw new Error('field-notes missing')
  const plain = (key: string, text: string) => ({ key, text, fact_ids: [] as string[] })
  /** A Field Notes version: cover, picture, number, checklist, takeaway. */
  function lookAnswer(): DraftVersion {
    return {
      angle: 'The surprising number',
      slides: [
        {
          kind: 'cover',
          layout: 'cover',
          slots: [plain('kicker', 'Research, briefly'), plain('heading', 'Work and grades')],
        },
        {
          kind: 'body',
          layout: 'picture',
          slots: [
            plain('heading', 'What the survey found'),
            {
              key: 'body',
              text: 'Students working up to 20 hours a week had grades similar to students who did not work.',
              fact_ids: ['f1'],
            },
          ],
        },
        {
          // The kind the model wrote is wrong: the layout decides it.
          kind: 'take',
          layout: 'number',
          slots: [
            plain('number', '20'),
            plain('label', 'hours a week'),
            {
              key: 'body',
              text: 'Students working up to 20 hours a week had grades similar to students who did not work.',
              fact_ids: ['f1'],
            },
          ],
        },
        {
          kind: 'body',
          layout: 'checklist',
          slots: [
            plain('heading', 'Before a shift'),
            plain('items', 'Check your week\nAsk for exam weeks off'),
          ],
        },
        {
          kind: 'take',
          layout: 'takeaway',
          slots: [
            plain('heading', 'Keep it steady'),
            plain('body', 'Plan your shifts around your study.'),
          ],
        },
      ],
      art_prompt: 'A student at a window at dusk, flat illustration.',
    }
  }

  it("sets each slide's layout and kind from the look's layout and checks its slots by that layout", () => {
    const res = toStructure(fieldNotes, lookAnswer(), FACTS)
    if (!res.ok) throw new Error(res.problems.join('\n'))
    expect(res.structure.slides.map((s) => [s.layout, s.kind])).toEqual([
      ['cover', 'cover'],
      ['picture', 'body'],
      ['number', 'body'],
      ['checklist', 'body'],
      ['takeaway', 'take'],
    ])
    expect(Object.keys(res.structure.slides[2].slots)).toEqual(['number', 'label', 'body'])
    expect(res.structure.slides[2].slots.body.factual).toBe(true)
  })

  it('names a look slide with no layout, and a slot its layout does not have', () => {
    const answer = lookAnswer()
    answer.slides[1].layout = null
    answer.slides[3].slots.push(plain('quote', 'Not a checklist slot'))
    const res = toStructure(fieldNotes, answer, FACTS)
    if (res.ok) throw new Error('expected problems')
    expect(res.problems.some((p) => p.startsWith('slides.1.layout'))).toBe(true)
    expect(res.problems.some((p) => p.startsWith('slides.3.slots') && p.includes('quote'))).toBe(
      true,
    )
  })

  it('leaves an old template’s slides without a layout', () => {
    const answer = lineAnswer()
    answer.slides[1].layout = 'number'
    const res = toStructure(theLine, answer, FACTS)
    if (!res.ok) throw new Error(res.problems.join('\n'))
    expect(res.structure.slides.every((s) => (s.layout ?? null) === null)).toBe(true)
  })
})

/** The draft calls that reached the provider, by their user text. */
function recordDraftCalls(): string[] {
  const users: string[] = []
  provider = {
    json: (req) => {
      if (req.useCase === 'draft') users.push(req.user)
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
  return users
}

describe('draftStructures', () => {
  it('drafts three versions per ticked template in one call each, flattened in template order, labelled by angle (97)', async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    const res = await draft(['the-line', 'the-long-read'], extracted)
    if (!res.ok) throw new Error(res.error)
    expect(users).toHaveLength(2)
    expect(res.items.map((i) => i.structure.templateId)).toEqual([
      'the-line',
      'the-line',
      'the-line',
      'the-long-read',
      'the-long-read',
      'the-long-read',
    ])
    expect(res.items[0].template).toEqual(theLine)
    expect(res.items[3].template).toEqual(templateById('the-long-read') as never)
    const angles = res.items.slice(0, 3).map((i) => i.angle)
    expect(angles.every((a) => a.length > 0)).toBe(true)
    expect(new Set(angles).size).toBe(3)
    expect(res.items.every((i) => i.problems.length === 0)).toBe(true)
    expect(res.replays).toEqual([])
  })

  it('drafts a look with the fake that fills every slot inside its limit and fits its boxes', async () => {
    const { layoutStructure } = await import('../layout/engine')
    const { fitChecks } = await import('../layout/fit')
    const { presetThemes } = await import('../brands/guideline')
    const { FEED_BRAND } = await import('../brands')
    const extracted = await paidWorkFacts()
    const res = await draft(['field-notes'], extracted)
    if (!res.ok) throw new Error(res.error)
    expect(res.items).toHaveLength(3)
    for (const { structure, template } of res.items) {
      const layout = layoutStructure({
        structure,
        template,
        brand: FEED_BRAND,
        sourceTitle: paidWork.title,
        facts: extracted.facts,
      })
      const rows = fitChecks({
        structure,
        template,
        theme: FEED_BRAND.themes[0],
        surfaces: presetThemes('pop'),
        brand: FEED_BRAND,
        layout,
      })
      expect(rows.filter((r) => !r.pass).map((r) => r.label)).toEqual([])
    }
  })

  it("sends a look's layouts with their slot keys, and every drafted slide has one of them (GD4)", async () => {
    const extracted = await paidWorkFacts()
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'draft') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await draft(['postcard'], extracted)
    if (!res.ok) throw new Error(res.error)
    const { template } = sent[0] as {
      template: {
        slides: object[]
        layouts: { id: string; kind: string; slots: { key: string }[] }[]
      }
    }
    const postcard = templateById('postcard')
    expect(template.layouts.map((l) => l.id)).toEqual(Object.keys(postcard?.layouts ?? {}))
    expect(template.layouts.find((l) => l.id === 'bars')?.slots.map((s) => s.key)).toEqual([
      'heading',
      'labelA',
      'valueA',
      'labelB',
      'valueB',
    ])
    for (const { structure } of res.items) {
      expect(structure.slides.every((s) => typeof s.layout === 'string')).toBe(true)
    }
  })

  it('sends the chosen idea, and two ideas to combine, and nothing when none (GD2)', async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    const card = (angle: string, hook: string) => ({
      angle,
      hook,
      audience: 'First-year students',
      look: 'field-notes' as const,
      slides: 5,
    })
    const one = card('The limit that works', 'There is a point where paid work starts to cost you.')
    const two = card('The question to ask', 'Ask this before you take on another shift.')
    expect((await draftStructures({ ...base(extracted), idea: { cards: [one] } })).ok).toBe(true)
    expect((await draftStructures({ ...base(extracted), idea: { cards: [one, two] } })).ok).toBe(
      true,
    )
    expect((await draft(['field-notes'], extracted)).ok).toBe(true)
    expect(users[0]).toContain(one.hook)
    expect(users[0]).toContain('"combine": false')
    expect(users[1]).toContain(one.hook)
    expect(users[1]).toContain(two.hook)
    expect(users[1]).toContain('"combine": true')
    expect(users[2]).not.toContain('"idea"')
  })

  /** A Field Notes outline of six slides, two of them a figure and a list. */
  const OUTLINE = [
    { job: 'hook', layout: 'cover', point: 'Paid work has a limit.' },
    { job: 'point', layout: 'picture', point: 'Most students who work keep their grades.' },
    { job: 'proof', layout: 'number', point: 'Up to 20 hours a week kept grades steady.' },
    { job: 'step', layout: 'checklist', point: 'Plan your shifts around your study.' },
    { job: 'point', layout: 'picture', point: 'Retail and hospitality hire most.' },
    { job: 'takeaway', layout: 'takeaway', point: 'Protect your study time.' },
  ] as const
  const outlined = { format: null, slides: OUTLINE.map((s) => ({ ...s })) }

  it('drafts every version to the outline, its slides in order with their layouts, and sends each point (GD32)', async () => {
    const extracted = await paidWorkFacts()
    const sent: unknown[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'draft') sent.push(req.data)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await draftStructures({ ...base(extracted), outline: outlined })
    if (!res.ok) throw new Error(res.error)
    expect(res.items).toHaveLength(3)
    for (const item of res.items) {
      expect(item.structure.slides.map((s) => s.layout)).toEqual(OUTLINE.map((s) => s.layout))
      expect(item.problems).toEqual([])
    }
    expect((sent[0] as { outline: unknown }).outline).toEqual({
      format: null,
      slides: OUTLINE.map((s, i) => ({ slide: i + 1, ...s })),
    })
  })

  it('sends a version that departs from the outline back to the model: another slide count or layout (GD32)', async () => {
    const extracted = await paidWorkFacts()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      // One middle slide too few in the first version, a layout swapped in the second.
      answer.versions[0].slides.splice(4, 1)
      answer.versions[1].slides[4].layout = 'quote'
      return answer
    }
    const users = recordDraftCalls()
    const res = await draftStructures({ ...base(extracted), outline: outlined })
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(users[1]).toContain(
      'versions.0.slides: DATA.outline has 6 slides; write exactly 6, one for each, in its order.',
    )
    expect(users[1]).toContain(
      'versions.1.slides.4.layout: DATA.outline gives this slide the picture layout.',
    )
    expect(res.items.every((i) => i.structure.slides.length === 6)).toBe(true)
  })

  it('gives the fake drafts their planted traits, a missing fact reaching the editor as No source', async () => {
    const extracted = await paidWorkFacts()
    const res = await draft(['the-line', 'the-long-read', 'the-question'], extracted)
    if (!res.ok) throw new Error(res.error)
    // The first version of each template.
    const [line, longRead, question] = [0, 3, 6].map((i) => res.items[i].structure)
    expect(line.slides.map((s) => s.kind)).toEqual(['cover', 'body', 'body', 'body', 'take'])
    expect(line.slides[0].slots.phrase.text).toBe('20-hour')
    expect(line.slides[2].slots.body.text).toEndWith(
      'First year is the worst time to find out where your limit is.',
    )
    expect(longRead.slides[1].slots.body.text.split(/\s+/)).toHaveLength(121)
    expect(question.slides[1].slots.body.factIds).toEqual([])
    const unbound = unboundSlots(question, res.items[6].template, extracted.facts)
    // One entry per sentence of that body, all on slide 2.
    expect(new Set(unbound.map((u) => `${u.slide} ${u.reason}`))).toEqual(new Set(['2 No source']))
  })

  it('keeps a version that still fails after the ladder, with its problems, beside the clean two (97)', async () => {
    const extracted = await paidWorkFacts()
    FAKE_ANSWERS.draft = (data) => {
      const answer = fakeDraft?.(data) as DraftAnswer
      answer.versions[1].slides[0].slots[0].text = 'The best research'
      return answer
    }
    const users = recordDraftCalls()
    const res = await draft(['the-line'], extracted)
    if (!res.ok) throw new Error(res.error)
    // Flash, Flash with the problems, Pro: none fixed it, so the last answer stands, marked.
    expect(users).toHaveLength(3)
    expect(users[1]).toContain('versions.1.slides.0.slots.kicker: remove "best".')
    expect(res.items).toHaveLength(3)
    expect(res.items[0].problems).toEqual([])
    expect(res.items[1].problems).toEqual(['slides.0.slots.kicker: remove "best".'])
    expect(res.items[2].problems).toEqual([])
    expect(res.items[1].structure.slides[0].slots.kicker.text).toBe('The best research')
  })

  it('says there are no facts to write from when a draft with no supported fact fails (bug, 18 Oct)', async () => {
    const extracted = await paidWorkFacts()
    // As the model answered with DATA.facts empty: a paragraph ref where a fact id belongs.
    FAKE_ANSWERS.draft = (data) => {
      const answer = fakeDraft?.(data) as DraftAnswer
      for (const v of answer.versions) {
        for (const s of v.slides) for (const slot of s.slots) slot.fact_ids = ['¶1']
      }
      return answer
    }
    const none = await draftStructures({ ...base(extracted), facts: [] })
    expect(none).toEqual({ ok: false, error: NO_FACTS_ERROR })
    // With facts to cite, the same failure is the plain one.
    const some = await draftStructures({ ...base(extracted), attempt: 2 })
    expect(some).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })

  it('sends a repeated or empty angle back to the model', async () => {
    const extracted = await paidWorkFacts()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      answer.versions[1].angle = answer.versions[0].angle
      answer.versions[2].angle = ' '
      return answer
    }
    const users = recordDraftCalls()
    const res = await draft(['the-line'], extracted)
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(users[1]).toContain('versions.1.angle:')
    expect(users[1]).toContain('versions.2.angle:')
    expect(new Set(res.items.map((i) => i.angle)).size).toBe(3)
  })

  it('fails the step when the model never returns three versions', async () => {
    const extracted = await paidWorkFacts()
    FAKE_ANSWERS.draft = (data) => {
      const answer = fakeDraft?.(data) as DraftAnswer
      return { versions: answer.versions.slice(0, 2) }
    }
    const users = recordDraftCalls()
    const res = await draft(['the-line'], extracted)
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(users).toHaveLength(3)
    expect(users[1]).toContain('versions: return exactly three versions.')
  })

  it('carries the chosen emotion’s tone note into the prompt data, a custom word’s too, none when none (100)', async () => {
    const extracted = await paidWorkFacts()
    const users: string[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'draft') users.push(req.user)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const hopeful = emotionById('hopeful')
    if (!hopeful) throw new Error('no hopeful chip')
    expect((await draft(['the-line'], extracted, { emotion: 'hopeful' })).ok).toBe(true)
    expect(users[0]).toContain(hopeful.tone)
    expect(users[0]).toContain('"label": "Hopeful"')
    expect((await draft(['the-line'], extracted, { emotion: 'Wistful' })).ok).toBe(true)
    expect(users[1]).toContain('Write in a wistful tone throughout.')
    expect((await draft(['the-line'], extracted)).ok).toBe(true)
    expect(users[2]).toContain('"emotion": null')
    expect(users).toHaveLength(3)
  })

  it("sends the guideline's voice as brand_voice, in place of the feed brand's tone (GD15)", async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    expect((await draft(['the-line'], extracted)).ok).toBe(true)
    expect(users[0]).toContain('"brand_voice"')
    for (const rule of GUIDELINE.voice.rules) expect(users[0]).toContain(rule)
    expect(users[0]).toContain(GUIDELINE.voice.readingLevel)
    expect(users[0]).not.toContain(FEED_BRAND.tone)
  })

  it('carries a change to the guideline into the next draft (GD15)', async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    const changed = {
      ...GUIDELINE,
      voice: { ...GUIDELINE.voice, rules: ['Sound like a patient tutor.'] },
    }
    expect(compile(changed).guidelineFor('copy')).toContain('patient tutor')
    expect((await draft(['the-line'], extracted, { guideline: changed })).ok).toBe(true)
    expect(users[0]).toContain('Sound like a patient tutor.')
    expect(users[0]).not.toContain(GUIDELINE.voice.rules[0])
  })

  it("carries the page's copy style into the prompt data when its page has one, and nothing when none (105)", async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    const style = 'Short lines. Ask the reader one question.'
    expect((await draft(['the-line'], extracted, { copyStyle: style })).ok).toBe(true)
    expect(users[0]).toContain(`"copy_style": "${style}"`)
    // No design language: the data is what it was before pages had one.
    expect((await draft(['the-line'], extracted, { copyStyle: null })).ok).toBe(true)
    expect((await draft(['the-line'], extracted, { attempt: 2 })).ok).toBe(true)
    expect(users[1]).not.toContain('"copy_style"')
    expect(users[2]).not.toContain('"copy_style"')
  })

  it("carries the editor's notes as editor_notes, never as a paragraph, and nothing when none (GD21)", async () => {
    const extracted = await paidWorkFacts()
    const users = recordDraftCalls()
    const notes = 'I worked 25 hours a week in first year and it hurt.'
    const source = { ...extracted.source, notes }
    expect((await draft(['the-line'], extracted, { source })).ok).toBe(true)
    expect(users[0]).toContain(`"editor_notes": "${notes}"`)
    expect(users[0].split(notes)).toHaveLength(2)
    expect((await draft(['the-line'], extracted, { attempt: 2 })).ok).toBe(true)
    expect(users[1]).not.toContain('"editor_notes"')
  })

  it('drafts sketch-insight as one single slide', async () => {
    const extracted = await paidWorkFacts()
    const res = await draft(['sketch-insight'], extracted)
    if (!res.ok) throw new Error(res.error)
    const [slide] = res.items[0].structure.slides
    expect(slide.kind).toBe('single')
    expect(slide.slots.underline.text).toBe('up to 20 hours')
  })

  it('sends a number its fact lacks back to the model, and takes the corrected answer', async () => {
    const extracted = await paidWorkFacts()
    const eleven = extracted.facts.find((f) => f.text.includes('11 percentage points'))
    if (!eleven) throw new Error('no 11-point fact')
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      const first = answer.versions[0]
      first.slides[1].slots = first.slides[1].slots.map((s) =>
        s.key === 'body'
          ? {
              ...s,
              text: 'Above 20 hours a week, pass rates fell by 12 points.',
              fact_ids: [eleven.id],
            }
          : s,
      )
      return answer
    }
    const users: string[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'draft') users.push(req.user)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await draft(['the-line'], extracted)
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(users[0]).not.toContain('fell by 12 points')
    expect(users[1]).toContain('fell by 12 points')
    expect(res.items[0].structure.slides[1].slots.body.text).not.toContain('12')
  })

  it('sends a banned phrase and a worded art prompt back to the model', async () => {
    const extracted = await paidWorkFacts()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      answer.versions[0].slides[0].slots[0].text = 'The best research'
      answer.versions[0].art_prompt = 'A poster reading "WORK"'
      return answer
    }
    const users: string[] = []
    provider = {
      json: (req) => {
        if (req.useCase === 'draft') users.push(req.user)
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    const res = await draft(['the-line'], extracted)
    expect(res.ok).toBe(true)
    expect(users[1]).toContain('best')
    expect(users[1]).toContain(ART_PROMPT_ERROR)
  })

  it('fails the step with the standard message on [fake:fail-draft]', async () => {
    const extracted = await paidWorkFacts()
    const source = {
      ...extracted.source,
      demoKey: null,
      paragraphs: extracted.source.paragraphs.map((p, i) =>
        i === 0 ? { ...p, text: `${p.text} [fake:fail-draft]` } : p,
      ),
    }
    const res = await draft(['the-line', 'the-long-read'], extracted, { source })
    expect(res).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('the draft spec', () => {
  it('has an example that parses with its own schema and passes the schema guard', () => {
    expect(DRAFT.schema.safeParse(DRAFT.example.answer).success).toBe(true)
    expect(() => toModelSchema(DRAFT.schema)).not.toThrow()
    expect(DRAFT).toMatchObject({ useCase: 'draft', version: 'draft.v11', tier: 'flash' })
    // The bullets layout (GD34): three to five points, one per line, counted as points.
    expect(DRAFT.rules.some((r) => r.includes('bullets for three to five short points'))).toBe(true)
    expect(DRAFT.rules.some((r) => r.includes('one point per line'))).toBe(true)
    // The editor's outline, when given, decides each version's slides (GD32).
    expect(DRAFT.rules.some((r) => r.includes('DATA.outline'))).toBe(true)
    // A version redrafted in a nudge's direction (GD10): one version from DATA.base.
    expect(DRAFT.rules.some((r) => r.includes('DATA.base') && r.includes('DATA.nudge'))).toBe(true)
    // Each slide's layout from the look's layouts (GD4), and the idea the editor chose (GD2).
    expect(
      DRAFT.rules.some((r) => r.includes("choose each slide's layout from the look's layouts")),
    ).toBe(true)
    expect(DRAFT.rules.some((r) => r.includes('DATA.idea') && r.includes('combine these'))).toBe(
      true,
    )
    const notes = DRAFT.rules.find((r) => r.includes('DATA.editor_notes'))
    expect(notes).toContain("the editor's opinion, never as a fact or a number")
    expect(DRAFT.temperature).toBe(0.6)
    // Three versions in one call, each its own angle (97): the example shows all three.
    const { versions } = DRAFT.example.answer as { versions: { angle: string }[] }
    expect(versions).toHaveLength(3)
    expect(new Set(versions.map((v) => v.angle)).size).toBe(3)
    expect(DRAFT.rules.some((r) => r.includes('three versions'))).toBe(true)
    // The emotion is a data field the rules read for tone (100): the example shows the first chip.
    expect((DRAFT.example.data as { emotion: unknown }).emotion).toEqual({
      label: EMOTIONS[0].label,
      tone: EMOTIONS[0].tone,
    })
    expect(DRAFT.rules.some((r) => r.includes('DATA.emotion'))).toBe(true)
    // The page's copy style is a data field the rules read too (105), shown in the example.
    expect(typeof (DRAFT.example.data as { copy_style: unknown }).copy_style).toBe('string')
    expect(DRAFT.rules.some((r) => r.includes('DATA.copy_style'))).toBe(true)
  })
})

// ── Another take on one slide (criterion 99) ─────────────────────────────────────────────────

/** The-line's first version as a drafts item: lineAnswer() converted, frozen with its template. */
const lineItem = () => {
  const converted = toStructure(theLine, lineAnswer(), FACTS)
  if (!converted.ok) throw new Error(converted.problems.join('\n'))
  return {
    structure: converted.structure,
    template: structuredClone(theLine),
    angle: 'The surprising number',
    problems: [] as string[],
  }
}

/** The slide calls that reached the provider, by their user text. */
function recordSlideCalls(): string[] {
  const users: string[] = []
  provider = {
    json: (req) => {
      if (req.useCase === 'draft_slide') users.push(req.user)
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
  return users
}

const take = (
  item: ReturnType<typeof lineItem>,
  slide: number,
  emotion: string | null = null,
  copyStyle?: string | null,
  guideline?: typeof GUIDELINE,
) =>
  redraftSlide({
    item,
    slide,
    facts: FACTS,
    emotion,
    postId: 'test-post',
    attempt: 1,
    ...(copyStyle !== undefined && { copyStyle }),
    ...(guideline && { guideline }),
  })

describe('redraftSlide (99)', () => {
  it('rewords only the named slide, keeping its slots and bound facts; every other slide stays byte for byte', async () => {
    const item = lineItem()
    const before = structuredClone(item.structure)
    const users = recordSlideCalls()
    const res = await take(item, 2)
    if (!res.ok) throw new Error(res.error)
    expect(users).toHaveLength(1)
    const slide = res.structure.slides[1]
    const was = before.slides[1]
    expect(Object.keys(slide.slots)).toEqual(Object.keys(was.slots))
    expect(slide.slots.heading.text).not.toBe(was.slots.heading.text)
    expect(slide.slots.body.text).not.toBe(was.slots.body.text)
    expect(slide.slots.body).toMatchObject({ factIds: ['f1'], factual: true })
    expect(slide.slots.heading).toMatchObject({ factIds: [], factual: false })
    // The rest of the structure is the same bytes, and the item it came from is untouched.
    const rest = (s: typeof before) => JSON.stringify({ ...s, slides: s.slides.toSpliced(1, 1) })
    expect(rest(res.structure)).toBe(rest(before))
    expect(JSON.stringify(item.structure)).toBe(JSON.stringify(before))
    // The model saw the version's angle, the emotion's tone and only this slide's facts.
    expect(users[0]).toContain('"angle": "The surprising number"')
    expect(users[0]).toContain(`"id": "f1"`)
    const withEmotion = recordSlideCalls()
    store.clear()
    await take(item, 2, EMOTIONS[0].id)
    expect(withEmotion[0]).toContain(EMOTIONS[0].tone)
  })

  it('rewords a look slide by its layout’s slots and keeps its layout', async () => {
    const fieldNotes = templateById('field-notes')
    if (!fieldNotes) throw new Error('field-notes template missing')
    const quote =
      'Students working up to 20 hours a week had grades similar to students who did not work.'
    const item = {
      ...lineItem(),
      template: structuredClone(fieldNotes),
      structure: {
        templateId: 'field-notes',
        artPrompt: 'An open notebook beside a small desk clock.',
        slides: [
          {
            kind: 'body' as const,
            layout: 'quote' as const,
            slots: {
              quote: { text: quote, factIds: ['f1'], factual: true },
              credit: { text: 'A survey', factIds: [], factual: false },
            },
          },
        ],
      },
    }
    const res = await take(item, 1)
    if (!res.ok) throw new Error(res.error)
    expect(res.structure.slides[0].layout).toBe('quote')
    expect(res.structure.slides[0].slots.credit.text).toStartWith('Another take:')
  })

  it('rewords a bullets slide point by point, its points counted by line (GD34)', async () => {
    const fieldNotes = templateById('field-notes')
    if (!fieldNotes) throw new Error('field-notes template missing')
    const points = ['Check your visa hours', 'Ask about exam weeks', 'Keep one free day']
    const item = {
      ...lineItem(),
      template: structuredClone(fieldNotes),
      structure: {
        templateId: 'field-notes',
        artPrompt: 'An open notebook beside a small desk clock.',
        slides: [
          {
            kind: 'body' as const,
            layout: 'bullets' as const,
            slots: {
              heading: { text: 'Before a shift', factIds: [], factual: false },
              points: { text: points.join('\n'), factIds: [], factual: true },
            },
          },
        ],
      },
    }
    const res = await take(item, 1)
    if (!res.ok) throw new Error(res.error)
    const taken = res.structure.slides[0].slots.points.text.split('\n')
    expect(taken).toHaveLength(3)
    for (const line of taken) expect(line).toStartWith('Another take:')
  })

  it("sends the guideline's voice to another take as brand_voice, and a changed guideline changes it (GD15)", async () => {
    const item = lineItem()
    const users = recordSlideCalls()
    expect((await take(item, 2)).ok).toBe(true)
    for (const rule of GUIDELINE.voice.rules) expect(users[0]).toContain(rule)
    expect(users[0]).toContain('"brand_voice"')
    expect(users[0]).not.toContain(FEED_BRAND.tone)
    store.clear()
    const changed = {
      ...GUIDELINE,
      voice: { ...GUIDELINE.voice, rules: ['Sound like a patient tutor.'] },
    }
    expect((await take(item, 2, null, undefined, changed)).ok).toBe(true)
    expect(users[1]).toContain('Sound like a patient tutor.')
  })

  it("carries the page's copy style into another take's data, and nothing when none (105)", async () => {
    const item = lineItem()
    const users = recordSlideCalls()
    expect((await take(item, 2, null, 'Short lines.')).ok).toBe(true)
    expect(users[0]).toContain('"copy_style": "Short lines."')
    store.clear()
    expect((await take(item, 2, null, null)).ok).toBe(true)
    expect(users[1]).not.toContain('"copy_style"')
  })

  it('sends a number its facts lack, a banned phrase, a slot over its limit and a missing slot back, and takes the corrected answer', async () => {
    const item = lineItem()
    let calls = 0
    FAKE_ANSWERS.draft_slide = (data) => {
      calls++
      const answer = fakeSlide?.(data) as SlideAnswer
      if (calls > 1) return answer
      return {
        slots: [
          { key: 'heading', text: `The best finding ${'x'.repeat(24)}` },
          {
            key: 'body',
            text: `Above 20 hours a week, pass rates fell by 12 points. ${answer.slots[1].text}`,
          },
          { key: 'kicker', text: 'Not on this slide' },
        ],
      }
    }
    const users = recordSlideCalls()
    const res = await take(item, 2)
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(users[1]).toContain('fell by 12 points." states a number its facts do not')
    expect(users[1]).toContain('remove "best"')
    expect(users[1]).toContain('limit')
    expect(users[1]).toContain('kicker is not a slot')
    expect(res.structure.slides[1].slots.body.text).not.toContain('12')
  })

  it('sends the same wording back: another take must differ from the slide it replaces', async () => {
    const item = lineItem()
    let calls = 0
    FAKE_ANSWERS.draft_slide = (data) => {
      calls++
      if (calls > 1) return fakeSlide?.(data)
      const { slots } = data as { slots: { key: string; text: string }[] }
      return { slots: slots.map(({ key, text }) => ({ key, text })) }
    }
    const users = recordSlideCalls()
    const res = await take(item, 2)
    expect(res.ok).toBe(true)
    expect(users[1]).toContain('another take')
  })

  it('refuses a slide the version does not have, without a call', async () => {
    const item = lineItem()
    const users = recordSlideCalls()
    expect(await take(item, 9)).toEqual({ ok: false, error: client.AI_ERRORS.failed })
    expect(users).toHaveLength(0)
  })

  it('fails the step with the standard message on [fake:fail-draft_slide]', async () => {
    const item = lineItem()
    item.structure.slides[1].slots.heading.text = 'Finding 1 [fake:fail-draft_slide]'
    expect(await take(item, 2)).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

// ── A nudge on one slide or a whole version (GD10) ─────────────────────────────────────────────

const SHORTER = 'Cut each slot to about two thirds of its length, and keep every fact.'
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/** The first version the fake drafts for the-line from paid-work, with the facts it rests on. */
async function draftedLine() {
  const extracted = await paidWorkFacts()
  const res = await draft(['the-line'], extracted)
  if (!res.ok) throw new Error(res.error)
  store.clear()
  return { item: res.items[0], facts: extracted.facts }
}

/** The draft calls that reached the provider, by their user text and data. */
function recordDraftData(): { user: string; data: unknown }[] {
  const seen: { user: string; data: unknown }[] = []
  provider = {
    json: (req) => {
      if (req.useCase === 'draft') seen.push({ user: req.user, data: req.data })
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
  return seen
}

describe('redraftSlide with a nudge (GD10)', () => {
  it("carries the nudge's instruction in the slide's data, null for another take, and the fake answers shorter", async () => {
    const { item, facts } = await draftedLine()
    const users = recordSlideCalls()
    const nudged = await redraftSlide({
      item,
      slide: 2,
      facts,
      nudge: SHORTER,
      postId: 'test-post',
      attempt: 1,
    })
    if (!nudged.ok) throw new Error(nudged.error)
    expect(users[0]).toContain(`"nudge": "${SHORTER}"`)
    const was = item.structure.slides[1].slots.body
    const now = nudged.structure.slides[1].slots.body
    expect(wordCount(now.text)).toBeLessThan(wordCount(was.text))
    expect(now.factIds).toEqual(was.factIds)

    store.clear()
    expect(
      (await redraftSlide({ item, slide: 2, facts, postId: 'test-post', attempt: 1 })).ok,
    ).toBe(true)
    expect(users[1]).toContain('"nudge": null')
  })
})

describe('redraftVersion (GD10)', () => {
  type Drafted = Awaited<ReturnType<typeof draftedLine>>
  const nudge = (item: Drafted['item'], facts: Drafted['facts']) =>
    redraftVersion({ item, facts, nudge: SHORTER, postId: 'test-post', attempt: 1 })

  it('asks one draft call for one version from the base and the nudge, and keeps its slides, layouts, facts and angle', async () => {
    const { item, facts } = await draftedLine()
    const seen = recordDraftData()
    const res = await nudge(item, facts)
    if (!res.ok) throw new Error(res.error)
    expect(seen).toHaveLength(1)
    const data = seen[0].data as {
      nudge: string
      base: { angle: string; slides: { kind: string; slots: { key: string; text: string }[] }[] }
    }
    expect(data.nudge).toBe(SHORTER)
    expect(data.base.angle).toBe(item.angle)
    expect(data.base.slides.map((s) => s.kind)).toEqual(item.structure.slides.map((s) => s.kind))
    expect(data.base.slides[1].slots.find((s) => s.key === 'body')?.text).toBe(
      item.structure.slides[1].slots.body.text,
    )

    expect(res.item.angle).toBe(item.angle)
    expect(res.item.template).toEqual(item.template)
    expect(res.item.problems).toEqual([])
    const after = res.item.structure.slides
    expect(after.map((s) => [s.kind, s.layout])).toEqual(
      item.structure.slides.map((s) => [s.kind, s.layout]),
    )
    expect(after.map((s) => s.slots.body?.factIds)).toEqual(
      item.structure.slides.map((s) => s.slots.body?.factIds),
    )
    expect(wordCount(after[1].slots.body.text)).toBeLessThan(
      wordCount(item.structure.slides[1].slots.body.text),
    )
  })

  it('sends a number its facts lack, and more than one version, back to the model, and takes the corrected answer', async () => {
    const { item, facts } = await draftedLine()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      const [first] = answer.versions
      first.slides[1].slots = first.slides[1].slots.map((s) =>
        s.key === 'body' ? { ...s, text: `${s.text} Pass rates fell by 12 points.` } : s,
      )
      return { versions: [first, first] }
    }
    const seen = recordDraftData()
    const res = await nudge(item, facts)
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(seen[1].user).toContain('versions: return exactly one version.')
    expect(seen[1].user).toContain('fell by 12 points." states a number')
    expect(res.item.structure.slides[1].slots.body.text).not.toContain('12')
  })

  it('fails with the standard message when no answer is ever clean', async () => {
    const { item, facts } = await draftedLine()
    FAKE_ANSWERS.draft = (data) => {
      const answer = fakeDraft?.(data) as DraftAnswer
      answer.versions[0].slides[1].slots[1].text += ' Pass rates fell by 12 points.'
      return answer
    }
    expect(await nudge(item, facts)).toEqual({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('the slide spec', () => {
  it('has an example that parses with its own schema and passes the schema guard', () => {
    expect(DRAFT_SLIDE.schema.safeParse(DRAFT_SLIDE.example.answer).success).toBe(true)
    expect(() => toModelSchema(DRAFT_SLIDE.schema)).not.toThrow()
    expect(DRAFT_SLIDE).toMatchObject({
      useCase: 'draft_slide',
      version: 'draft_slide.v6',
      tier: 'flash',
    })
    // A points slot (GD34): one point per line, as the draft writes them.
    expect(DRAFT_SLIDE.rules.some((r) => r.includes('one point per line'))).toBe(true)
    // A nudge is a data field the rules read for the direction (GD10).
    expect(DRAFT_SLIDE.rules.some((r) => r.includes('DATA.nudge'))).toBe(true)
    // The answer rewords exactly the slots DATA lists, by key; the facts stay bound in code.
    const data = DRAFT_SLIDE.example.data as { slots: { key: string }[]; emotion: unknown }
    const answer = DRAFT_SLIDE.example.answer as { slots: { key: string }[] }
    expect(answer.slots.map((s) => s.key)).toEqual(data.slots.map((s) => s.key))
    expect(data.emotion).toEqual({ label: EMOTIONS[0].label, tone: EMOTIONS[0].tone })
    expect(DRAFT_SLIDE.rules.some((r) => r.includes('DATA.emotion'))).toBe(true)
    expect(DRAFT_SLIDE.rules.some((r) => r.includes('DATA.copy_style'))).toBe(true)
  })
})

describe('a post in its language (GD37)', () => {
  const NEPALI_RULE = languageRule('Nepali')

  /** Every call that reached the provider for `useCase`: its system and user text and its data. */
  function recordCalls(useCase: string): { system: string; user: string; data: unknown }[] {
    const seen: { system: string; user: string; data: unknown }[] = []
    provider = {
      json: (req) => {
        if (req.useCase === useCase)
          seen.push({ system: req.system, user: req.user, data: req.data })
        return fakeProvider.json(req)
      },
      image: fakeProvider.image,
    }
    return seen
  }
  /** Every slot's words of a structure, one line each. */
  const wordsOf = (structure: { slides: { slots: Record<string, { text: string }> }[] }) =>
    structure.slides.flatMap((s) => Object.values(s.slots).map((slot) => slot.text)).join('\n')
  const nepali = (extracted: Awaited<ReturnType<typeof paidWorkFacts>>) => ({
    ...extracted.source,
    demoKey: null,
    language: 'ne' as const,
  })

  it('sends a Nepali post its language in DATA and the rule, and the fake writes Devanagari', async () => {
    const extracted = await paidWorkFacts()
    const seen = recordCalls('draft')
    const res = await draft(['the-line'], extracted, { source: nepali(extracted) })
    if (!res.ok) throw new Error(res.error)
    expect(seen).toHaveLength(1)
    expect(seen[0].data).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(NEPALI_RULE).toBe(
      'Write every text for readers in Nepali, in its own script; keep numbers as Western digits 0–9; keep names of places, universities and visas as they are.',
    )
    expect(seen[0].system).toContain(NEPALI_RULE)
    for (const item of res.items) {
      expect(scriptShare(wordsOf(item.structure), 'devanagari')).toBeGreaterThan(0.6)
      expect(item.problems).toEqual([])
    }
  })

  it('refuses a Nepali draft in Latin script and asks again', async () => {
    const extracted = await paidWorkFacts()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      // The first answer is the English one, as if the language were not there.
      const { language: _, ...english } = data as { language: unknown }
      return fakeDraft?.(calls === 1 ? english : data)
    }
    const seen = recordCalls('draft')
    const res = await draft(['the-line'], extracted, { source: nepali(extracted) })
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(seen[1].user).toContain(
      'versions.0.slides: write it in Nepali, in its own script; 0% of its letters are',
    )
    expect(scriptShare(wordsOf(res.items[0].structure), 'devanagari')).toBeGreaterThan(0.6)
  })

  it('refuses digits outside 0–9 and asks again', async () => {
    const extracted = await paidWorkFacts()
    let calls = 0
    FAKE_ANSWERS.draft = (data) => {
      calls++
      const answer = fakeDraft?.(data) as DraftAnswer
      if (calls > 1) return answer
      const cover = answer.versions[0].slides[0]
      cover.slots = cover.slots.map((s) => ({ ...s, text: s.text.replaceAll('20', '२०') }))
      return answer
    }
    const seen = recordCalls('draft')
    const res = await draft(['the-line'], extracted, { source: nepali(extracted) })
    if (!res.ok) throw new Error(res.error)
    expect(calls).toBe(2)
    expect(seen[1].user).toContain(
      'versions.0.slides.0.slots.phrase: "२" is not a Western digit; write every number with 0–9.',
    )
    expect(wordsOf(res.items[0].structure)).not.toContain('२')
  })

  it('sends an English post the data and prompt it always did, with the new version', async () => {
    const extracted = await paidWorkFacts()
    const seen = recordCalls('draft')
    const res = await draft(['the-line'], extracted)
    if (!res.ok) throw new Error(res.error)
    expect(seen[0].data).not.toHaveProperty('language')
    expect(seen[0].system).toBe(buildPrompt(DRAFT, seen[0].data).system)
    expect(seen[0].system).not.toContain('Write every text for readers')
    expect(DRAFT.version).toBe('draft.v11')
  })

  it('counts a Thai take’s words by word, and asks again when there are too many', async () => {
    const fieldNotes = templateById('field-notes')
    if (!fieldNotes) throw new Error('field-notes template missing')
    const item = {
      ...lineItem(),
      template: structuredClone(fieldNotes),
      structure: {
        templateId: 'field-notes',
        artPrompt: 'An open notebook beside a small desk clock.',
        slides: [
          {
            kind: 'body' as const,
            layout: 'quote' as const,
            slots: {
              quote: { text: 'นักศึกษาที่ทำงานมีผลการเรียนดี', factIds: ['f1'], factual: true },
              credit: { text: 'แบบสำรวจ', factIds: [], factual: false },
            },
          },
        ],
      },
    }
    // Four spaces, but far more than the quote's 30 words.
    const long = Array.from(
      { length: 4 },
      () => 'นักศึกษาที่ทำงานมีผลการเรียนใกล้เคียงกับนักศึกษาที่ไม่ได้ทำงาน',
    ).join(' ')
    const slides = recordCalls('draft_slide')
    let calls = 0
    FAKE_ANSWERS.draft_slide = (data) => {
      calls++
      if (calls > 1) return fakeSlide?.(data)
      return {
        slots: [
          { key: 'quote', text: long },
          { key: 'credit', text: 'การสำรวจ' },
        ],
      }
    }
    await redraftSlide({
      item,
      slide: 1,
      facts: FACTS,
      postId: 'test-post',
      attempt: 1,
      language: 'th',
    })
    expect(slides[1]?.user).toContain(
      `slots.quote: ${thaiAwareCount(long)} words; this slot takes 5–30. Stay inside its limit.`,
    )
  })

  it('takes a Nepali, Hindi or Thai slot at its limit in characters as a reader sees them, asking nothing again', async () => {
    const fieldNotes = templateById('field-notes')
    if (!fieldNotes) throw new Error('field-notes template missing')
    for (const id of NATIVE_IDS) {
      store.clear()
      const credit = nativeOf(id, 60)
      const item = {
        ...lineItem(),
        template: structuredClone(fieldNotes),
        structure: {
          templateId: 'field-notes',
          artPrompt: 'An open notebook beside a small desk clock.',
          slides: [
            {
              kind: 'body' as const,
              layout: 'quote' as const,
              slots: {
                quote: { text: NATIVE[id], factIds: ['f1'], factual: true },
                credit: { text: NATIVE[id].slice(0, 12), factIds: [], factual: false },
              },
            },
          ],
        },
      }
      let calls = 0
      FAKE_ANSWERS.draft_slide = () => {
        calls++
        return {
          slots: [
            { key: 'quote', text: NATIVE[id] },
            { key: 'credit', text: credit },
          ],
        }
      }
      const taken = await redraftSlide({
        item,
        slide: 1,
        facts: FACTS,
        postId: 'test-post',
        attempt: 1,
        language: id,
      })
      expect(taken.ok, id).toBe(true)
      expect(calls, id).toBe(1)
    }
  })

  it('carries the language into another take and a nudge, and refuses a Latin take', async () => {
    const extracted = await paidWorkFacts()
    const first = await draft(['the-line'], extracted, { source: nepali(extracted) })
    if (!first.ok) throw new Error(first.error)
    store.clear()
    const item = first.items[0]
    const slides = recordCalls('draft_slide')
    let calls = 0
    FAKE_ANSWERS.draft_slide = (data) => {
      calls++
      // The first take is in English.
      if (calls > 1) return fakeSlide?.(data)
      const { slots } = data as { slots: { key: string }[] }
      return { slots: slots.map(({ key }) => ({ key, text: 'Plain words' })) }
    }
    const taken = await redraftSlide({
      item,
      slide: 1,
      facts: extracted.facts,
      postId: 'test-post',
      attempt: 1,
      language: 'ne',
    })
    if (!taken.ok) throw new Error(taken.error)
    expect(calls).toBe(2)
    expect(slides[0].data).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(slides[0].system).toContain(NEPALI_RULE)
    expect(slides[1].user).toContain('slots: write it in Nepali, in its own script')

    const versions = recordCalls('draft')
    const nudged = await redraftVersion({
      item,
      facts: extracted.facts,
      nudge: SHORTER,
      postId: 'test-post',
      attempt: 1,
      language: 'ne',
    })
    if (!nudged.ok) throw new Error(nudged.error)
    expect(versions[0].data).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(versions[0].system).toContain(NEPALI_RULE)
  })
})
