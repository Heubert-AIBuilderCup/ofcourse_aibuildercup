// "Start from an idea" (BR12, BR13), with the fake provider, an in-memory call log and an injected
// page reader: no network, no database. Gemini's search names pages by title and site; each is
// kept only when a grounding chunk backs it, and shown at the page that chunk resolves to.

import { describe, expect, it, mock } from 'bun:test'
import type { CallLog, GroundedSource } from './client'

const memoryCalls: CallLog = {
  countToday: async () => 0,
  record: async () => {},
  reserve: async () => 'reserved',
  settle: async () => {},
}

mock.module('server-only', () => ({}))

const client = await import('./client')
const { aiConfig } = await import('./config')
const { FAKE_SOURCES, makeFake } = await import('./fake')
const memoryAi = client.makeAi({
  provider: makeFake(),
  config: aiConfig({ AI_PROVIDER: 'fake', GEMINI_FLASH_MODEL: 'flash-model' }),
  calls: memoryCalls,
  cache: { get: async () => null, put: async () => {} },
  logCall: () => {},
})
mock.module('./client', () => ({ ...client, ai: memoryAi }))

const { toModelSchema } = await import('./schema-guard')
const {
  findSources,
  findSupport,
  groundSuggestions,
  NO_SOURCES,
  orderSources,
  RESEARCH_CLAIM,
  SUGGEST_SOURCES,
} = await import('./search')
type PageResult = import('../server/fetch-page').PageResult

const REDIRECT = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'
const item = (site: string, title = `A page on ${site}`, official = true) => ({
  title,
  site,
  why: `Why ${site} helps.`,
  official,
})
const page = (url: string, title = ''): PageResult => {
  const site = new URL(url).hostname.replace(/^www\./, '')
  return { ok: true, page: { url, site, title, paragraphs: ['A paragraph.'] } }
}
const unread: PageResult = { ok: false, error: 'Could not read that page.' }

describe('the suggest_sources spec', () => {
  it('has an example that parses with its schema and passes the schema guard', () => {
    expect(SUGGEST_SOURCES.schema.safeParse(SUGGEST_SOURCES.example.answer).success).toBe(true)
    expect(() => toModelSchema(SUGGEST_SOURCES.schema)).not.toThrow()
    expect(SUGGEST_SOURCES).toMatchObject({
      useCase: 'suggest_sources',
      version: 'suggest_sources.v1',
      tier: 'flash',
    })
  })
})

describe('groundSuggestions', () => {
  it('keeps a suggestion only when a grounding chunk backs it, by site or by title, each chunk once', () => {
    const chunks: GroundedSource[] = [
      { url: REDIRECT, title: 'studyaustralia.gov.au' },
      { url: 'https://immi.homeaffairs.gov.au/visas/student-500', title: 'Student visa' },
      { url: `${REDIRECT}-2`, title: 'International education data' },
    ]
    const study = item('www.StudyAustralia.gov.au')
    const visa = item('homeaffairs.gov.au')
    const made = item('made-up.example')
    const again = item('studyaustralia.gov.au', 'Another page on the same site')
    const byTitle = item('education.gov.au', 'International education data')
    expect(groundSuggestions([study, visa, made, again, byTitle], chunks)).toEqual([
      { item: study, chunk: chunks[0] },
      { item: visa, chunk: chunks[1] },
      { item: byTitle, chunk: chunks[2] },
    ])
  })

  it("never matches a site to the grounding redirect's own host", () => {
    const chunks = [{ url: REDIRECT, title: 'monash.edu' }]
    expect(groundSuggestions([item('google.com')], chunks)).toEqual([])
  })
})

describe('orderSources', () => {
  const source = (url: string, official: boolean) => ({
    url,
    title: url,
    site: new URL(url).hostname,
    why: 'Why.',
    official,
  })

  it('puts official sources first, keeping the order within each, one per page, at most eight', () => {
    const blog = source('https://blog.example/a', false)
    const gov = source('https://gov.example/a', true)
    const news = source('https://news.example/a', false)
    const uni = source('https://uni.example/a', true)
    expect(orderSources([blog, gov, news, uni, { ...gov, why: 'Twice.' }])).toEqual([
      gov,
      uni,
      blog,
      news,
    ])
    const many = Array.from({ length: 10 }, (_, i) => source(`https://s${i}.example/`, false))
    expect(orderSources(many)).toHaveLength(8)
  })
})

describe('findSources', () => {
  const idea = 'Can students work during exam weeks in Australia'

  it('shows a redirect chunk as the page it resolves to, with that page’s address and site', async () => {
    const real = 'https://www.studyaustralia.gov.au/en/plan-your-studies/work-while-you-study'
    const reads: string[] = []
    const read = async (url: string) => {
      reads.push(url)
      return url === FAKE_SOURCES[0].url ? page(real, 'Work while you study') : unread
    }
    const res = await findSources(idea, read)
    expect(res).toEqual({
      ok: true,
      sources: [
        {
          url: real,
          site: 'studyaustralia.gov.au',
          title: 'Work while you study',
          why: expect.any(String),
          official: true,
        },
      ],
      entryPoint: expect.any(String),
    })
    // Every page Gemini named and a chunk backs is resolved; the one that could not be is left out.
    expect(reads).toEqual(FAKE_SOURCES.map((s) => s.url))
  })

  it('says "Try a more specific idea." when no suggested page can be resolved', async () => {
    expect(await findSources(idea, async () => unread)).toEqual({ ok: false, error: NO_SOURCES })
    expect(NO_SOURCES).toBe('Try a more specific idea.')
  })

  it("passes the search's own failure on", async () => {
    const res = await findSources(`${idea} [fake:fail-search]`, async () => unread)
    expect(res).toEqual({ ok: false, error: 'This step failed. Your work so far is kept.' })
  })
})

describe('the research_claim spec', () => {
  it('has an example that parses with its schema and passes the schema guard', () => {
    expect(RESEARCH_CLAIM.schema.safeParse(RESEARCH_CLAIM.example.answer).success).toBe(true)
    expect(() => toModelSchema(RESEARCH_CLAIM.schema)).not.toThrow()
    expect(RESEARCH_CLAIM).toMatchObject({
      useCase: 'research_claim',
      version: 'research_claim.v1',
      tier: 'flash',
    })
    // Up to three, named by title and site with the sentence each supports: never an address.
    const one = {
      title: 'Work while you study',
      site: 'studyaustralia.gov.au',
      sentence: 'A sentence.',
    }
    const many = { sources: Array.from({ length: 4 }, () => one) }
    expect(RESEARCH_CLAIM.schema.safeParse(many).success).toBe(false)
  })
})

describe('findSupport (BR14)', () => {
  const claim = 'Students on a student visa can work 48 hours a fortnight during term.'
  const real = 'https://www.studyaustralia.gov.au/en/work-while-you-study'
  const at = (url: string, paragraphs: string[], title = ''): PageResult => {
    const site = new URL(url).hostname.replace(/^www\./, '')
    return { ok: true, page: { url, site, title, paragraphs } }
  }

  it('offers a page only when it holds a sentence that supports the claim, at the address its redirect resolves to', async () => {
    const reads: string[] = []
    const read = async (url: string) => {
      reads.push(url)
      if (url === FAKE_SOURCES[0].url) {
        return at(
          real,
          ['Work rights differ by visa.', `In short: ${claim} Check before you start.`],
          'Work while you study',
        )
      }
      // The visa page is read, but never says it.
      if (url === FAKE_SOURCES[1].url)
        return at(url, ['A student visa lets you study in Australia.'])
      return unread
    }
    const res = await findSupport(claim, { postId: 'p1', read })
    expect(res).toEqual({
      ok: true,
      sources: [
        {
          url: real,
          site: 'studyaustralia.gov.au',
          title: 'Work while you study',
          // The page's own sentence, whole, that holds what the model quoted.
          sentence: `In short: ${claim}`,
        },
      ],
      entryPoint: expect.any(String),
    })
    expect(reads).toEqual(FAKE_SOURCES.map((s) => s.url))
  })

  it('offers none, and says so with no error, when no page holds a supporting sentence', async () => {
    expect(await findSupport(claim, { postId: 'p1', read: async () => unread })).toEqual({
      ok: true,
      sources: [],
      entryPoint: expect.any(String),
    })
  })

  it("passes the search's own failure on", async () => {
    const res = await findSupport(`${claim} [fake:fail-search]`, {
      postId: 'p1',
      read: async () => unread,
    })
    expect(res).toEqual({ ok: false, error: 'This step failed. Your work so far is kept.' })
  })
})
