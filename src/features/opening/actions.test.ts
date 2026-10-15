// The student actions with the session and the repository mocked: who is refused, what is
// validated, and what reaches the repository. The repository itself is proven against the
// database in ./server/profile.test.ts.

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'

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

// The roadmap writes answer whether they wrote (false once onboarding is closed).
const wrote = async () => true
const saveAnswers = mock(
  async (_userId: string, _patch: unknown, _cleared: readonly string[] = []) => true,
)
const savePersona = mock(async (_userId: string, _persona: unknown) => {})
const saveRelative = mock(async (_userId: string, _relative: unknown) => true)
const saveCoins = mock(async (_userId: string, _coins: unknown) => true)
// The writes, counted together.
const repository = { saveAnswers, savePersona, saveRelative, saveCoins }
// Every export the module has, as Bun keeps one mock of a module for the whole run (the roadmaps'
// actions test mocks it too).
mock.module('./server/profile', () => ({
  ...repository,
  getProfile: async (userId: string) => ({ userId }),
  markStep: async () => {},
}))

const { saveAnswersAction, saveCoinsAction, savePersonaAction, saveRelativeAction } = await import(
  './actions'
)

const SIGN_IN = 'Please sign in again.'
const NOT_AUTHORISED = 'Not authorised.'
const INVALID = "That answer isn't one of the options."
const SAVE_FAILED = 'Could not save. Please try again.'

const relative = { placeId: 'perth', place: 'Perth', relationship: 'Cousin', name: 'Asha' }
const coins = { state: 'spent', piles: [2, 2, 1, 1, 1, 1, 1, 1], assumed: false }

// Every action, called with input that is valid, so only the caller decides the outcome.
const calls = [
  ['saveAnswersAction', () => saveAnswersAction({ amount: 36 })],
  ['savePersonaAction', () => savePersonaAction('female')],
  ['saveRelativeAction', () => saveRelativeAction(relative)],
  ['saveCoinsAction', () => saveCoinsAction(coins)],
] as const

const repositoryCalls = () => Object.values(repository).reduce((n, f) => n + f.mock.calls.length, 0)

afterEach(() => {
  session = null
  sessionError = null
  for (const f of [saveAnswers, saveRelative, saveCoins]) {
    f.mockReset()
    f.mockImplementation(wrote)
  }
  savePersona.mockReset()
  savePersona.mockImplementation(async () => {})
})

describe('who may call the student actions', () => {
  for (const [name, call] of calls) {
    it(`${name} asks a signed-out caller to sign in again, and saves nothing`, async () => {
      expect(await call()).toEqual({ ok: false, error: SIGN_IN })
      expect(repositoryCalls()).toBe(0)
    })

    it(`${name} refuses an admin, a superadmin and an account with no role`, async () => {
      for (const role of ['admin', 'superadmin', null]) {
        session = { user: { id: 'staff-1', role } }
        expect(await call()).toEqual({ ok: false, error: NOT_AUTHORISED })
      }
      expect(repositoryCalls()).toBe(0)
    })

    it(`${name} says the save failed rather than throw when the session lookup fails`, async () => {
      sessionError = new Error('connection refused')
      const logged = spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(await call()).toEqual({ ok: false, error: SAVE_FAILED })
        expect(logged).toHaveBeenCalled()
      } finally {
        logged.mockRestore()
      }
      expect(repositoryCalls()).toBe(0)
    })

    it(`${name} lets a student through`, async () => {
      session = student()
      expect(await call()).toEqual(expect.objectContaining({ ok: true }))
      expect(repositoryCalls()).toBe(1)
    })
  }
})

describe('once onboarding is closed', () => {
  const CLOSED = 'Onboarding is finished. Your roadmaps hold your answers now.'
  const roadmapWrites = [
    ['saveAnswersAction', saveAnswers, () => saveAnswersAction({ amount: 36 })],
    ['saveRelativeAction', saveRelative, () => saveRelativeAction(relative)],
    ['saveCoinsAction', saveCoins, () => saveCoinsAction(coins)],
  ] as const

  for (const [name, write, call] of roadmapWrites) {
    it(`${name} says onboarding is finished when nothing was written`, async () => {
      session = student()
      write.mockImplementation(async () => false)
      expect(await call()).toEqual({ ok: false, error: CLOSED })
    })
  }
})

describe('saveAnswersAction', () => {
  it("saves a stated answer to the session's own account and returns it", async () => {
    session = student()
    expect(await saveAnswersAction({ amount: 36 })).toEqual({
      ok: true,
      answers: { amount: { value: 36, state: 'stated' } },
    })
    expect(saveAnswers).toHaveBeenCalledWith(
      'student-1',
      { amount: { value: 36, state: 'stated' } },
      [],
    )
  })

  it('clears an answer saved as null: nothing set, the key handed over to clear', async () => {
    session = student()
    expect(await saveAnswersAction({ areas: null })).toEqual({ ok: true, answers: {} })
    expect(saveAnswers).toHaveBeenCalledWith('student-1', {}, ['areas'])
  })

  it('sets the answers that have a value and clears the ones that are null, in one save', async () => {
    session = student()
    expect(await saveAnswersAction({ amount: 36, areas: null })).toEqual({
      ok: true,
      answers: { amount: { value: 36, state: 'stated' } },
    })
    expect(saveAnswers).toHaveBeenCalledWith(
      'student-1',
      { amount: { value: 36, state: 'stated' } },
      ['areas'],
    )
  })

  it('saves "Not sure" as the default, assumed, and takes back a stored answer (Undo)', async () => {
    session = student()
    expect(
      await saveAnswersAction({ hard: 'Not sure', amount: { value: 30, state: 'assumed' } }),
    ).toEqual({
      ok: true,
      answers: {
        hard: { value: 'Roughly', state: 'assumed' },
        amount: { value: 30, state: 'assumed' },
      },
    })
  })

  it('refuses the whole patch when any answer is not an option, and saves nothing', async () => {
    session = student()
    for (const patch of [
      { amount: 37 },
      { nonsense: 1 },
      { nonsense: null },
      { amount: 36, nonsense: null },
      { amount: 36, dest: 'Canada' },
      { climate: 'Not sure' },
      null,
      ['amount', 36],
      'amount',
    ]) {
      expect(await saveAnswersAction(patch)).toEqual({ ok: false, error: INVALID })
    }
    expect(saveAnswers).not.toHaveBeenCalled()
  })

  it('says the save failed rather than throw, and logs the cause', async () => {
    session = student()
    const cause = new Error('connection refused')
    saveAnswers.mockImplementation(async () => {
      throw new Error('Failed query: … params: {"amount":…}', { cause })
    })
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await saveAnswersAction({ amount: 36 })).toEqual({ ok: false, error: SAVE_FAILED })
      expect(logged).toHaveBeenCalledWith('[opening.saveAnswers]', cause)
    } finally {
      logged.mockRestore()
    }
  })
})

describe('savePersonaAction', () => {
  it('saves one of the personas', async () => {
    session = student()
    expect(await savePersonaAction('neutral')).toEqual({ ok: true })
    expect(savePersona).toHaveBeenCalledWith('student-1', 'neutral')
  })

  it('refuses anything else', async () => {
    session = student()
    expect(await savePersonaAction('robot')).toEqual({ ok: false, error: INVALID })
    expect(await savePersonaAction(undefined)).toEqual({ ok: false, error: INVALID })
    expect(savePersona).not.toHaveBeenCalled()
  })
})

describe('saveRelativeAction', () => {
  it('saves a relative, trimmed, or no relative', async () => {
    session = student()
    expect(await saveRelativeAction({ ...relative, name: ' Asha ' })).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenCalledWith('student-1', relative)
    expect(await saveRelativeAction(null)).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenLastCalledWith('student-1', null)
  })

  it('saves a person with only a relationship, or only a place', async () => {
    session = student()
    const cousin = { placeId: null, place: null, relationship: 'Cousin', name: null }
    expect(await saveRelativeAction(cousin)).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenLastCalledWith('student-1', cousin)
    const placed = { placeId: 'cannington', place: 'Cannington', relationship: null, name: null }
    expect(await saveRelativeAction(placed)).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenLastCalledWith('student-1', placed)
  })

  it('saves "Somewhere else" with nothing typed yet as a person', async () => {
    session = student()
    const elsewhere = { placeId: null, place: '', relationship: null, name: null }
    expect(await saveRelativeAction(elsewhere)).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenLastCalledWith('student-1', elsewhere)
  })

  it('saves a person whose every part is blank as no person', async () => {
    session = student()
    const blank = { placeId: null, place: null, relationship: null, name: null }
    expect(await saveRelativeAction(blank)).toEqual({ ok: true })
    expect(saveRelative).toHaveBeenLastCalledWith('student-1', null)
  })

  it('refuses a name over 40 characters', async () => {
    session = student()
    expect(await saveRelativeAction({ ...relative, name: 'a'.repeat(41) })).toEqual({
      ok: false,
      error: INVALID,
    })
    expect(saveRelative).not.toHaveBeenCalled()
  })

  it('refuses a relationship outside the list', async () => {
    session = student()
    expect(await saveRelativeAction({ ...relative, relationship: 'Neighbour' })).toEqual({
      ok: false,
      error: INVALID,
    })
    expect(await saveRelativeAction(undefined)).toEqual({ ok: false, error: INVALID })
    expect(saveRelative).not.toHaveBeenCalled()
  })
})

describe('saveCoinsAction', () => {
  it('saves ten coins, or coins left for later', async () => {
    session = student()
    expect(await saveCoinsAction(coins)).toEqual({ ok: true })
    expect(saveCoins).toHaveBeenCalledWith('student-1', coins)
    expect(await saveCoinsAction({ state: 'later' })).toEqual({ ok: true })
  })

  it('refuses piles that sum to nine', async () => {
    session = student()
    expect(
      await saveCoinsAction({ state: 'spent', piles: [2, 1, 1, 1, 1, 1, 1, 1], assumed: false }),
    ).toEqual({ ok: false, error: INVALID })
    expect(saveCoins).not.toHaveBeenCalled()
  })
})
