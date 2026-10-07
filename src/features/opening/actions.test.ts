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

const saveAnswers = mock(async (_userId: string, _patch: unknown) => {})
const savePersona = mock(async (_userId: string, _persona: unknown) => {})
const saveRelative = mock(async (_userId: string, _relative: unknown) => {})
const saveCoins = mock(async (_userId: string, _coins: unknown) => {})
const addReminder = mock(async (_userId: string, _reminder: unknown) => {})
const repository = { saveAnswers, savePersona, saveRelative, saveCoins, addReminder }
mock.module('./server/profile', () => repository)

const {
  addReminderAction,
  saveAnswersAction,
  saveCoinsAction,
  savePersonaAction,
  saveRelativeAction,
} = await import('./actions')

const SIGN_IN = 'Please sign in again.'
const NOT_AUTHORISED = 'Not authorised.'
const INVALID = "That answer isn't one of the options."
const SAVE_FAILED = 'Could not save. Please try again.'

const relative = { placeId: 'perth', place: 'Perth', relationship: 'Cousin', name: 'Asha' }
const coins = { state: 'spent', piles: [2, 2, 1, 1, 1, 1, 1, 1], assumed: false }
const reminder = { futureId: 'career', courseId: 'uts-cyber' }
/** uts-cyber's keep-options-open action in the catalogue. */
const UTS_DEFER = 'Ask UTS whether you can defer a year'

// Every action, called with input that is valid, so only the caller decides the outcome.
const calls = [
  ['saveAnswersAction', () => saveAnswersAction({ amount: 36 })],
  ['savePersonaAction', () => savePersonaAction('female')],
  ['saveRelativeAction', () => saveRelativeAction(relative)],
  ['saveCoinsAction', () => saveCoinsAction(coins)],
  ['addReminderAction', () => addReminderAction(reminder)],
] as const

const repositoryCalls = () => Object.values(repository).reduce((n, f) => n + f.mock.calls.length, 0)

afterEach(() => {
  session = null
  sessionError = null
  for (const f of Object.values(repository)) {
    f.mockReset()
    f.mockImplementation(async () => {})
  }
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

describe('saveAnswersAction', () => {
  it("saves a stated answer to the session's own account and returns it", async () => {
    session = student()
    expect(await saveAnswersAction({ amount: 36 })).toEqual({
      ok: true,
      answers: { amount: { value: 36, state: 'stated' } },
    })
    expect(saveAnswers).toHaveBeenCalledWith('student-1', {
      amount: { value: 36, state: 'stated' },
    })
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

describe('addReminderAction', () => {
  it("stores the reminder with the course's own action and the time it was set on the server", async () => {
    session = student()
    const before = Date.now()
    expect(await addReminderAction(reminder)).toEqual({ ok: true })
    const [userId, stored] = addReminder.mock.calls[0] as [string, Record<string, unknown>]
    expect(userId).toBe('student-1')
    expect(Object.keys(stored).sort()).toEqual(['at', 'courseId', 'futureId', 'text'])
    expect(stored).toMatchObject({ ...reminder, text: UTS_DEFER })
    const at = stored.at as string
    expect(new Date(at).toISOString()).toBe(at)
    expect(Date.parse(at)).toBeGreaterThanOrEqual(before)
  })

  it('takes only the future and the course: any other field is refused', async () => {
    session = student()
    for (const extra of [
      { text: 'Anything the browser likes' },
      { at: '1999-01-01T00:00:00.000Z' },
      { userId: 'other' },
    ]) {
      expect(await addReminderAction({ ...reminder, ...extra })).toEqual({
        ok: false,
        error: INVALID,
      })
    }
    expect(addReminder).not.toHaveBeenCalled()
  })

  it('refuses a course that is not in the catalogue', async () => {
    session = student()
    expect(await addReminderAction({ ...reminder, courseId: 'no-such-course' })).toEqual({
      ok: false,
      error: INVALID,
    })
    expect(await addReminderAction({ ...reminder, courseId: 'toString' })).toEqual({
      ok: false,
      error: INVALID,
    })
    expect(addReminder).not.toHaveBeenCalled()
  })

  it('refuses a future that is not one of the three', async () => {
    session = student()
    expect(await addReminderAction({ ...reminder, futureId: 'luck' })).toEqual({
      ok: false,
      error: INVALID,
    })
    expect(addReminder).not.toHaveBeenCalled()
  })
})
