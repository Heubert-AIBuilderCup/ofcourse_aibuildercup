// The art check (criterion 103), with the fake provider and an in-memory call log and cache: no
// network, no database. A model reads the cover art alone and says whether it holds any text.

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const memoryCache: Cache = { get: async () => null, put: async () => {} }
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

const { artCheck } = await import('./vision')
const { ART_CHECK } = await import('./prompts')
const { toModelSchema } = await import('./schema-guard')

const image = (prompt: string) =>
  fakeProvider.image({
    model: 'm',
    prompt,
    aspectRatio: '4:5',
    signal: new AbortController().signal,
    useCase: 'art',
    tier: 'image',
    promptVersion: 'image.v1',
    data: {},
  })

let seen: { useCase: string; data: unknown; mime?: string; base64?: string }[] = []

beforeEach(() => {
  seen = []
  provider = {
    json: async (req) => {
      seen.push({
        useCase: req.useCase,
        data: req.data,
        mime: req.images?.[0]?.mime,
        base64: req.images?.[0]?.base64,
      })
      return fakeProvider.json(req)
    },
    image: fakeProvider.image,
  }
})
afterEach(() => {
  provider = fakeProvider
})

describe('artCheck', () => {
  it('sends the art alone, as a PNG with nothing else to read, and says clean (103)', async () => {
    const art = await image('A quiet desk.')
    expect(await artCheck({ bytes: art, postId: 'p' })).toBe('clean')
    expect(seen).toEqual([
      {
        useCase: 'art_check',
        data: {},
        mime: 'image/png',
        base64: Buffer.from(art).toString('base64'),
      },
    ])
  })

  it('says text when the model sees text in the art; the fake paints it on [fake:art-text] (103)', async () => {
    const art = await image('A shop front [fake:art-text]')
    expect(await artCheck({ bytes: art, postId: 'p' })).toBe('text')
  })

  it('says failed when the call fails, so the caller never offers the art unread', async () => {
    provider = {
      ...fakeProvider,
      json: async () => {
        throw new Error('down')
      },
    }
    expect(await artCheck({ bytes: await image('A desk.'), postId: 'p' })).toBe('failed')
  })
})

describe('the art check spec', () => {
  it('asks only about text in the image, with an example that parses and passes the schema guard', () => {
    expect(ART_CHECK.schema.safeParse(ART_CHECK.example.answer).success).toBe(true)
    expect(() => toModelSchema(ART_CHECK.schema)).not.toThrow()
    expect(ART_CHECK).toMatchObject({
      useCase: 'art_check',
      version: 'art_check.v1',
      tier: 'lite',
      temperature: 0,
    })
    expect(ART_CHECK.instruction).toContain(
      'Is there any text, letter, number, logo or watermark in this image?',
    )
  })
})
