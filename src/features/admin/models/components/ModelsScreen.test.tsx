/// <reference lib="dom" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { Tier, UseCase } from '@/features/content/ai/config'
import type { AiSettings, SettingChange } from '@/features/content/ai/settings'
import type { ActionResult } from '@/shared/types/action-result'
import type { StudentCallRow, TestResult } from '../test-call'
import { USE_CASES } from '../use-cases'
import { ModelsScreen, type ModelsScreenProps } from './ModelsScreen'

// Strings, counts and attributes only: a failing assertion that prints an element has sent
// `bun test` past 29 GB here (CLAUDE.md).

const ENV_MODELS: Record<Tier, string> = {
  lite: 'env-lite',
  flash: 'env-flash',
  pro: 'env-pro',
  image: 'env-image',
}

const DEFAULT_TIERS = Object.fromEntries(
  USE_CASES.map((u) => [u, u === 'art' ? 'image' : 'lite']),
) as Record<UseCase, Tier>

const NO_SETTINGS: AiSettings = { tierModels: {}, useCaseTiers: {}, failing: {} }

const passed: TestResult = { ok: true, model: 'gemini-3.5-flash-lite', ms: 812 }

const actions = {
  test: mock(
    async (_u: UseCase): Promise<ActionResult<{ result: TestResult }>> => ({
      ok: true,
      result: passed,
    }),
  ),
  testStudentCalls: mock(
    async (): Promise<ActionResult<{ rows: StudentCallRow[] }>> => ({
      ok: true,
      rows: [
        { label: 'why: course tile', ...passed },
        { label: 'ask: refusal', ok: false, model: 'env-lite', ms: 40, error: 'Too long.' },
      ],
    }),
  ),
  saveTierModel: mock(
    async (_t: Tier, _m: string): Promise<ActionResult<{ result: TestResult }>> => ({
      ok: true,
      result: passed,
    }),
  ),
  saveUseCaseTier: mock(async (_u: UseCase, _t: Tier): Promise<ActionResult> => ({ ok: true })),
  reset: mock(async (): Promise<ActionResult> => ({ ok: true })),
}

const props = (over: Partial<ModelsScreenProps> = {}): ModelsScreenProps => ({
  canManage: true,
  defaultTiers: DEFAULT_TIERS,
  envModels: ENV_MODELS,
  settings: NO_SETTINGS,
  changes: [],
  actions,
  ...over,
})

afterEach(() => {
  cleanup()
  for (const a of Object.values(actions)) a.mockClear()
})

const text = () => document.body.textContent ?? ''
const buttons = (label: string) =>
  [...document.querySelectorAll('button')].filter((b) => b.textContent === label)
const byLabel = <E extends Element>(selector: string, label: string): E => {
  const el = document.querySelector<E>(`${selector}[aria-label="${label}"]`)
  if (!el) throw new Error(`nothing labelled "${label}"`)
  return el
}
/** The text of the table row whose first cell reads `first`. */
const rowText = (first: string) =>
  [...document.querySelectorAll('tr')].find((tr) => tr.cells[0]?.textContent === first)
    ?.textContent ?? ''
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1
/** The blue band (marked light so it keeps its look in a dark page): its title and its numbers. */
const band = () => {
  const section = document.querySelector('section[data-theme="light"]')
  if (!section) throw new Error('no band')
  return {
    title: section.querySelector('h2')?.textContent ?? '',
    stats: [...(section.lastElementChild?.children ?? [])].map((s) => s.textContent ?? ''),
  }
}
/** The Last test cell of a use case's row. */
const lastTest = (useCase: string) => {
  const head = [...document.querySelectorAll('th')].findIndex(
    (th) => th.textContent === 'Last test',
  )
  const tr = [...document.querySelectorAll('tr')].find((r) => r.cells[0]?.textContent === useCase)
  return tr?.cells[head]?.textContent ?? ''
}

it('offers an admin who is not a superadmin no Test, Change or Reset', () => {
  render(<ModelsScreen {...props({ canManage: false })} />)
  expect(buttons('Test').length).toBe(0)
  expect(buttons('Change').length).toBe(0)
  expect(buttons('Reset to defaults').length).toBe(0)
  expect(buttons('Test all student calls').length).toBe(0)
  expect(document.querySelectorAll('select').length).toBe(0)
})

it('offers a superadmin a Test per use case, Change, Reset and Test all student calls', () => {
  render(<ModelsScreen {...props()} />)
  expect(buttons('Test').length).toBe(USE_CASES.length)
  expect(buttons('Change').length).toBeGreaterThan(4)
  expect(buttons('Reset to defaults').length).toBe(1)
  expect(buttons('Test all student calls').length).toBe(1)
})

it('lists each use case with the tier it runs on and that tier model, chosen or from the environment', () => {
  render(
    <ModelsScreen
      {...props({
        settings: {
          tierModels: { flash: 'gemini-3.8-flash' },
          useCaseTiers: { student_ask: 'flash' },
          failing: {},
        },
      })}
    />,
  )
  expect(rowText('student_ask')).toContain('Flash')
  expect(rowText('student_ask')).toContain('gemini-3.8-flash')
  expect(rowText('student_why')).toContain('Flash-Lite')
  expect(rowText('student_why')).toContain('env-lite')
  expect(rowText('art')).toContain('env-image')
  expect(rowText('Flash')).toContain('Page')
  expect(rowText('Flash-Lite')).toContain('Environment')
})

it('offers a student use case only Flash-Lite and Flash', () => {
  render(<ModelsScreen {...props()} />)
  const select = byLabel<HTMLSelectElement>('select', 'Tier for student_why')
  expect([...select.options].map((o) => o.value)).toEqual(['lite', 'flash'])
})

it('runs one Test on a use case and shows its result line', async () => {
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test extract'))
  })
  expect(actions.test).toHaveBeenCalledTimes(1)
  expect(actions.test.mock.calls[0]?.[0]).toBe('extract')
  expect(rowText('extract')).toContain('Passed on gemini-3.5-flash-lite in 812 ms')
})

it('while a Test runs, says it is one call that can take half a minute, its button waiting', async () => {
  let answer: (res: ActionResult<{ result: TestResult }>) => void = () => {}
  actions.test.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = resolve
      }),
  )
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test extract'))
  })
  try {
    expect([...document.querySelectorAll('[role="status"]')].map((s) => s.textContent)).toEqual([
      'Testing… one call, up to half a minute',
    ])
    expect(byLabel<HTMLButtonElement>('button', 'Test extract').disabled).toBe(true)
  } finally {
    // A transition left hanging would hold every later one in this file.
    await act(async () => answer({ ok: true, result: passed }))
  }
})

it('opens the band on "Not tested yet", every call untested, and each row not tested yet', () => {
  render(<ModelsScreen {...props()} />)
  expect(band().title).toBe('Not tested yet')
  expect(band().stats).toEqual([
    `${USE_CASES.length} AI calls`,
    '0 passed',
    '0 failed',
    `${USE_CASES.length} not tested yet`,
  ])
  expect(lastTest('extract')).toBe('Not tested yet')
  expect(lastTest('student_why')).toBe('Not tested yet')
})

it("counts a passed Test in the band and shows it in the row's Last test", async () => {
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test extract'))
  })
  expect(band().title).toBe('1 tested, all passed')
  expect(band().stats).toEqual([
    `${USE_CASES.length} AI calls`,
    '1 passed',
    '0 failed',
    `${USE_CASES.length - 1} not tested yet`,
  ])
  expect(lastTest('extract')).toBe('Passed on gemini-3.5-flash-lite in 812 ms')
  expect(lastTest('draft')).toBe('Not tested yet')
})

it('names the failures in the band once a Test fails', async () => {
  actions.test.mockImplementationOnce(async () => ({
    ok: true,
    result: { ok: false, model: 'env-lite', ms: 30, error: 'Model not found.' },
  }))
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test draft'))
  })
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test extract'))
  })
  expect(band().title).toBe('2 tested, 1 failed')
  expect(band().stats).toEqual([
    `${USE_CASES.length} AI calls`,
    '1 passed',
    '1 failed',
    `${USE_CASES.length - 2} not tested yet`,
  ])
  expect(lastTest('draft')).toBe('Failed on env-lite in 30 ms: Model not found.')
})

it('shows a failed Test with its model, time and error', async () => {
  actions.test.mockImplementationOnce(async () => ({
    ok: true,
    result: { ok: false, model: 'env-lite', ms: 30, error: 'Model not found.' },
  }))
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(byLabel('button', 'Test draft'))
  })
  expect(rowText('draft')).toContain('Failed on env-lite in 30 ms: Model not found.')
})

it('saves a chosen model through saveTierModel and shows the refusal when its test fails', async () => {
  const refusal = 'Not saved: the test on gemini-3.8-flash failed. Model not found.'
  actions.saveTierModel.mockImplementationOnce(async () => ({ ok: false, error: refusal }))
  render(<ModelsScreen {...props()} />)
  fireEvent.change(byLabel('select', 'Model for Flash'), { target: { value: 'gemini-3.8-flash' } })
  await act(async () => {
    fireEvent.click(byLabel('button', 'Change the Flash model'))
  })
  expect(actions.saveTierModel).toHaveBeenCalledTimes(1)
  expect(actions.saveTierModel.mock.calls[0]).toEqual(['flash', 'gemini-3.8-flash'])
  expect(text()).toContain(refusal)
})

it('saves a use case tier through saveUseCaseTier', async () => {
  render(<ModelsScreen {...props()} />)
  fireEvent.change(byLabel('select', 'Tier for student_why'), { target: { value: 'flash' } })
  await act(async () => {
    fireEvent.click(byLabel('button', 'Change the tier of student_why'))
  })
  expect(actions.saveUseCaseTier.mock.calls).toEqual([['student_why', 'flash']])
})

it('marks a failing tier as falling back, with its last error', () => {
  render(
    <ModelsScreen
      {...props({
        settings: {
          tierModels: { flash: 'gemini-3.8-flash', lite: 'gemini-3.5-flash-lite' },
          useCaseTiers: {},
          failing: { flash: { error: '404 model not found', at: '2026-10-16T08:00:00.000Z' } },
        },
      })}
    />,
  )
  expect(rowText('Flash')).toContain('Falling back to the default')
  expect(rowText('Flash')).toContain('404 model not found')
  expect(rowText('Flash-Lite')).not.toContain('Falling back')
  expect(count(text(), 'Falling back to the default')).toBe(1)
})

it('shows the saved choice again when the saved settings change, as after a reset or a save elsewhere', () => {
  const chosen: AiSettings = {
    tierModels: { flash: 'gemini-3.8-flash' },
    useCaseTiers: { student_why: 'flash' },
    failing: {},
  }
  const { rerender } = render(<ModelsScreen {...props({ settings: chosen })} />)
  const model = () => byLabel<HTMLSelectElement>('select', 'Model for Flash').value
  const tier = () => byLabel<HTMLSelectElement>('select', 'Tier for student_why').value
  const disabled = (label: string) => byLabel<HTMLButtonElement>('button', label).disabled
  expect([model(), tier()]).toEqual(['gemini-3.8-flash', 'flash'])

  // A pick stays while the saved value does.
  fireEvent.change(byLabel('select', 'Model for Flash'), {
    target: { value: 'gemini-3.5-flash-lite' },
  })
  rerender(<ModelsScreen {...props({ settings: { ...chosen } })} />)
  expect(model()).toBe('gemini-3.5-flash-lite')

  rerender(<ModelsScreen {...props()} />)
  expect([model(), tier()]).toEqual(['', 'lite'])
  expect(disabled('Change the Flash model')).toBe(true)
  expect(disabled('Change the tier of student_why')).toBe(true)
})

it('says the settings cannot be read and offers no Change or Reset, only the tests', () => {
  render(<ModelsScreen {...props({ unavailable: true })} />)
  expect(text()).toContain('The model settings cannot be read')
  expect(buttons('Change').length).toBe(0)
  expect(buttons('Reset to defaults').length).toBe(0)
  expect(document.querySelectorAll('select').length).toBe(0)
  expect(buttons('Test').length).toBe(USE_CASES.length)
  expect(buttons('Test all student calls').length).toBe(1)
})

it('asks for a confirmation before Reset', async () => {
  render(<ModelsScreen {...props()} />)
  fireEvent.click(buttons('Reset to defaults')[0] as HTMLButtonElement)
  expect(actions.reset).toHaveBeenCalledTimes(0)
  expect(text()).toContain("Every call runs on the environment's models again.")
  await act(async () => {
    fireEvent.click(buttons('Reset')[0] as HTMLButtonElement)
  })
  expect(actions.reset).toHaveBeenCalledTimes(1)
})

it('runs every student call once and shows one line each', async () => {
  render(<ModelsScreen {...props()} />)
  await act(async () => {
    fireEvent.click(buttons('Test all student calls')[0] as HTMLButtonElement)
  })
  expect(actions.testStudentCalls).toHaveBeenCalledTimes(1)
  expect(text()).toContain('why: course tile: Passed on gemini-3.5-flash-lite in 812 ms')
  expect(text()).toContain('ask: refusal: Failed on env-lite in 40 ms: Too long.')
})

it('names what each change was, who made it, and its old and new values', () => {
  const changes: SettingChange[] = [
    {
      key: 'reset',
      oldValue: 'tier:flash=gemini-3.8-flash',
      newValue: null,
      userName: 'Nikhil',
      at: '2026-10-16T09:12:00.000Z',
    },
    {
      key: 'usecase:student_ask',
      oldValue: null,
      newValue: 'flash',
      userName: null,
      at: '2026-10-16T08:00:00.000Z',
    },
  ]
  render(<ModelsScreen {...props({ changes })} />)
  expect(rowText('16 Oct 2026, 09:12')).toContain('Nikhil')
  expect(rowText('16 Oct 2026, 09:12')).toContain('Reset to defaults')
  expect(rowText('16 Oct 2026, 09:12')).toContain('tier:flash=gemini-3.8-flash')
  expect(rowText('16 Oct 2026, 08:00')).toContain('Tier of student_ask')
})
