// A page's design language (criterion 105), with the fake provider and an in-memory call log and
// cache: no network, no database. A model reads the page's reference images and writes its art
// style, copy style and closest template; code checks every answer.

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
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { describeDesign } = await import('./design-language')
const { DESIGN_LANGUAGE } = await import('./prompts')
const { toModelSchema } = await import('./schema-guard')
const { PAGE_BRANDS } = await import('../brands')
const { GUIDELINE } = await import('../brands/guideline')
const { TEMPLATES } = await import('../templates')

const CEREBRAL = PAGE_BRANDS.find((b) => b.id === 'cerebral')
if (!CEREBRAL) throw new Error('cerebral brand missing')
const PNG = { mime: 'image/png' as const, bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]) }
const JPEG = { mime: 'image/jpeg' as const, bytes: new Uint8Array([0xff, 0xd8, 0xff, 2]) }

let seen: { useCase: string; data: unknown; user: string; images: { mime: string }[] }[] = []

beforeEach(() => {
  store.clear()
  seen = []
  provider = {
    json: async (req) => {
      seen.push({
        useCase: req.useCase,
        data: req.data,
        user: req.user,
        images: (req.images ?? []).map((i) => ({ mime: i.mime })),
      })
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})
afterEach(() => {
  provider = fakeProvider
})

/** A provider that answers every design language call with this. */
function answering(answer: unknown) {
  provider = {
    json: async (req) => {
      seen.push({ useCase: req.useCase, data: req.data, user: req.user, images: [] })
      return JSON.stringify(answer)
    },
    image: fakeProvider.image,
  }
}

const GOOD = {
  art_style: 'Loose ink line on rough paper, one subject, wide margins.',
  copy_style: 'Short lines. One question to the reader.',
  closest_template_id: 'data-desk',
}

describe('describeDesign (105)', () => {
  it('sends the reference images with the page and the templates, and returns the three fields', async () => {
    const res = await describeDesign({ brand: CEREBRAL, images: [PNG, JPEG] })
    if (!res.ok) throw new Error(res.error)
    expect(res.value.artStyle.length).toBeGreaterThan(0)
    expect(res.value.copyStyle.length).toBeGreaterThan(0)
    expect(TEMPLATES.some((t) => t.id === res.value.closestTemplateId)).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0].useCase).toBe('design_language')
    expect(seen[0].images).toEqual([{ mime: 'image/png' }, { mime: 'image/jpeg' }])
    const data = seen[0].data as {
      page: unknown
      guideline: unknown
      templates: { id: string }[]
    }
    expect(data.page).toEqual({ name: CEREBRAL.name, tone: CEREBRAL.tone })
    // The images are described against the guideline's art style (GD15), not its palette.
    expect(data.guideline).toEqual({ art_style: GUIDELINE.art.style })
    expect(data.templates.map((t) => t.id)).toEqual(TEMPLATES.map((t) => t.id))
    // Colours and fonts are the brand file's: the model is never shown them.
    const text = JSON.stringify(data)
    for (const theme of CEREBRAL.themes) expect(text).not.toContain(theme.bg)
    expect(text).not.toContain(CEREBRAL.fonts.heading.family)
  })

  it('sends back an art style the art prompt guard refuses, a template not in the registry and an over-long field', async () => {
    let calls = 0
    provider = {
      json: async (req) => {
        calls++
        seen.push({ useCase: req.useCase, data: req.data, user: req.user, images: [] })
        if (calls > 1) return JSON.stringify(GOOD)
        return JSON.stringify({
          art_style: 'Three "bold" panels with the OfCourse logo',
          copy_style: 'x'.repeat(241),
          closest_template_id: 'no-such-template',
        })
      },
      image: fakeProvider.image,
    }
    const res = await describeDesign({ brand: CEREBRAL, images: [PNG] })
    expect(res).toMatchObject({
      ok: true,
      value: {
        artStyle: GOOD.art_style,
        copyStyle: GOOD.copy_style,
        closestTemplateId: GOOD.closest_template_id,
      },
    })
    expect(seen[1].user).toContain('art_style:')
    expect(seen[1].user).toContain('copy_style:')
    expect(seen[1].user).toContain('closest_template_id:')
  })

  it("describes against a changed guideline's art style (GD15)", async () => {
    const changed = {
      ...GUIDELINE,
      art: { ...GUIDELINE.art, style: 'Chalk on slate, one subject.' },
    }
    await describeDesign({ brand: CEREBRAL, images: [PNG], guideline: changed })
    expect(seen[0].user).toContain('Chalk on slate, one subject.')
  })

  it('fails the step when no answer passes, keeping nothing', async () => {
    answering({ ...GOOD, closest_template_id: 'nope' })
    const res = await describeDesign({ brand: CEREBRAL, images: [PNG] })
    expect(res).toMatchObject({ ok: false, error: client.AI_ERRORS.failed })
  })
})

describe('the design language spec', () => {
  it('has an example that parses with its schema, names a template in its data, and passes the schema guard', () => {
    expect(DESIGN_LANGUAGE.schema.safeParse(DESIGN_LANGUAGE.example.answer).success).toBe(true)
    expect(() => toModelSchema(DESIGN_LANGUAGE.schema)).not.toThrow()
    expect(DESIGN_LANGUAGE).toMatchObject({
      useCase: 'design_language',
      version: 'design_language.v2',
      tier: 'lite',
    })
    const data = DESIGN_LANGUAGE.example.data as { templates: { id: string }[] }
    const answer = DESIGN_LANGUAGE.example.answer as { closest_template_id: string }
    expect(data.templates.map((t) => t.id)).toContain(answer.closest_template_id)
    expect(DESIGN_LANGUAGE.rules.some((r) => /colou?r/i.test(r) && /font/i.test(r))).toBe(true)
  })
})
