// The comic character's views (RC9), with the fake provider or a scripted one and an in-memory
// call log and cache: no network, no database. Code checks the count, each label and each scene;
// the sheet's prompt is built by code from the views, the description, the note and the style.

import { describe, expect, it, mock } from 'bun:test'
import type { Cache, CallLog, Provider } from './client'

process.env.AI_PROVIDER = 'fake'

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
const { CHARACTER_PLAN, RETRY_LEAD } = await import('./prompts')
const { labelError, planViews, sceneError, sheetPrompt, viewProblems } = await import('./character')
const { NATIVE_IDS, nativeOf } = await import('../text/native-fixtures')

type JsonReq = Parameters<Provider['json']>[0]

function aiOn(provider: Provider) {
  return makeAi({
    provider,
    config: aiConfig(process.env),
    calls: memoryCalls,
    cache: freshCache(),
    sleep: async () => {},
  })
}

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

const view = (label: string, scene = 'Standing tall, a green jacket and a canvas backpack.') => ({
  label,
  scene,
})
const GOOD = { views: ['Front', 'Side', 'Back', 'Smiling'].map((l) => view(l)) }
const DESCRIPTION = 'A gender-neutral student in their early twenties, casual clothes'

describe('CHARACTER_PLAN', () => {
  it('has an example answer its schema accepts and its rules pass', () => {
    const answer = CHARACTER_PLAN.schema.parse(CHARACTER_PLAN.example.answer)
    expect(viewProblems(answer)).toEqual([])
  })
})

describe('viewProblems', () => {
  it('names a count outside 4 to 6, a long scene, a scene or label the art guard refuses, and an empty label', () => {
    expect(viewProblems({ views: GOOD.views.slice(0, 3) })).toEqual([
      'views: 3 views; a sheet has 4 to 6.',
    ])
    const problems = viewProblems({
      views: [
        view('Front', 'x'.repeat(201)),
        view('Side 2'),
        view(' '),
        view('Back', 'A cap with 3 badges.'),
      ],
    })
    expect(problems).toEqual([
      'views.0.scene: 201 characters; at most 200.',
      expect.stringMatching(/^views\.1\.label: /),
      'views.2.label: name the view.',
      expect.stringMatching(/^views\.3\.scene: /),
    ])
  })
})

describe('labelError and sceneError', () => {
  it('take a Nepali, Hindi or Thai label of 40 and scene of 200 characters as a reader sees them, and refuse one over (GD37)', () => {
    for (const id of NATIVE_IDS) {
      expect(labelError(nativeOf(id, 40)), id).toBeNull()
      expect(sceneError(nativeOf(id, 200)), id).toBeNull()
      expect(labelError(nativeOf(id, 41)), id).toBe('41 characters; at most 40.')
      expect(sceneError(nativeOf(id, 201)), id).toBe('201 characters; at most 200.')
    }
  })
})

describe('planViews (RC9)', () => {
  it('plans the fake’s five views from the description, trimmed', async () => {
    const res = await planViews({ description: DESCRIPTION }, { ai: aiOn(makeFake()) })
    if (!res.ok) throw new Error(res.error)
    expect(res.views).toHaveLength(5)
    expect(viewProblems({ views: res.views })).toEqual([])
  })

  it('sends the description and retries an answer with three views', async () => {
    const { provider, requests } = scripted([{ views: GOOD.views.slice(0, 3) }, GOOD])
    const res = await planViews({ description: DESCRIPTION }, { ai: aiOn(provider) })
    if (!res.ok) throw new Error(res.error)
    expect(res.views).toEqual(GOOD.views)
    expect(requests[0].data).toEqual({ description: DESCRIPTION })
    expect(requests).toHaveLength(2)
    expect(requests[1].user).toContain(RETRY_LEAD)
  })

  it('returns a failure when the provider fails', async () => {
    const res = await planViews(
      { description: 'x [fake:fail-character_plan]' },
      { ai: aiOn(makeFake()) },
    )
    expect(res.ok).toBe(false)
  })
})

describe('sheetPrompt', () => {
  it('draws one person in every view from the views, the description and the note, without text, in the comic style', () => {
    const prompt = sheetPrompt({
      views: GOOD.views,
      description: DESCRIPTION,
      note: 'Make the jacket blue',
      artStyle: 'Warm ink lines, flat colours',
    })
    const [own, guideline] = prompt.split('\n\nBrand guideline for the image:\n')
    expect(own).toStartWith(
      'A character reference sheet of one person on a plain light background, the same person in every view:',
    )
    for (const v of GOOD.views) expect(own).toContain(`${v.label}: ${v.scene}`)
    expect(own).toContain(DESCRIPTION)
    expect(own).toContain('Make the jacket blue')
    expect(own).toContain('No text, letters, numbers, logos or watermarks anywhere in the image.')
    expect(guideline).toContain('Style: Warm ink lines, flat colours')
    expect(
      sheetPrompt({ views: GOOD.views, description: DESCRIPTION, note: null, artStyle: 'x' }),
    ).not.toContain('Change:')
  })
})
