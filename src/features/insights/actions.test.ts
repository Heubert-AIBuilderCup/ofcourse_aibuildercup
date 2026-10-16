// The redraw action with the session and the recorder mocked: who is refused, what is validated,
// and what reaches the recorder. The recorder itself is proven against the database in
// ./server/views.test.ts.

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { PATHS } from '@/features/content/lib/path-facts'

type FakeUser = { id: string; role: string | null; editor?: boolean; reviewer?: boolean }
let session: { user: FakeUser } | null = null

/** Set to make the session lookup itself fail, as a database error would. */
let sessionError: Error | null = null
mock.module('@/shared/lib/auth/session', () => ({
  getSession: async () => {
    if (sessionError) throw sessionError
    return session
  },
}))
mock.module('server-only', () => ({}))

// The rest of the module stays real: bun's module mocks last for the process, and the other
// insights tests read `courseIdsShown` from it.
const views = await import('./server/views')
const recordFuturesShown = mock(
  async (_userId: string, _result: unknown, _options: { redraw?: boolean }) => {},
)
mock.module('./server/views', () => ({ ...views, recordFuturesShown }))

const { recordRedrawAction } = await import('./actions')

const [ONE, TWO] = PATHS.map((path) => path.id)
const SIGN_IN = 'Please sign in again.'
const NOT_AUTHORISED = 'Not authorised.'
const INVALID = 'That is not a futures result.'
const FAILED = 'Could not record the futures shown.'

/** A futures result as the engine gives it, with fields the recorder does not keep. */
const futures = {
  kind: 'futures',
  weights: { cost: 3 },
  futures: [
    {
      id: 'cost',
      heading: 'Built around cost',
      courseId: ONE,
      route: 'Somewhere',
      strongOn: ['cost'],
      costsOn: ['pr'],
      lines: [{ text: 'a line' }],
    },
  ],
  notices: [],
}

afterEach(() => {
  session = null
  sessionError = null
  recordFuturesShown.mockReset()
  recordFuturesShown.mockImplementation(async () => {})
})

describe('who may record a redraw', () => {
  it('asks a signed-out caller to sign in again and records nothing', async () => {
    expect(await recordRedrawAction(futures)).toEqual({ ok: false, error: SIGN_IN })
    expect(recordFuturesShown).not.toHaveBeenCalled()
  })

  it('refuses staff: an admin, a superadmin, an editor, a reviewer and an account with no role', async () => {
    const staff: FakeUser[] = [
      { id: 'staff-1', role: 'admin' },
      { id: 'staff-2', role: 'superadmin' },
      { id: 'staff-3', role: 'user', editor: true },
      { id: 'staff-4', role: 'user', reviewer: true },
      { id: 'staff-5', role: null },
    ]
    for (const user of staff) {
      session = { user }
      expect(await recordRedrawAction(futures)).toEqual({ ok: false, error: NOT_AUTHORISED })
    }
    expect(recordFuturesShown).not.toHaveBeenCalled()
  })

  it('says so, without throwing, when the session cannot be read', async () => {
    sessionError = new Error('ac-db-down')
    const error = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await recordRedrawAction(futures)).toEqual({ ok: false, error: FAILED })
      expect(error).toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })
})

describe('what a student records', () => {
  it('records the futures as a redraw with only the fields kept, under her session id', async () => {
    session = { user: { id: 'student-1', role: 'user' } }
    expect(await recordRedrawAction(futures)).toEqual({ ok: true })
    expect(recordFuturesShown).toHaveBeenCalledWith(
      'student-1',
      {
        kind: 'futures',
        futures: [{ id: 'cost', courseId: ONE, strongOn: ['cost'], costsOn: ['pr'] }],
      },
      { redraw: true },
    )
  })

  it('records a sealed result with how far over budget each route was', async () => {
    session = { user: { id: 'student-1', role: 'user' } }
    const sealed = {
      kind: 'sealed',
      budgetK: 30,
      nearest: [
        { courseId: ONE, route: 'A', overByK: 4 },
        { courseId: TWO, route: 'B', overByK: 9 },
      ],
    }
    expect(await recordRedrawAction(sealed)).toEqual({ ok: true })
    expect(recordFuturesShown).toHaveBeenCalledWith(
      'student-1',
      {
        kind: 'sealed',
        nearest: [
          { courseId: ONE, overByK: 4 },
          { courseId: TWO, overByK: 9 },
        ],
      },
      { redraw: true },
    )
  })

  it('refuses a malformed result and records nothing', async () => {
    session = { user: { id: 'student-1', role: 'user' } }
    const future = futures.futures[0]
    const malformed: unknown[] = [
      null,
      'futures',
      { kind: 'other', futures: [] },
      { kind: 'futures' },
      { ...futures, futures: [{ ...future, id: 'cheapest' }] },
      { ...futures, futures: [{ ...future, strongOn: ['luck'] }] },
      { ...futures, futures: [{ ...future, courseId: 'x'.repeat(200) }] },
      { ...futures, futures: [future, future, future, future] },
      { ...futures, futures: [{ ...future, costsOn: Array(7).fill('cost') }] },
      { kind: 'sealed', nearest: [{ courseId: ONE, overByK: 'four' }] },
      { kind: 'sealed', nearest: Array(4).fill({ courseId: ONE, overByK: 4 }) },
    ]
    for (const result of malformed) {
      expect(await recordRedrawAction(result)).toEqual({ ok: false, error: INVALID })
    }
    expect(recordFuturesShown).not.toHaveBeenCalled()
  })
})
