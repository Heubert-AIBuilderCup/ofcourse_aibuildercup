/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
// The loader through its hook (useLoaderRun): the order the work runs in, the least time a step
// stays, the fade before it goes, failure and Try again, the slow note and what it announces.

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LOADER_STEPS } from '../model/loader'
import { RoadmapLoader } from './RoadmapLoader'

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/onboarding/done'))
afterAll(() => dom.setURL(startUrl))

beforeEach(() => {
  jest.useFakeTimers()
})
const realMatchMedia = window.matchMedia
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  window.matchMedia = realMatchMedia
})

/** She asked for reduced motion. */
const reduceMotion = () => {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

type Work = () => Promise<void>
const instant = () => mock<Work>(async () => {})

/** A step's work that waits until the test lets it finish or fail. */
function held() {
  let resolve: () => void = () => {}
  let reject: (error: Error) => void = () => {}
  const work = mock<Work>(
    () =>
      new Promise<void>((yes, no) => {
        resolve = yes
        reject = no
      }),
  )
  return {
    work,
    finish: () => act(async () => resolve()),
    fail: () => act(async () => reject(new Error('generation failed'))),
  }
}

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms)
  })

function load(work: Work[], kind: 'first' | 'new' = 'first') {
  const onDone = mock(() => {})
  render(<RoadmapLoader kind={kind} work={work} onDone={onDone} />)
  return onDone
}

const states = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-state'))
const status = () => screen.getByRole('status')
const SLOW = 'Still working. This can take a little longer.'
const ERROR = "We couldn't draw your roadmap. Your answers are saved."

describe('the run', () => {
  it("shows its kind's three steps, the first working", async () => {
    load([instant(), instant(), instant()], 'new')
    await act(async () => {})
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([...LOADER_STEPS.new])
    expect(states()).toEqual(['now', 'next', 'next'])
  })

  it('holds a step 0.7 s even when its work finishes at once, then starts the next', async () => {
    const work = [instant(), instant(), instant()]
    load(work)
    await act(async () => {})
    expect(work[0]).toHaveBeenCalledTimes(1)
    expect(work[1]).not.toHaveBeenCalled()
    await advance(699)
    expect(states()).toEqual(['now', 'next', 'next'])
    await advance(1)
    expect(states()).toEqual(['done', 'now', 'next'])
    expect(work[1]).toHaveBeenCalledTimes(1)
    expect(work[2]).not.toHaveBeenCalled()
  })

  it('ticks a step when its work finishes, when that is later than 0.7 s', async () => {
    const first = held()
    load([first.work, instant(), instant()])
    await advance(1500)
    expect(states()).toEqual(['now', 'next', 'next'])
    await first.finish()
    expect(states()).toEqual(['done', 'now', 'next'])
  })

  it('once all three are done, fades for 0.45 s and only then is done', async () => {
    const onDone = load([instant(), instant(), instant()])
    await advance(700)
    await advance(700)
    await advance(700)
    expect(states()).toEqual(['done', 'done', 'done'])
    await advance(449)
    expect(onDone).not.toHaveBeenCalled()
    await advance(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('under reduced motion, is done as the last step ticks, with no pause for a fade', async () => {
    reduceMotion()
    const onDone = load([instant(), instant(), instant()])
    await advance(700)
    await advance(700)
    expect(onDone).not.toHaveBeenCalled()
    await advance(700)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe('when a step fails', () => {
  it('marks it bad, says so, and Try again runs again from that step', async () => {
    const second = held()
    const work = [instant(), second.work, instant()]
    const onDone = load(work)
    await advance(700)
    await second.fail()
    expect(states()).toEqual(['done', 'bad', 'next'])
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR)
    expect(work[2]).not.toHaveBeenCalled()

    second.work.mockImplementation(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(states()).toEqual(['done', 'now', 'next'])
    expect(work[0]).toHaveBeenCalledTimes(1)
    expect(second.work).toHaveBeenCalledTimes(2)
    await advance(700)
    await advance(700)
    await advance(450)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('names this roadmap when it was a new one', async () => {
    const first = held()
    load([first.work, instant(), instant()], 'new')
    await first.fail()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't draw this roadmap. Your answers are saved.",
    )
  })
})

describe('what it says', () => {
  it('says it is still working after 10 s with a step still running', async () => {
    const first = held()
    load([first.work, instant(), instant()])
    await advance(9999)
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument()
    await advance(1)
    expect(screen.getByText(SLOW)).toBeInTheDocument()
    await first.finish()
    await advance(700)
    await advance(700)
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument()
  })

  it('does not call itself slow when it finishes in time', async () => {
    load([instant(), instant(), instant()])
    await advance(700)
    await advance(700)
    await advance(700)
    await advance(10000)
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument()
  })

  it('announces each step politely as it becomes the one working', async () => {
    load([instant(), instant(), instant()])
    await act(async () => {})
    expect(status()).toHaveAttribute('aria-live', 'polite')
    const [first, second, third] = LOADER_STEPS.first
    expect(status().textContent).toBe(first)
    await advance(700)
    expect(status().textContent).toBe(second)
    await advance(700)
    expect(status().textContent).toBe(third)
  })
})

describe('where focus is', () => {
  it('takes focus to its status as it opens, so it never drops to the page', async () => {
    load([instant(), instant(), instant()])
    await act(async () => {})
    expect(status()).toHaveAttribute('tabindex', '-1')
    expect(status()).toHaveFocus()
  })

  it('moves focus to Try again when a step fails', async () => {
    const first = held()
    load([first.work, instant(), instant()])
    await first.fail()
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
  })
})
