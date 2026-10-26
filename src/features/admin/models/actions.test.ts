// The Models page's actions with the session, the test calls and the settings writes mocked: who
// is refused (criteria 91, 92), what may be saved (94, 95) and the reset (97). The writes
// themselves are proven against the database in src/features/content/ai/settings.test.ts, the
// test calls in ./test-call.test.ts.

import { afterEach, describe, expect, it, mock } from 'bun:test'
import * as nextCache from 'next/cache'
import type { Tier, UseCase } from '@/features/content/ai/config'
import type { StudentCallRow, TestResult, TierOverride } from './test-call'

type FakeUser = { id: string; role: string | null; editor?: boolean; reviewer?: boolean }
let session: { user: FakeUser } | null = null

mock.module('@/shared/lib/auth/session', () => ({
  getSession: async () => session,
}))
mock.module('server-only', () => ({}))
// Next's other exports kept, so a later test file that mocks another one still finds it.
mock.module('next/cache', () => ({ ...nextCache, revalidatePath: () => {} }))

// The rest of each module stays real: bun's module mocks last for the process.
const PASSED: TestResult = { ok: true, model: 'm', ms: 5 }
const testUseCase = mock(
  async (_useCase: UseCase, _override?: TierOverride): Promise<TestResult> => PASSED,
)
const testStudentCalls = mock(async (): Promise<StudentCallRow[]> => [])
const testCall = await import('./test-call')
mock.module('./test-call', () => ({ ...testCall, testUseCase, testStudentCalls }))

const saveTierModel = mock(async (_userId: string, _tier: Tier, _model: string) => {})
const saveUseCaseTier = mock(async (_userId: string, _useCase: UseCase, _tier: Tier) => {})
const resetAll = mock(async (_userId: string) => {})
const settings = await import('@/features/content/ai/settings')
mock.module('@/features/content/ai/settings', () => ({
  ...settings,
  saveTierModel,
  saveUseCaseTier,
  resetAll,
}))

const {
  resetAction,
  saveTierModelAction,
  saveUseCaseTierAction,
  testAction,
  testStudentCallsAction,
} = await import('./actions')

const SIGN_IN = 'Please sign in again.'
const NOT_AUTHORISED = 'Not authorised.'
const SUPERADMIN: FakeUser = { id: 'super-1', role: 'superadmin' }

/** Every action, called with input a superadmin's would pass. */
const EVERY_ACTION = {
  testAction: () => testAction('extract'),
  testStudentCallsAction: () => testStudentCallsAction(),
  saveTierModelAction: () => saveTierModelAction('flash', 'gemini-3.8-flash'),
  saveUseCaseTierAction: () => saveUseCaseTierAction('extract', 'lite'),
  resetAction: () => resetAction(),
}

const writesAndCalls = () =>
  [testUseCase, testStudentCalls, saveTierModel, saveUseCaseTier, resetAll].reduce(
    (n, m) => n + m.mock.calls.length,
    0,
  )

afterEach(() => {
  session = null
  for (const m of [testUseCase, testStudentCalls, saveTierModel, saveUseCaseTier, resetAll]) {
    m.mockClear()
  }
  testUseCase.mockImplementation(async () => PASSED)
})

describe('who may use the Models page’s actions', () => {
  it('asks a signed-out visitor to sign in, and calls or saves nothing (criterion 91)', async () => {
    for (const [name, run] of Object.entries(EVERY_ACTION)) {
      expect([name, await run()]).toEqual([name, { ok: false, error: SIGN_IN }])
    }
    expect(writesAndCalls()).toBe(0)
  })

  it('refuses a student, an editor and a reviewer (criterion 91)', async () => {
    const students: FakeUser[] = [
      { id: 's-1', role: 'user' },
      { id: 's-2', role: 'user', editor: true },
      { id: 's-3', role: 'user', reviewer: true },
      { id: 's-4', role: null },
    ]
    for (const user of students) {
      session = { user }
      for (const [name, run] of Object.entries(EVERY_ACTION)) {
        expect([name, await run()]).toEqual([name, { ok: false, error: NOT_AUTHORISED }])
      }
    }
    expect(writesAndCalls()).toBe(0)
  })

  it('refuses an admin who is not a superadmin every test, change and reset (criterion 92)', async () => {
    session = { user: { id: 'admin-1', role: 'admin' } }
    for (const [name, run] of Object.entries(EVERY_ACTION)) {
      expect([name, await run()]).toEqual([name, { ok: false, error: NOT_AUTHORISED }])
    }
    expect(writesAndCalls()).toBe(0)
  })
})

describe('testAction', () => {
  it('tests a known use case and returns its result', async () => {
    session = { user: SUPERADMIN }
    expect(await testAction('student_why')).toEqual({ ok: true, result: PASSED })
    expect(testUseCase.mock.calls).toEqual([['student_why']])
  })

  it('refuses a use case it does not know, without a call', async () => {
    session = { user: SUPERADMIN }
    for (const bad of ['nope', '', 42, null, { useCase: 'extract' }]) {
      expect((await testAction(bad)).ok).toBe(false)
    }
    expect(testUseCase).not.toHaveBeenCalled()
  })

  it('says so, without throwing, when the test itself throws', async () => {
    session = { user: SUPERADMIN }
    testUseCase.mockImplementation(async () => {
      throw new Error('db down')
    })
    const error = console.error
    console.error = () => {}
    try {
      const res = await testAction('extract')
      expect(res.ok).toBe(false)
    } finally {
      console.error = error
    }
  })
})

describe('testStudentCallsAction', () => {
  it('runs the student calls and returns one row each', async () => {
    session = { user: SUPERADMIN }
    const rows: StudentCallRow[] = [{ label: 'why-course', ok: true, model: 'm', ms: 3 }]
    testStudentCalls.mockImplementation(async () => rows)
    expect(await testStudentCallsAction()).toEqual({ ok: true, rows })
  })
})

describe('saveTierModelAction (criterion 94)', () => {
  it('refuses a model not on the known list, or not for that tier, before any call', async () => {
    session = { user: SUPERADMIN }
    for (const [tier, model] of [
      ['flash', 'gemini-3.8-flash-preview'],
      ['flash', 'gemini-3.1-pro-preview'],
      ['pro', 'gemini-3.8-flash'],
      ['nope', 'gemini-3.8-flash'],
      ['flash', 42],
    ] as const) {
      expect((await saveTierModelAction(tier, model)).ok).toBe(false)
    }
    expect(testUseCase).not.toHaveBeenCalled()
    expect(saveTierModel).not.toHaveBeenCalled()
  })

  it('tests the new model on its tier, then saves it under the superadmin', async () => {
    session = { user: SUPERADMIN }
    const res = await saveTierModelAction('pro', 'gemini-3.1-pro-preview')
    expect(res.ok).toBe(true)
    expect(testUseCase).toHaveBeenCalledTimes(1)
    const [useCase, override] = testUseCase.mock.calls[0]
    expect(override).toEqual({ tier: 'pro', model: 'gemini-3.1-pro-preview' })
    expect(useCase === 'art' || useCase.startsWith('student_')).toBe(false)
    expect(saveTierModel.mock.calls).toEqual([['super-1', 'pro', 'gemini-3.1-pro-preview']])
  })

  it('tests an image model on art', async () => {
    session = { user: SUPERADMIN }
    await saveTierModelAction('image', 'gemini-nano-banana-2.1')
    expect(testUseCase.mock.calls).toEqual([
      ['art', { tier: 'image', model: 'gemini-nano-banana-2.1' }],
    ])
  })

  it('does not save when the test fails, and says why', async () => {
    session = { user: SUPERADMIN }
    testUseCase.mockImplementation(async () => ({
      ok: false,
      model: 'gemini-3.8-flash',
      ms: 9,
      error: 'Publisher model not found',
    }))
    const res = await saveTierModelAction('flash', 'gemini-3.8-flash')
    expect(res.ok).toBe(false)
    expect(res.ok ? '' : res.error).toContain('Publisher model not found')
    expect(saveTierModel).not.toHaveBeenCalled()
  })
})

describe('saveUseCaseTierAction (criterion 95)', () => {
  it('refuses a tier the use case does not allow', async () => {
    session = { user: SUPERADMIN }
    for (const [useCase, tier] of [
      ['student_why', 'pro'],
      ['student_ask', 'image'],
      ['art', 'flash'],
      ['suggest_sources', 'lite'],
      ['extract', 'image'],
      ['nope', 'lite'],
      ['extract', 'ultra'],
    ] as const) {
      expect((await saveUseCaseTierAction(useCase, tier)).ok).toBe(false)
    }
    expect(saveUseCaseTier).not.toHaveBeenCalled()
  })

  it('saves an allowed tier under the superadmin', async () => {
    session = { user: SUPERADMIN }
    expect(await saveUseCaseTierAction('student_ask', 'flash')).toEqual({ ok: true })
    expect(await saveUseCaseTierAction('extract', 'pro')).toEqual({ ok: true })
    expect(saveUseCaseTier.mock.calls).toEqual([
      ['super-1', 'student_ask', 'flash'],
      ['super-1', 'extract', 'pro'],
    ])
  })
})

describe('resetAction (criterion 97)', () => {
  it('clears every choice under the superadmin', async () => {
    session = { user: SUPERADMIN }
    expect(await resetAction()).toEqual({ ok: true })
    expect(resetAll.mock.calls).toEqual([['super-1']])
  })

  it('says so, without throwing, when the reset fails', async () => {
    session = { user: SUPERADMIN }
    resetAll.mockImplementationOnce(async () => {
      throw new Error('db down')
    })
    const error = console.error
    console.error = () => {}
    try {
      expect((await resetAction()).ok).toBe(false)
    } finally {
      console.error = error
    }
  })
})
