/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'

const finished = async (): Promise<ActionResult> => ({ ok: true })
const finishOnboardingAction = mock(finished)

const push = mock((_: string) => {})
const replace = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace, refresh: () => {}, back: () => {} }),
}))

const { DoneScreen } = await import('./DoneScreen')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

afterEach(() => {
  cleanup()
  finishOnboardingAction.mockReset()
  finishOnboardingAction.mockImplementation(finished)
  push.mockClear()
  replace.mockClear()
})

const GO = 'Go to your road'
const FAILED = "We couldn't save that. Try again."

const go = () => screen.getByRole('button', { name: GO })
const press = () =>
  act(async () => {
    fireEvent.click(go())
  })

/** A finish that waits until the test lets it answer. */
function heldFinish() {
  let answer: (result: ActionResult) => void = () => {}
  finishOnboardingAction.mockImplementation(
    () =>
      new Promise<ActionResult>((resolve) => {
        answer = resolve
      }),
  )
  return (result: ActionResult) => act(async () => answer(result))
}

it('offers one action, Go to your road, and no way back to Your attention', () => {
  render(<DoneScreen spent finishOnboardingAction={finishOnboardingAction} />)
  const actions = [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')]
  expect(actions).toEqual([go()])
  expect(screen.queryByText('Back to Your attention')).not.toBeInTheDocument()
})

it('records that she finished, then replaces this screen with her road', async () => {
  render(<DoneScreen spent finishOnboardingAction={finishOnboardingAction} />)
  await press()
  expect(finishOnboardingAction).toHaveBeenCalledTimes(1)
  expect(replace).toHaveBeenCalledWith('/road')
  expect(push).not.toHaveBeenCalled()
})

it('is unavailable and busy while it waits, and sends once however often she presses', async () => {
  const answer = heldFinish()
  render(<DoneScreen spent={false} finishOnboardingAction={finishOnboardingAction} />)
  await press()
  expect(go()).toHaveAttribute('aria-disabled', 'true')
  expect(go()).toHaveAttribute('aria-busy', 'true')
  await press()
  expect(finishOnboardingAction).toHaveBeenCalledTimes(1)
  expect(replace).not.toHaveBeenCalled()
  await answer({ ok: true })
  expect(replace).toHaveBeenCalledWith('/road')
})

it('stays when the save is refused, says so, and can be pressed again', async () => {
  const answer = heldFinish()
  render(<DoneScreen spent finishOnboardingAction={finishOnboardingAction} />)
  expect(screen.queryByText(FAILED)).not.toBeInTheDocument()
  await press()
  await answer({ ok: false, error: 'Could not save. Please try again.' })
  expect(replace).not.toHaveBeenCalled()
  expect(screen.getByText(FAILED)).toBeInTheDocument()
  expect(go()).not.toHaveAttribute('aria-disabled', 'true')

  finishOnboardingAction.mockImplementation(finished)
  await press()
  expect(finishOnboardingAction).toHaveBeenCalledTimes(2)
  expect(replace).toHaveBeenCalledWith('/road')
})

it('says the same when the save never reaches the server', async () => {
  finishOnboardingAction.mockImplementation(async () => {
    throw new Error('Failed to fetch')
  })
  render(<DoneScreen spent finishOnboardingAction={finishOnboardingAction} />)
  await press()
  expect(screen.getByText(FAILED)).toBeInTheDocument()
  expect(replace).not.toHaveBeenCalled()
})
