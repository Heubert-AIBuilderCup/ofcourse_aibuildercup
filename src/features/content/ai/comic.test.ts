// A comic's story (RC2), with the fake provider or a scripted one and an in-memory call log and
// cache: no network, no database. Code checks the panel count, each caption and scene, the title.

import { describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'
process.env.AI_DAILY_CAP_PRO = '1000'

const memoryCalls: CallLog = {
  countToday: async () => 0,
  record: async () => {},
  reserve: async () => 'reserved',
  settle: async () => {},
}
const freshCache = (): Cache => {
  const store = new Map<string, unknown>()
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, row) => {
      store.set(key, row.value)
    },
  }
}

mock.module('server-only', () => ({}))
mock.module('./calls', () => ({ dbCallLog: memoryCalls }))
mock.module('./cache', () => ({ dbCache: freshCache() }))

const { makeAi } = await import('./client')
const { aiConfig } = await import('./config')
const { makeFake } = await import('./fake')
const { COMIC_STORY, RETRY_LEAD, buildPrompt, languageRule } = await import('./prompts')
const { scriptShare } = await import('../text/script')
const { draftStory, storyProblems } = await import('./comic')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')
const { languageById } = await import('../languages')
const { PATHS, pathFacts } = await import('../lib/path-facts')
const { COMIC_TEMPLATE_ID } = await import('../templates')

type JsonReq = Parameters<Provider['json']>[0]

const path = PATHS[0]
const found = pathFacts(path.id)
if (!found) throw new Error('path facts missing')
const facts = found.facts

/** An `ai` on this provider, with its own empty cache, so no test answers from another's. */
function aiOn(provider: Provider) {
  return makeAi({
    provider,
    config: aiConfig(process.env),
    calls: memoryCalls,
    cache: freshCache(),
    sleep: async () => {},
  })
}

/** A provider that gives these answers in turn and keeps every request it was sent. */
function scripted(answers: unknown[]) {
  const requests: JsonReq[] = []
  const provider: Provider = {
    async json(req) {
      requests.push(req)
      return JSON.stringify(answers[Math.min(requests.length - 1, answers.length - 1)])
    },
    image: async () => new Uint8Array(),
  }
  return { provider, requests }
}

const panel = (caption: string) => ({
  caption,
  scene: 'The student walks along a river path at dawn, a backpack on one shoulder, soft light.',
})
const GOOD = {
  title: 'A new city',
  panels: [
    panel('The student lands in a new city and finds the way to campus.'),
    panel('Classes start, and the student learns where the quiet desks are.'),
    panel('A part-time shift fills the evenings after study.'),
    panel('The student looks out over the river and plans the next term.'),
  ],
}

function input(over: Partial<Parameters<typeof draftStory>[0]> = {}) {
  return {
    path,
    facts,
    premise: null,
    emotion: null,
    postId: 'test-post',
    ...over,
  }
}

describe('COMIC_STORY', () => {
  it('has an example answer its schema accepts and its rules pass', () => {
    expect(COMIC_STORY.schema.safeParse(COMIC_STORY.example.answer).success).toBe(true)
    const { facts: exampleFacts } = COMIC_STORY.example.data as {
      facts: { id: string; text: string }[]
    }
    const answer = COMIC_STORY.schema.parse(COMIC_STORY.example.answer)
    expect(answer.panels).toHaveLength(4)
    expect(
      storyProblems(
        answer,
        exampleFacts.map((f) => ({ ...facts[0], id: f.id, text: f.text })),
      ),
    ).toEqual([])
  })
})

describe('draftStory (RC2)', () => {
  it('drafts four panels with scenes in the comic template, the cover first', async () => {
    const res = await draftStory(input(), { ai: aiOn(makeFake()) })
    if (!res.ok) throw new Error(res.error)
    const { structure } = res
    expect(structure.templateId).toBe(COMIC_TEMPLATE_ID)
    expect(structure.slides.map((s) => s.kind)).toEqual(['cover', 'body', 'body', 'body'])
    for (const slide of structure.slides) {
      expect(slide.slots.caption).toEqual({
        text: expect.any(String),
        factIds: [],
        factual: false,
      })
      expect(slide.scene?.length).toBeGreaterThan(0)
    }
    expect(structure.artPrompt).toBe(structure.slides[0].scene ?? '')
    expect(res.title.length).toBeGreaterThan(0)
  })

  it('retries an answer with seven panels and ends with the good one', async () => {
    const seven = { ...GOOD, panels: [...GOOD.panels, ...GOOD.panels.slice(0, 3)] }
    const { provider, requests } = scripted([seven, GOOD])
    const res = await draftStory(input(), { ai: aiOn(provider) })
    if (!res.ok) throw new Error(res.error)
    expect(res.structure.slides).toHaveLength(4)
    expect(res.structure.slides[0].slots.caption.text).toBe(GOOD.panels[0].caption)
    expect(requests).toHaveLength(2)
    expect(requests[1].user).toContain(RETRY_LEAD)
    expect(requests[1].user).toMatch(/7 panels/)
  })

  it('retries an answer whose caption promises an outcome', async () => {
    const promising = {
      ...GOOD,
      panels: [panel('A job is guaranteed after graduation.'), ...GOOD.panels.slice(1)],
    }
    const { provider, requests } = scripted([promising, GOOD])
    const res = await draftStory(input(), { ai: aiOn(provider) })
    expect(res.ok).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[1].user).toContain('guaranteed')
  })

  it('sends the premise and the emotion’s tone with the path and its facts', async () => {
    const { provider, requests } = scripted([GOOD])
    const emotion = { label: 'Hopeful', tone: 'Forward-looking and warm.' }
    await draftStory(input({ premise: 'Her first winter away from home', emotion }), {
      ai: aiOn(provider),
    })
    const data = requests[0].data as {
      path: string
      premise: string | null
      emotion: { label: string; tone: string } | null
      facts: { id: string; text: string }[]
    }
    expect(data.premise).toBe('Her first winter away from home')
    expect(data.emotion?.tone).toBe('Forward-looking and warm.')
    expect(data.path).toBe(path.label)
    expect(data.facts).toEqual(facts.map(({ id, text }) => ({ id, text })))
  })

  it('returns a failure when the provider fails', async () => {
    const res = await draftStory(input({ premise: 'x [fake:fail-comic_story]' }), {
      ai: aiOn(makeFake()),
    })
    expect(res.ok).toBe(false)
  })
})

describe('a comic in its language (GD37)', () => {
  it('takes a Nepali, Hindi or Thai caption of 140 and scene of 300 characters as a reader sees them', () => {
    for (const id of NATIVE_IDS) {
      const language = languageById(id)
      if (!language) throw new Error(id)
      const story = {
        title: nativeOf(id, 20),
        panels: [0, 1, 2, 3].map(() => ({ caption: nativeOf(id, 140), scene: nativeOf(id, 300) })),
      }
      expect(storyProblems(story, facts, language), id).toEqual([])
    }
  })

  it('sends a Nepali comic its language and the rule, and takes the fake’s story in Devanagari', async () => {
    const requests: JsonReq[] = []
    const fake = makeFake()
    const provider: Provider = {
      json: (req) => {
        requests.push(req)
        return fake.json(req)
      },
      image: fake.image,
    }
    const res = await draftStory(input({ language: 'ne' }), { ai: aiOn(provider) })
    if (!res.ok) throw new Error(res.error)
    expect(requests[0].data).toMatchObject({ language: { id: 'ne', label: 'Nepali' } })
    expect(requests[0].system).toContain(languageRule('Nepali'))
    const captions = res.structure.slides.map((s) => s.slots.caption.text).join('\n')
    expect(scriptShare(captions, 'devanagari')).toBe(1)
  })

  it('refuses an English story for a Nepali comic; an English comic sends no language and no rule', async () => {
    const nepali = scripted([GOOD])
    expect((await draftStory(input({ language: 'ne' }), { ai: aiOn(nepali.provider) })).ok).toBe(
      false,
    )
    expect(nepali.requests[1].user).toContain(
      'title and panels: write it in Nepali, in its own script',
    )
    const english = scripted([GOOD])
    expect((await draftStory(input(), { ai: aiOn(english.provider) })).ok).toBe(true)
    expect(english.requests[0].data).not.toHaveProperty('language')
    expect(english.requests[0].system).toBe(
      buildPrompt(COMIC_STORY, english.requests[0].data).system,
    )
  })
})
