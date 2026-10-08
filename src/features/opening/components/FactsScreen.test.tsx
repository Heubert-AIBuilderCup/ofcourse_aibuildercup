/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ReactNode } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { StoredAnswers } from '@/shared/types/student'

const saved = async (_patch: unknown): Promise<ActionResult> => ({ ok: true })
const saveAnswersAction = mock(saved)

let pathname = '/onboarding/facts/where'
const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
  usePathname: () => pathname,
}))
mock.module('@/shared/lib/auth/client', () => ({ signOut: mock(async () => {}) }))

const { FactsScreen } = await import('./FactsScreen')

// happy-dom starts on about:blank, which cannot be a base for a relative URL.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/onboarding/facts/where'))
afterAll(() => dom.setURL(startUrl))

const pushState = spyOn(window.history, 'pushState').mockImplementation(() => {})

afterEach(() => {
  cleanup()
  saveAnswersAction.mockReset()
  saveAnswersAction.mockImplementation(saved)
  push.mockClear()
  pushState.mockClear()
})

const IDLE =
  "“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later."
const FAILED =
  "We couldn't save that. Your answer is still here. Check your connection and try again."
const LEAVE = "Leave the rest for now: go to What you'd study"
const NEXT = "Next: What you'd study"

/** The screen at a question's URL, named by its slug as the address bar shows it. */
function screenAt(slug: string, answers: StoredAnswers = {}) {
  pathname = `/onboarding/facts/${slug}`
  const view = (
    <FactsScreen answers={answers} relative={null} saveAnswersAction={saveAnswersAction} />
  )
  return render(view)
}

const rerenderAt = (rerender: (ui: ReactNode) => void, slug: string) => {
  pathname = `/onboarding/facts/${slug}`
  rerender(<FactsScreen answers={{}} relative={null} saveAnswersAction={saveAnswersAction} />)
}

/** Text that runs across elements, matched on the innermost element holding all of it. */
const textOf = (text: string) =>
  screen.getByText(
    (_, el) =>
      el?.textContent === text && ![...el.children].some((child) => child.textContent === text),
  )

const tap = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('radio', { name }))
  })
const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })

it('asks one question, with its place, its group, why it asks and the ways on', () => {
  screenAt('amount')
  expect(textOf('Facts about you · 2 of 11')).toBeInTheDocument()
  expect(screen.getByText('Your budget per year')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Amount' })).toBeInTheDocument()
  expect(
    screen.getByText('It decides which cities stay open on each route. A rough number is fine.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Amount' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: LEAVE })).toHaveAttribute('href', '/onboarding/study')
  // Sign out lives in the shell's header menu now, not on the step.
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  expect(screen.getByText(IDLE)).toBeInTheDocument()
  expect(screen.queryByText(/a year/)).not.toBeInTheDocument()
})

it('shows what a tap does at once, then saves it', async () => {
  screenAt('amount')
  await tap('AUD 36k')
  expect(
    screen.getByText("About AUD 36k a year. Tell me if it's a hard limit."),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  expect(screen.getByText('Saving…')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText('Saved. Tap another answer to change it.')).toBeInTheDocument(),
  )
  expect(saveAnswersAction).toHaveBeenCalledWith({ amount: 36 })
})

it('says what "Not sure" assumes', async () => {
  screenAt('amount')
  await tap('Not sure')
  expect(
    screen.getByText("Not sure: I'll assume “AUD 30k” and show it as a chip you can change."),
  ).toBeInTheDocument()
})

it('says family is not covered yet for a partner, with no follow-up form', async () => {
  screenAt('coming')
  await tap('Partner')
  expect(
    screen.getByText(
      "Family isn't covered in this preview yet, so every route shows costs for you alone.",
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('tags a line drawn from the mock preview apart from its text', () => {
  screenAt('latest', { latest: { value: 'Jul 2027', state: 'stated' } })
  const tag = screen.getByText('mock')
  expect(tag.children).toHaveLength(0)
  expect(screen.getByText('Latest Jul 2027: 5 intakes open')).toBeInTheDocument()
  expect(screen.queryByText(/ · mock$/)).not.toBeInTheDocument()
})

it('goes back to step 00 from the first question', async () => {
  screenAt('where')
  await press('Back')
  expect(push).toHaveBeenCalledWith('/onboarding/character')
  expect(pushState).not.toHaveBeenCalled()
})

it('goes back a question in place', async () => {
  screenAt('amount')
  await press('Back')
  expect(pushState).toHaveBeenCalledWith(null, '', '/onboarding/facts/where')
  expect(push).not.toHaveBeenCalled()
})

it('continues to the next question after a tap', async () => {
  screenAt('amount')
  await tap('AUD 36k')
  await press('Continue')
  expect(pushState).toHaveBeenCalledWith(null, '', '/onboarding/facts/covers')
})

it('skips to the next question, storing nothing', async () => {
  screenAt('amount')
  await press('Skip')
  expect(pushState).toHaveBeenCalledWith(null, '', '/onboarding/facts/covers')
  await act(() => new Promise((r) => setTimeout(r, 400)))
  expect(saveAnswersAction).not.toHaveBeenCalled()
})

it('goes on to step 02 from the last question, with no way to leave the rest', async () => {
  screenAt('english')
  expect(screen.queryByRole('link', { name: LEAVE })).not.toBeInTheDocument()
  await press(NEXT)
  expect(push).toHaveBeenCalledWith('/onboarding/study')
})

it('saves a tap at once when she leaves before it was sent', async () => {
  screenAt('english')
  await tap('IELTS 6.5')
  await press(NEXT)
  expect(saveAnswersAction).toHaveBeenCalledWith({ eng: 'IELTS 6.5' })
  expect(push).toHaveBeenCalledWith('/onboarding/study')
})

it('keeps her answer and offers to try again when the save is refused', async () => {
  saveAnswersAction.mockImplementation(async () => ({ ok: false, error: 'x' }))
  screenAt('amount')
  await tap('AUD 36k')
  expect(await screen.findByRole('alert')).toHaveTextContent(FAILED)
  expect(screen.getByRole('radio', { name: 'AUD 36k' })).toHaveAttribute('aria-checked', 'true')
  expect(saveAnswersAction).toHaveBeenCalledTimes(1)
  await press('Try again')
  expect(saveAnswersAction).toHaveBeenCalledTimes(2)
  expect(saveAnswersAction).toHaveBeenLastCalledWith({ amount: 36 })
})

it('moves focus to the new question', async () => {
  const { rerender } = screenAt('amount')
  await tap('AUD 36k')
  await press('Continue')
  act(() => rerenderAt(rerender, 'covers'))
  const heading = screen.getByRole('heading', { level: 1, name: 'It covers' })
  expect(document.activeElement).toBe(heading)
})
