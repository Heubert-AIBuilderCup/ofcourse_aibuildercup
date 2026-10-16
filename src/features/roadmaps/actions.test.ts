// The roadmaps' actions with the session, the profile and the roadmaps' repository mocked: who is
// refused, what is checked first, and what reaches the repository. The repository itself is proven
// against the database in ./server/roadmaps.test.ts.

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { Roadmap } from '@/shared/types/student'

type FakeSession = { user: { id: string; role: string | null } } | null
let session: FakeSession = null
const student = (): FakeSession => ({ user: { id: 'student-1', role: 'user' } })

/** Set to make the session lookup itself fail, as a database error would. */
let sessionError: Error | null = null
mock.module('@/shared/lib/auth/session', () => ({
  getSession: async () => {
    if (sessionError) throw sessionError
    return session
  },
}))

const roadmap = (over: Partial<Roadmap> = {}): Roadmap => ({
  id: 'rm-1',
  name: null,
  answers: {},
  relative: null,
  coins: { state: 'later' },
  choices: {},
  ownWords: {},
  tags: [],
  lastStep: 'attention',
  copiedFrom: null,
  createdAt: new Date('2026-10-14T09:00:00Z'),
  finishedAt: null,
  lastOpenedAt: null,
  archivedAt: null,
  ...over,
})

/** Her stored coins, as the profile read gives them (the draft's). */
let storedCoins: unknown = { state: 'later' }
/** How many finished roadmaps she has. */
let finishedCount = 2
const getProfile = mock(async (userId: string) => ({
  userId,
  coins: storedCoins,
  finished: finishedCount,
}))
// Every export the module has, as Bun keeps one mock of a module for the whole run (opening's
// actions test mocks it too).
const none = async () => {}
const wrote = async () => true
mock.module('@/features/opening/server/profile', () => ({
  getProfile,
  saveAnswers: wrote,
  savePersona: none,
  saveRelative: wrote,
  saveCoins: wrote,
  markStep: none,
}))

/** The roadmap she is answering, as the repository gives it. */
let draft: Roadmap | null = null
const getDraft = mock(async (_userId: string) => draft)
const finishRoadmap = mock(
  async (_userId: string): Promise<Roadmap | null> => roadmap({ finishedAt: new Date() }),
)
const ensureDraft = mock(async (_userId: string) => roadmap())
/** What the repository answers for rename, restore and choices: false when not hers. */
let found = true
/** What it answers for a delete or an archive: done, or why it was refused. */
let putAway: true | 'kept-one' | 'not-found' = true
/** Whether she has an archived roadmap. */
let archivedOnes = false
const renameRoadmap = mock(async (_userId: string, _id: string, _name: string) => found)
const softDeleteRoadmap = mock(async (_userId: string, _id: string) => putAway)
const restoreRoadmap = mock(async (_userId: string, _id: string) => found)
const saveChoices = mock(async (_userId: string, _id: string, _choices: unknown) => found)
const archiveRoadmap = mock(async (_userId: string, _id: string) => putAway)
const restoreArchived = mock(async (_userId: string, _id: string) => found)
const hasArchived = mock(async (_userId: string) => archivedOnes)
/** What it answers for a roadmap's answers: saved, or why not. */
let answersSaved: true | 'bad-answers' | 'not-found' = true
const saveRoadmapAnswers = mock(
  async (_userId: string, _id: string, _answers: unknown) => answersSaved,
)
/** What it answers for a new roadmap: the roadmap made, or why not. */
let created: Roadmap | 'bad-answers' | 'not-found' = roadmap({ id: 'rm-new' })
const createRoadmap = mock(async (_userId: string, _input: unknown) => created)
// The writes, counted together; the reads are apart, so a check before a write does not count.
const writes = {
  finishRoadmap,
  ensureDraft,
  renameRoadmap,
  softDeleteRoadmap,
  restoreRoadmap,
  saveChoices,
  archiveRoadmap,
  restoreArchived,
  saveRoadmapAnswers,
  createRoadmap,
}
/** The roadmap a copy is made from, as the repository reads it: null when not hers. */
let source: Roadmap | null = roadmap({ finishedAt: new Date('2026-10-14T09:10:00Z') })
const getRoadmap = mock(async (_userId: string, _id: string) => source)
mock.module('./server/roadmaps', () => ({ ...writes, getDraft, getRoadmap, hasArchived }))

// Outside a request, Next's own would throw; here it only says it was asked.
const refresh = mock(() => {})
mock.module('next/cache', () => ({ refresh }))

const {
  archiveRoadmapAction,
  createRoadmapAction,
  deleteRoadmapAction,
  finishOnboardingAction,
  renameRoadmapAction,
  restoreArchivedAction,
  restoreRoadmapAction,
  saveChoicesAction,
  saveRoadmapAnswersAction,
  refreshAfterOnboardingAction,
} = await import('./actions')

const SIGN_IN = 'Please sign in again.'
const NOT_AUTHORISED = 'Not authorised.'
const SAVE_FAILED = 'Could not save. Please try again.'

const calls = [
  ['finishOnboardingAction', () => finishOnboardingAction()],
  ['renameRoadmapAction', () => renameRoadmapAction('rm-1', 'On a budget')],
  ['deleteRoadmapAction', () => deleteRoadmapAction('rm-1')],
  ['restoreRoadmapAction', () => restoreRoadmapAction('rm-1')],
  ['saveChoicesAction', () => saveChoicesAction('rm-1', { swapped: true })],
  ['archiveRoadmapAction', () => archiveRoadmapAction('rm-1')],
  ['restoreArchivedAction', () => restoreArchivedAction('rm-1')],
  [
    'saveRoadmapAnswersAction',
    () => saveRoadmapAnswersAction('rm-1', { amount: { value: 30, state: 'stated' } }),
  ],
  ['refreshAfterOnboardingAction', () => refreshAfterOnboardingAction()],
  [
    'createRoadmapAction',
    () =>
      createRoadmapAction({ fromId: 'rm-1', answers: { amount: { value: 30, state: 'stated' } } }),
  ],
] as const

const writeCalls = () => Object.values(writes).reduce((n, f) => n + f.mock.calls.length, 0)

afterEach(() => {
  session = null
  sessionError = null
  storedCoins = { state: 'later' }
  draft = null
  found = true
  putAway = true
  archivedOnes = false
  finishedCount = 2
  getProfile.mockClear()
  renameRoadmap.mockClear()
  softDeleteRoadmap.mockClear()
  restoreRoadmap.mockClear()
  saveChoices.mockClear()
  archiveRoadmap.mockClear()
  restoreArchived.mockClear()
  hasArchived.mockClear()
  answersSaved = true
  saveRoadmapAnswers.mockClear()
  created = roadmap({ id: 'rm-new' })
  createRoadmap.mockClear()
  source = roadmap({ finishedAt: new Date('2026-10-14T09:10:00Z') })
  getRoadmap.mockClear()
  getDraft.mockClear()
  refresh.mockClear()
  finishRoadmap.mockReset()
  finishRoadmap.mockImplementation(async () => roadmap({ finishedAt: new Date() }))
  ensureDraft.mockReset()
  ensureDraft.mockImplementation(async () => roadmap())
})

describe('who may call the roadmaps actions', () => {
  for (const [name, call] of calls) {
    it(`${name} asks a signed-out caller to sign in again, and writes nothing`, async () => {
      expect(await call()).toEqual({ ok: false, error: SIGN_IN })
      expect(writeCalls()).toBe(0)
    })

    it(`${name} refuses an admin, a superadmin and an account with no role`, async () => {
      for (const role of ['admin', 'superadmin', null]) {
        session = { user: { id: 'staff-1', role } }
        expect(await call()).toEqual({ ok: false, error: NOT_AUTHORISED })
      }
      expect(writeCalls()).toBe(0)
    })

    it(`${name} says the save failed rather than throw when the session lookup fails`, async () => {
      sessionError = new Error('connection refused')
      const logged = spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(await call()).toEqual({ ok: false, error: SAVE_FAILED })
        expect(logged.mock.calls[0]?.[0]).toBe(`[roadmaps.${name.replace(/Action$/, '')}]`)
      } finally {
        logged.mockRestore()
      }
      expect(writeCalls()).toBe(0)
    })
  }
})

describe('finishOnboardingAction', () => {
  // A refresh here would re-render the end screen, which sends a finished student on to her
  // roadmaps and so cuts the loader short; the screen refreshes once the loader has run.
  it("finishes the roadmap she is answering, on the session's own account, and does not refresh", async () => {
    session = student()
    expect(await finishOnboardingAction()).toEqual({ ok: true, id: 'rm-1' })
    expect(getProfile).toHaveBeenCalledWith('student-1')
    expect(finishRoadmap).toHaveBeenCalledWith('student-1')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refuses while her coins are not stored, and finishes nothing', async () => {
    session = student()
    storedCoins = null
    expect(await finishOnboardingAction()).toEqual({
      ok: false,
      error: 'Place your coins, or leave them for later, first.',
    })
    expect(finishRoadmap).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('says the save failed rather than throw when finishing fails', async () => {
    session = student()
    finishRoadmap.mockImplementation(async () => {
      throw new Error('connection refused')
    })
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await finishOnboardingAction()).toEqual({ ok: false, error: SAVE_FAILED })
      expect(logged).toHaveBeenCalled()
    } finally {
      logged.mockRestore()
    }
    expect(refresh).not.toHaveBeenCalled()
  })
})

const NOT_FOUND = "We couldn't find that roadmap. Reload the page and try again."

describe('renameRoadmapAction', () => {
  it("renames her roadmap, on the session's own account, trimmed", async () => {
    session = student()
    expect(await renameRoadmapAction('rm-1', '  On a budget  ')).toEqual({ ok: true })
    expect(renameRoadmap).toHaveBeenCalledWith('student-1', 'rm-1', 'On a budget')
  })

  it('refuses an empty name or one over 60 characters, and renames nothing', async () => {
    session = student()
    for (const name of ['', '   ', 'x'.repeat(61)]) {
      expect(await renameRoadmapAction('rm-1', name)).toEqual({
        ok: false,
        error: 'A name has 1 to 60 characters.',
      })
    }
    expect(await renameRoadmapAction('rm-1', 'x'.repeat(60))).toEqual({ ok: true })
    expect(renameRoadmap).toHaveBeenCalledTimes(1)
  })

  it('refuses what is not a string id and a name, and renames nothing', async () => {
    session = student()
    const loose = renameRoadmapAction as (
      id: unknown,
      name: unknown,
    ) => ReturnType<typeof renameRoadmapAction>
    expect((await loose({ id: 'rm-1' }, 'A')).ok).toBe(false)
    expect((await loose('', 'A')).ok).toBe(false)
    expect((await loose('rm-1', 42)).ok).toBe(false)
    expect(renameRoadmap).not.toHaveBeenCalled()
  })

  it('says it cannot find a roadmap that is not hers, deleted or unknown', async () => {
    session = student()
    found = false
    expect(await renameRoadmapAction('rm-2', 'Mine now')).toEqual({ ok: false, error: NOT_FOUND })
  })
})

describe('deleteRoadmapAction', () => {
  it("deletes her roadmap, on the session's own account", async () => {
    session = student()
    expect(await deleteRoadmapAction('rm-1')).toEqual({ ok: true })
    expect(softDeleteRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('refused as her only roadmap, says it stays', async () => {
    session = student()
    putAway = 'kept-one'
    expect(await deleteRoadmapAction('rm-1')).toEqual({
      ok: false,
      error: 'Your only roadmap stays. Make another before you delete this one.',
    })
    expect(hasArchived).toHaveBeenCalledWith('student-1')
  })

  it('refused as her only roadmap out of the archive, says one stays out of it', async () => {
    session = student()
    putAway = 'kept-one'
    archivedOnes = true
    expect(await deleteRoadmapAction('rm-1')).toEqual({
      ok: false,
      error: 'Keep one roadmap out of the archive.',
    })
  })

  it('says it cannot find a roadmap that is not hers, deleted or unknown', async () => {
    session = student()
    putAway = 'not-found'
    expect(await deleteRoadmapAction('rm-2')).toEqual({ ok: false, error: NOT_FOUND })
    expect(hasArchived).not.toHaveBeenCalled()
  })

  it('refuses what is not a string id, and deletes nothing', async () => {
    session = student()
    expect(await (deleteRoadmapAction as (id: unknown) => unknown)(['rm-1'])).toEqual({
      ok: false,
      error: NOT_FOUND,
    })
    expect(softDeleteRoadmap).not.toHaveBeenCalled()
  })
})

describe('restoreRoadmapAction', () => {
  it("brings her deleted roadmap back, on the session's own account", async () => {
    session = student()
    expect(await restoreRoadmapAction('rm-1')).toEqual({ ok: true })
    expect(restoreRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('says it cannot find a roadmap that is not hers or not deleted', async () => {
    session = student()
    found = false
    expect(await restoreRoadmapAction('rm-2')).toEqual({ ok: false, error: NOT_FOUND })
  })
})

describe('refreshAfterOnboardingAction', () => {
  it("refreshes a student's router once the loader has run, and writes nothing", async () => {
    session = student()
    expect(await refreshAfterOnboardingAction()).toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(writeCalls()).toBe(0)
  })

  it('refreshes nothing for a caller it refuses', async () => {
    expect((await refreshAfterOnboardingAction()).ok).toBe(false)
    session = { user: { id: 'staff-1', role: 'admin' } }
    expect((await refreshAfterOnboardingAction()).ok).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('saveChoicesAction', () => {
  const choices = { swapped: true, added: false, read: false, city: false, country: false }

  it("keeps her board's choices on her roadmap, on the session's own account", async () => {
    session = student()
    expect(await saveChoicesAction('rm-1', choices)).toEqual({ ok: true })
    expect(saveChoices).toHaveBeenCalledWith('student-1', 'rm-1', choices)
  })

  it('keeps only the keys a board has', async () => {
    session = student()
    const loose = saveChoicesAction as (id: string, choices: unknown) => Promise<unknown>
    expect(await loose('rm-1', { swapped: true, first: true, userId: 'other' })).toEqual({
      ok: true,
    })
    expect(saveChoices).toHaveBeenCalledWith('student-1', 'rm-1', { swapped: true })
  })

  it('refuses a bad shape or id, and saves nothing', async () => {
    session = student()
    const loose = saveChoicesAction as (id: unknown, choices: unknown) => Promise<{ ok: boolean }>
    expect((await loose('rm-1', { swapped: 'yes' })).ok).toBe(false)
    expect((await loose('rm-1', null)).ok).toBe(false)
    expect((await loose('rm-1', [true])).ok).toBe(false)
    expect((await loose(['rm-1'], choices)).ok).toBe(false)
    expect((await loose('', choices)).ok).toBe(false)
    expect(saveChoices).not.toHaveBeenCalled()
  })

  it('says it cannot find a roadmap that is not hers, deleted or unknown', async () => {
    session = student()
    found = false
    expect(await saveChoicesAction('rm-2', choices)).toEqual({ ok: false, error: NOT_FOUND })
  })
})

describe('archiveRoadmapAction', () => {
  it("archives her roadmap, on the session's own account", async () => {
    session = student()
    expect(await archiveRoadmapAction('rm-1')).toEqual({ ok: true })
    expect(archiveRoadmap).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('refused as her only roadmap out of the archive, says one stays out of it', async () => {
    session = student()
    putAway = 'kept-one'
    expect(await archiveRoadmapAction('rm-1')).toEqual({
      ok: false,
      error: 'Keep one roadmap out of the archive.',
    })
  })

  it('says it cannot find a roadmap that is not hers, deleted, archived or unknown', async () => {
    session = student()
    putAway = 'not-found'
    expect(await archiveRoadmapAction('rm-9')).toEqual({ ok: false, error: NOT_FOUND })
  })

  it('refuses what is not a string id, and archives nothing', async () => {
    session = student()
    const loose = archiveRoadmapAction as (id: unknown) => Promise<unknown>
    expect(await loose(['rm-1'])).toEqual({ ok: false, error: NOT_FOUND })
    expect(await loose('')).toEqual({ ok: false, error: NOT_FOUND })
    expect(await loose('x'.repeat(65))).toEqual({ ok: false, error: NOT_FOUND })
    expect(archiveRoadmap).not.toHaveBeenCalled()
  })
})

describe('restoreArchivedAction', () => {
  it("brings her archived roadmap back into the list, on the session's own account", async () => {
    session = student()
    expect(await restoreArchivedAction('rm-1')).toEqual({ ok: true })
    expect(restoreArchived).toHaveBeenCalledWith('student-1', 'rm-1')
  })

  it('says it cannot find a roadmap that is not hers or not archived', async () => {
    session = student()
    found = false
    expect(await restoreArchivedAction('rm-2')).toEqual({ ok: false, error: NOT_FOUND })
  })

  it('refuses what is not a string id, and restores nothing', async () => {
    session = student()
    const loose = restoreArchivedAction as (id: unknown) => Promise<unknown>
    expect(await loose({ id: 'rm-1' })).toEqual({ ok: false, error: NOT_FOUND })
    expect(restoreArchived).not.toHaveBeenCalled()
  })
})

describe('saveRoadmapAnswersAction', () => {
  const answers = {
    amount: { value: 30, state: 'stated' },
    climate: { value: 'Warm', state: 'stated' },
  } as const

  it("replaces her roadmap's answers, on the session's own account", async () => {
    session = student()
    expect(await saveRoadmapAnswersAction('rm-1', answers)).toEqual({ ok: true })
    expect(saveRoadmapAnswers).toHaveBeenCalledWith('student-1', 'rm-1', answers)
  })

  it('refuses a bad id, and saves nothing', async () => {
    session = student()
    const loose = saveRoadmapAnswersAction as (id: unknown, answers: unknown) => Promise<unknown>
    for (const id of [['rm-1'], '', 'x'.repeat(65), { id: 'rm-1' }]) {
      expect(await loose(id, answers)).toEqual({ ok: false, error: NOT_FOUND })
    }
    expect(saveRoadmapAnswers).not.toHaveBeenCalled()
  })

  it('refuses the whole set when one entry is not an answer to its question, and saves nothing', async () => {
    session = student()
    const loose = saveRoadmapAnswersAction as (id: string, answers: unknown) => Promise<unknown>
    for (const bad of [
      { ...answers, amount: { value: 31, state: 'stated' } },
      { ...answers, eng: 'IELTS 9.5' },
      { ...answers, nope: { value: 'Yes', state: 'stated' } },
      { ...answers, amount: { value: 24, state: 'assumed' } },
      [answers.amount],
      null,
    ]) {
      expect(await loose('rm-1', bad)).toEqual({
        ok: false,
        error: "We couldn't save your answers. Reload the page and try again.",
      })
    }
    expect(saveRoadmapAnswers).not.toHaveBeenCalled()
  })

  it('stores a pick as its answer: "Not sure" as the assumed default', async () => {
    session = student()
    const loose = saveRoadmapAnswersAction as (id: string, answers: unknown) => Promise<unknown>
    expect(await loose('rm-1', { amount: 'Not sure', climate: 'Warm' })).toEqual({ ok: true })
    expect(saveRoadmapAnswers).toHaveBeenCalledWith('student-1', 'rm-1', {
      amount: { value: 30, state: 'assumed' },
      climate: { value: 'Warm', state: 'stated' },
    })
  })

  it('says the answers could not be saved when the repository refuses them', async () => {
    session = student()
    answersSaved = 'bad-answers'
    expect(await saveRoadmapAnswersAction('rm-1', answers)).toEqual({
      ok: false,
      error: "We couldn't save your answers. Reload the page and try again.",
    })
  })

  it('says it cannot find a roadmap that is not hers, a draft, deleted or unknown', async () => {
    session = student()
    answersSaved = 'not-found'
    expect(await saveRoadmapAnswersAction('rm-2', answers)).toEqual({
      ok: false,
      error: NOT_FOUND,
    })
  })
})

describe('createRoadmapAction', () => {
  const BAD_ANSWERS = "We couldn't save your answers. Reload the page and try again."
  const loose = createRoadmapAction as (input: unknown) => Promise<unknown>

  it("makes a copy of her roadmap with her answers, on the session's own account, and gives its id", async () => {
    session = student()
    expect(
      await loose({ fromId: 'rm-1', answers: { amount: 'Not sure', climate: 'Warm' } }),
    ).toEqual({ ok: true, id: 'rm-new' })
    // Each pick stored as its answer, as onboarding stores it.
    expect(createRoadmap).toHaveBeenCalledWith('student-1', {
      fromId: 'rm-1',
      name: 'Copy of Cyber Security in Perth',
      answers: {
        amount: { value: 30, state: 'assumed' },
        climate: { value: 'Warm', state: 'stated' },
      },
    })
  })

  it('names a copy "Copy of" its source, her own name for it if she gave one, cut to 60 characters', async () => {
    session = student()
    source = roadmap({ name: 'On a budget', finishedAt: new Date() })
    await loose({ fromId: 'rm-1', answers: {} })
    expect(createRoadmap).toHaveBeenLastCalledWith('student-1', {
      fromId: 'rm-1',
      name: 'Copy of On a budget',
      answers: {},
    })

    source = roadmap({ name: `${'é'.repeat(50)} and more`, finishedAt: new Date() })
    await loose({ fromId: 'rm-1', answers: {} })
    const [, made] = createRoadmap.mock.lastCall ?? []
    const name = (made as { name: string }).name
    expect([...name].length).toBe(60)
    expect(name).toBe(`Copy of ${'é'.repeat(50)} a`)
  })

  it('without a source, makes one from scratch with her answers: no copy of anything', async () => {
    session = student()
    expect(await loose({ answers: { climate: 'Warm' } })).toEqual({ ok: true, id: 'rm-new' })
    expect(createRoadmap).toHaveBeenCalledWith('student-1', {
      answers: { climate: { value: 'Warm', state: 'stated' } },
    })
  })

  it('is the only way to a new roadmap: nothing starts onboarding again', async () => {
    expect(await import('./actions')).not.toHaveProperty('startFromScratchAction')
  })

  it('refuses a bad source id, and makes nothing', async () => {
    session = student()
    for (const fromId of [['rm-1'], '', 'x'.repeat(65), { id: 'rm-1' }, null]) {
      expect(await loose({ fromId, answers: {} })).toEqual({ ok: false, error: NOT_FOUND })
    }
    expect(await loose(null)).toEqual({ ok: false, error: BAD_ANSWERS })
    expect(createRoadmap).not.toHaveBeenCalled()
  })

  it('refuses the whole set when one entry is not an answer to its question, and makes nothing', async () => {
    session = student()
    for (const answers of [
      { amount: { value: 31, state: 'stated' } },
      { eng: 'IELTS 9.5' },
      { nope: { value: 'Yes', state: 'stated' } },
      [{ value: 30, state: 'stated' }],
      null,
    ]) {
      expect(await loose({ fromId: 'rm-1', answers })).toEqual({ ok: false, error: BAD_ANSWERS })
    }
    expect(createRoadmap).not.toHaveBeenCalled()
  })

  it('says it cannot find a source that is not hers, and that bad answers were refused', async () => {
    session = student()
    source = null
    expect(await loose({ fromId: 'rm-2', answers: {} })).toEqual({ ok: false, error: NOT_FOUND })
    expect(createRoadmap).not.toHaveBeenCalled()
    source = roadmap({ finishedAt: new Date() })
    created = 'not-found'
    expect(await loose({ fromId: 'rm-2', answers: {} })).toEqual({ ok: false, error: NOT_FOUND })
    created = 'bad-answers'
    expect(await loose({ fromId: 'rm-1', answers: {} })).toEqual({ ok: false, error: BAD_ANSWERS })
  })
})
