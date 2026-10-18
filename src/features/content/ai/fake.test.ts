import { describe, expect, it, mock } from 'bun:test'
import { z } from 'zod'
import type { Cache, CallLog, Provider } from './client'
import type { PromptSpec } from './prompts'

mock.module('server-only', () => ({}))

const { makeAi } = await import('./client')
const { aiConfig } = await import('./config')
const { makeFake } = await import('./fake')
const { scriptShare, wordCount } = await import('../text/script')

type JsonReq = Parameters<Provider['json']>[0]

const schema = z.object({ n: z.number() })
const SPEC: PromptSpec<typeof schema> = {
  useCase: 'extract',
  version: 'test.v1',
  tier: 'flash',
  temperature: 0,
  schema,
  rules: [],
  example: { data: {}, answer: { n: 1 } },
  instruction: 'Count.',
}

function jsonReq(data: unknown, user = 'Count.'): JsonReq {
  return {
    model: 'm',
    system: 's',
    user,
    temperature: 0,
    jsonSchema: {},
    signal: new AbortController().signal,
    useCase: 'extract',
    tier: 'flash',
    promptVersion: 'test.v1',
    data,
  }
}

describe('the fake provider', () => {
  it('throws for a use case with no fake answer', async () => {
    await expect(makeFake({}).json(jsonReq({ text: 'x' }))).rejects.toThrow('Unknown fake use case')
  })

  it('paints an 8 x 8 PNG for an image and throws on [fake:fail-art]', async () => {
    const req = (prompt: string) => ({
      model: 'm',
      prompt,
      aspectRatio: '4:5',
      signal: new AbortController().signal,
      useCase: 'art' as const,
      tier: 'image' as const,
      promptVersion: 'image.v1',
      data: {},
    })
    const png = await makeFake().image(req('a desk'))
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(await makeFake().image(req('a desk'))).toEqual(png)
    await expect(makeFake().image(req('a desk [fake:fail-art]'))).rejects.toThrow('Fake failure')
  })

  it('answers deterministically from data', async () => {
    const fake = makeFake({ extract: (data) => ({ n: JSON.stringify(data).length }) })
    const a = await fake.json(jsonReq({ text: 'abc' }))
    expect(a).toBe(await fake.json(jsonReq({ text: 'abc' })))
    expect(JSON.parse(a)).toEqual({ n: 14 })
  })

  it('rejects on [fake:fail-<useCase>]', async () => {
    const fake = makeFake({ extract: () => ({ n: 1 }) })
    await expect(fake.json(jsonReq({ text: 'x [fake:fail-extract]' }))).rejects.toThrow()
    // Another use case's marker does nothing here.
    expect(JSON.parse(await fake.json(jsonReq({ text: 'x [fake:fail-draft]' })))).toEqual({ n: 1 })
  })

  it('returns schema-invalid JSON for [fake:bad-<useCase>] on the first attempt only', async () => {
    const fake = makeFake({ extract: () => ({ n: 1 }) })
    const answers: string[] = []
    const provider: Provider = {
      json: async (req) => {
        const answer = await fake.json(req)
        answers.push(answer)
        return answer
      },
      image: fake.image,
    }
    const calls: CallLog = {
      countToday: async () => 0,
      record: async () => {},
      reserve: async () => 'reserved',
      settle: async () => {},
    }
    const cache: Cache = { get: async () => null, put: async () => {} }
    const ai = makeAi({
      provider,
      config: aiConfig({ AI_DAILY_CAP_PRO: '5' }),
      calls,
      cache,
      sleep: async () => {},
    })

    const res = await ai.generateJson(SPEC, { data: { text: 'x [fake:bad-extract]' } })
    expect(res).toEqual({ ok: true, value: { n: 1 }, cached: false })
    expect(answers).toHaveLength(2)
    expect(schema.safeParse(JSON.parse(answers[0])).success).toBe(false)
  })
})

describe('the fake answers for idea cards and looks (GD1, GD4, GD7)', () => {
  const req = (useCase: 'ideas' | 'draft', data: unknown): JsonReq => ({
    ...jsonReq(data),
    useCase,
  })

  it('offers four idea cards, Postcard only when a place is named, none of the hooks to avoid', async () => {
    const data = { avoid: [], places: [], facts: [], paragraphs: [] }
    const { cards } = JSON.parse(await makeFake().json(req('ideas', data))) as {
      cards: { hook: string; look: string }[]
    }
    expect(cards).toHaveLength(4)
    expect(cards.some((c) => c.look === 'postcard')).toBe(false)
    const placed = JSON.parse(
      await makeFake().json(req('ideas', { ...data, places: ['Perth'], avoid: [cards[0].hook] })),
    ) as { cards: { hook: string; look: string }[] }
    expect(placed.cards.some((c) => c.look === 'postcard')).toBe(true)
    expect(placed.cards.map((c) => c.hook)).not.toContain(cards[0].hook)
    await expect(
      makeFake().json(req('ideas', { ...data, paragraphs: ['[fake:fail-ideas]'] })),
    ).rejects.toThrow('Fake failure for ideas')
  })

  it("drafts a look slide by slide in a layout of the slide's kind, filling that layout's slots", async () => {
    const { templateById } = await import('../templates')
    const look = templateById('data-desk')
    if (!look?.layouts) throw new Error('data-desk missing')
    const layouts = Object.entries(look.layouts).map(([id, spec]) => ({
      id,
      kind: spec.kind,
      slots: spec.slots.map(({ key, label, factual, limit }) => ({ key, label, factual, limit })),
    }))
    const data = {
      template: {
        id: look.id,
        name: look.name,
        slides: look.slides.map(({ spec, repeat }) => ({ kind: spec.kind, repeat })),
        layouts,
      },
      facts: [{ id: 'f1', text: 'Students working up to 20 hours a week kept their grades.' }],
      paragraphs: [
        { ref: '¶1', text: 'Students working up to 20 hours a week kept their grades.' },
      ],
    }
    const { versions } = JSON.parse(await makeFake().json(req('draft', data))) as {
      versions: { slides: { kind: string; layout: string; slots: { key: string }[] }[] }[]
    }
    expect(versions).toHaveLength(1)
    for (const { slides } of versions) {
      expect(slides.map((s) => s.layout)).toEqual([
        'cover',
        'picture',
        'picture',
        'picture',
        'takeaway',
      ])
      for (const slide of slides) {
        const layout = layouts.find((l) => l.id === slide.layout)
        expect(slide.kind).toBe(layout?.kind as string)
        expect(slide.slots.map((s) => s.key)).toEqual(layout?.slots.map((s) => s.key) ?? [])
      }
    }
  })
})

describe('the fake extract answer', () => {
  it('keeps each key idea whole, never cut mid-word (GD26)', async () => {
    const { FAKE_ANSWERS } = await import('./fake')
    const extract = FAKE_ANSWERS.extract
    if (!extract) throw new Error('no fake extract answer')
    const long =
      `Students who work more than twenty hours a week ${'see their first-year grades slip '.repeat(5)}`.trim()
    expect(long.length).toBeGreaterThan(120)
    const answer = extract({
      paragraphs: [{ ref: '¶1', sentences: [{ id: '¶1.1', text: long }] }],
    }) as { key_ideas: string[] }
    expect(answer.key_ideas).toEqual([long])
  })
})

describe('the fake comic story (RC2)', () => {
  const req = (data: unknown, user = 'Tell it.'): JsonReq => ({
    ...jsonReq(data, user),
    useCase: 'comic_story',
  })
  const data = (premise: string | null) => ({
    path: 'Perth · Master of Cyber Security, ECU',
    premise,
    emotion: null,
    facts: [{ id: 'f1', text: 'The course takes 2 years.' }],
  })

  it('tells four panels from the path, its label in the first caption and no number', async () => {
    const { COMIC_STORY } = await import('./prompts')
    const { artPromptError } = await import('./draft')
    const answer = COMIC_STORY.schema.parse(JSON.parse(await makeFake().json(req(data(null)))))
    expect(answer.panels).toHaveLength(4)
    expect(answer.panels[0].caption).toContain('Perth · Master of Cyber Security, ECU')
    expect(answer.title.length).toBeGreaterThan(0)
    for (const { caption, scene } of answer.panels) {
      expect(caption).not.toMatch(/\d/)
      expect(Array.from(caption).length).toBeLessThanOrEqual(140)
      expect(artPromptError(scene)).toBeNull()
    }
  })

  it('fails on [fake:fail-comic_story] and is invalid once on [fake:bad-comic_story] in the premise', async () => {
    const { COMIC_STORY, RETRY_LEAD } = await import('./prompts')
    await expect(makeFake().json(req(data('[fake:fail-comic_story]')))).rejects.toThrow(
      'Fake failure for comic_story',
    )
    const bad = data('[fake:bad-comic_story]')
    const first = JSON.parse(await makeFake().json(req(bad)))
    expect(COMIC_STORY.schema.safeParse(first).success).toBe(false)
    const retried = JSON.parse(await makeFake().json(req(bad, `Tell it.\n\n${RETRY_LEAD}`)))
    expect(COMIC_STORY.schema.safeParse(retried).success).toBe(true)
  })
})

describe('the fake answers in the post’s language (GD37)', () => {
  const ask = async (useCase: 'caption' | 'ideas', data: unknown) =>
    JSON.parse(await makeFake().json({ ...jsonReq(data), useCase }))

  it('writes each Latin letter as one of the script’s, keeping lengths, digits and marks; English as it was', async () => {
    const english = await ask('caption', { slides: [], body: [] })
    const thai = await ask('caption', {
      slides: [],
      body: [],
      language: { id: 'th', label: 'Thai' },
    })
    const nepali = await ask('caption', {
      slides: [],
      body: [],
      language: { id: 'ne', label: 'Nepali' },
    })
    expect(english.hook).toBe('Before you decide, read what the research says.')
    for (const [answer, script] of [
      [thai, 'thai'],
      [nepali, 'devanagari'],
    ] as const) {
      expect(scriptShare(answer.hook, script)).toBe(1)
      expect(Array.from(answer.hook)).toHaveLength(Array.from(english.hook).length)
      expect(answer.hook.split(' ')).toHaveLength(english.hook.split(' ').length)
      expect(answer.hook.endsWith('.')).toBe(true)
    }
  })

  it('offers fresh cards in the script when told the ones shown', async () => {
    const language = { id: 'hi', label: 'Hindi' }
    const data = { avoid: [], places: [], facts: [], paragraphs: [], language }
    const first = await ask('ideas', data)
    const avoid = first.cards.map((c: { hook: string }) => c.hook)
    const more = await ask('ideas', { ...data, avoid })
    for (const c of more.cards) expect(avoid).not.toContain(c.hook)
    expect(scriptShare(more.cards[0].hook, 'devanagari')).toBe(1)
  })
})

describe('the fake judge across languages (GD37)', () => {
  it('finds a claim the fake wrote in Devanagari in the English paragraph it came from', async () => {
    const paragraphs = [
      { ref: '¶1', text: 'Students working up to 20 hours a week had grades similar to others.' },
      { ref: '¶2', text: 'Most students who work do so in retail or hospitality.' },
    ]
    // ¶2 as the fake writes it for a Nepali blog: the point of its first section.
    const outline = JSON.parse(
      await makeFake().json({
        ...jsonReq({ facts: [paragraphs[1]], language: { id: 'ne', label: 'Nepali' } }),
        useCase: 'blog_outline',
      }),
    ) as { sections: { point: string }[] }
    const claim = outline.sections[0].point
    expect(scriptShare(claim, 'devanagari')).toBe(1)
    const judge = async (text: string) =>
      JSON.parse(
        await makeFake().json({ ...jsonReq({ claim: text, paragraphs }), useCase: 'source_check' }),
      )
    expect(await judge(claim)).toMatchObject({ supported: true, ref: '¶2' })
    expect(await judge('विद्यार्थी भिसा नियम')).toMatchObject({ supported: false })
  })
})

describe('the fake’s Thai words, counted by word (GD37)', () => {
  const ask = async (useCase: 'draft' | 'draft_slide', data: unknown) =>
    JSON.parse(await makeFake().json({ ...jsonReq(data), useCase }))
  const thai = { id: 'th', label: 'Thai' }
  type Limit = { unit: 'chars' | 'words' | 'points'; min: number; max: number }
  const FACT = {
    id: 'f1',
    text: 'Students working up to 20 hours a week had grades similar to students who did not work, across eight universities.',
  }

  it('keeps every Thai words slot of every look version inside its limit as the checks count it', async () => {
    const { templateById } = await import('../templates')
    const outOfLimit: string[] = []
    for (const id of ['field-notes', 'data-desk', 'postcard']) {
      const look = templateById(id)
      if (!look?.layouts) throw new Error(`${id} missing`)
      const layouts = Object.entries(look.layouts).map(([layout, spec]) => ({
        id: layout,
        kind: spec.kind,
        slots: spec.slots.map(({ key, label, factual, limit }) => ({ key, label, factual, limit })),
      }))
      const data = {
        language: thai,
        template: {
          id: look.id,
          name: look.name,
          slides: look.slides.map(({ spec, repeat }) => ({ kind: spec.kind, repeat })),
          layouts,
        },
        facts: [FACT],
        paragraphs: [{ ref: '¶1', text: FACT.text }],
        outline: { slides: layouts.map((l) => ({ layout: l.id })) },
      }
      const { versions } = (await ask('draft', data)) as {
        versions: { slides: { layout: string; slots: { key: string; text: string }[] }[] }[]
      }
      for (const { slides } of versions) {
        for (const slide of slides) {
          for (const slot of slide.slots) {
            const limit = layouts
              .find((l) => l.id === slide.layout)
              ?.slots.find((s) => s.key === slot.key)?.limit as Limit
            const n = wordCount(slot.text)
            if (limit.unit === 'words' && (n > limit.max || n < limit.min)) {
              outOfLimit.push(
                `${id} ${slide.layout} ${slot.key}: ${n} of ${limit.min}–${limit.max}`,
              )
            }
          }
        }
      }
    }
    expect(outOfLimit).toEqual([])
  })

  // "eight", written in Thai letters, is two words: the space count alone would be one short.
  it('keeps a Thai market wording inside its words limit as the checks count it', async () => {
    const answer = JSON.parse(
      await makeFake().json({
        ...jsonReq({
          language: thai,
          market: { id: 'TH' },
          slots: [{ slide: 2, slot: 'body', text: FACT.text, limit: { unit: 'words', max: 22 } }],
          fact_values: [20],
        }),
        useCase: 'market',
      }),
    ) as { slots: { text: string }[] }
    expect(wordCount(answer.slots[0].text)).toBeLessThanOrEqual(22)
  })

  it('keeps another Thai take inside its words limit as the checks count it', async () => {
    const slots = [
      {
        key: 'body',
        factual: true,
        limit: { unit: 'words', min: 15, max: 21 },
        text: FACT.text,
        fact_ids: ['f1'],
      },
    ]
    const { slots: taken } = (await ask('draft_slide', {
      language: thai,
      slots,
      facts: [FACT],
      nudge: null,
    })) as { slots: { text: string }[] }
    const n = wordCount(taken[0].text)
    expect(n).toBeLessThanOrEqual(21)
    expect(n).toBeGreaterThanOrEqual(15)
  })
})
