/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'

const finished = async (): Promise<ActionResult<{ id: string }>> => ({ ok: true, id: 'rm-9' })
const finishOnboardingAction = mock(finished)
/** What the router and the server were asked, in order. */
const routed: string[] = []
const refreshed = async (): Promise<ActionResult> => {
  routed.push('refresh action')
  return { ok: true }
}
const refreshAfterOnboardingAction = mock(refreshed)
const push = mock((_: string) => {})
const replace = mock((to: string) => {
  routed.push(`replace ${to}`)
})
const refresh = mock(() => {
  routed.push('refresh')
})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace, refresh, back: () => {} }),
}))

const { DoneScreen } = await import('./DoneScreen')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  finishOnboardingAction.mockReset()
  finishOnboardingAction.mockImplementation(finished)
  refreshAfterOnboardingAction.mockReset()
  refreshAfterOnboardingAction.mockImplementation(refreshed)
  push.mockClear()
  replace.mockClear()
  refresh.mockClear()
  routed.length = 0
})

const GO = 'Go to your roadmaps'
const go = () => screen.getByRole('button', { name: GO })
const press = () =>
  act(async () => {
    fireEvent.click(go())
  })
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms)
  })
/** The three steps at their least, then the fade. */
const runThrough = async () => {
  await advance(700)
  await advance(700)
  await advance(700)
  await advance(450)
}

function show(count = 0) {
  render(
    <DoneScreen
      spent
      finished={count}
      finishOnboardingAction={finishOnboardingAction}
      refreshAfterOnboardingAction={refreshAfterOnboardingAction}
    />,
  )
}

it('offers one action, Go to your roadmaps, and no way back to Your attention', () => {
  show()
  const actions = [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')]
  expect(actions).toEqual([go()])
  expect(screen.queryByText('Back to Your attention')).not.toBeInTheDocument()
})

it('runs the loader over the end screen, which it hides', async () => {
  show(0)
  await press()
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  expect(screen.queryByRole('heading', { name: "You're all set" })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: GO })).not.toBeInTheDocument()
})

it('finishes the roadmap, then has the server refresh her router, then replaces this screen', async () => {
  show(0)
  await press()
  expect(finishOnboardingAction).toHaveBeenCalledTimes(1)
  await advance(700)
  await advance(700)
  await advance(700)
  // Still fading: nothing has sent her on yet.
  expect(routed).toEqual([])
  await advance(450)
  // The whole router is refreshed first, so Back from her roadmaps never shows a cached
  // onboarding page; the client's own refresh would clear this route only.
  expect(routed).toEqual(['refresh action', 'replace /roadmaps'])
  expect(refresh).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
})

it('replaces this screen only once the refresh has answered', async () => {
  let answer: (result: ActionResult) => void = () => {}
  refreshAfterOnboardingAction.mockImplementation(
    () => new Promise<ActionResult>((resolve) => (answer = resolve)),
  )
  show(0)
  await press()
  await runThrough()
  expect(refreshAfterOnboardingAction).toHaveBeenCalledTimes(1)
  expect(replace).not.toHaveBeenCalled()
  await act(async () => answer({ ok: true }))
  expect(replace).toHaveBeenCalledWith('/roadmaps')
})

it('still takes her to her roadmaps when the refresh cannot reach the server', async () => {
  refreshAfterOnboardingAction.mockImplementation(async () => {
    throw new Error('Failed to fetch')
  })
  show(0)
  await press()
  await runThrough()
  expect(replace).toHaveBeenCalledWith('/roadmaps')
})

it('lands with the new one marked when she has a roadmap already', async () => {
  show(1)
  await press()
  await runThrough()
  expect(routed).toEqual(['refresh action', 'replace /roadmaps?made=rm-9'])
})

it('fails the first step when the finish is refused, and Try again finishes it', async () => {
  finishOnboardingAction.mockImplementation(async () => ({
    ok: false,
    error: 'Place your coins, or leave them for later, first.',
  }))
  show(0)
  await press()
  expect(screen.getByRole('alert')).toHaveTextContent(
    "We couldn't draw your roadmap. Your answers are saved.",
  )
  await runThrough()
  expect(refreshAfterOnboardingAction).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()

  finishOnboardingAction.mockImplementation(finished)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  })
  await runThrough()
  expect(finishOnboardingAction).toHaveBeenCalledTimes(2)
  expect(replace).toHaveBeenCalledWith('/roadmaps')
})

it('fails the first step the same when the finish never reaches the server', async () => {
  finishOnboardingAction.mockImplementation(async () => {
    throw new Error('Failed to fetch')
  })
  show(0)
  await press()
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(replace).not.toHaveBeenCalled()
})
