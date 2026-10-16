/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import type { Persona } from '@/shared/types/student'

const saved = async (_persona: unknown): Promise<ActionResult> => ({ ok: true })
const savePersonaAction = mock(saved)

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { PictureQuestion } = await import('./PictureQuestion')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

afterEach(() => {
  cleanup()
  savePersonaAction.mockReset()
  savePersonaAction.mockImplementation(saved)
  push.mockClear()
})

const QUESTION = 'How would you like your comic character drawn?'
const OPTIONAL =
  "Optional. Skip, and we'll draw a neutral character. We never guess this from your name or photo."
const CLEAR = 'Press your choice again to clear it.'
const FAILED =
  "We couldn't save that. Your answer is still here. Check your connection and try again."

const renderQuestion = (persona: Persona | null = null) =>
  render(<PictureQuestion savePersonaAction={savePersonaAction} persona={persona} />)

const choice = (name: string) =>
  within(screen.getByRole('group', { name: QUESTION })).getByRole('button', { name })

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })

/** A save that waits until the test lets it answer. */
function heldSave() {
  let answer: (result: ActionResult) => void = () => {}
  savePersonaAction.mockImplementation(
    () =>
      new Promise<ActionResult>((resolve) => {
        answer = resolve
      }),
  )
  return (result: ActionResult) => act(async () => answer(result))
}

it('asks the question with three choices, none pressed, and says why', () => {
  renderQuestion()
  expect(screen.getByRole('heading', { level: 1, name: QUESTION })).toBeInTheDocument()
  expect(
    screen.getByText(
      (_, el) =>
        el?.tagName === 'P' &&
        el.textContent ===
          'Later, short comics walk through each route with one student in them. This only sets how that student is drawn. Nothing else reads your answer.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('This only sets how that student is drawn.').tagName).toBe('STRONG')
  for (const name of ['Male', 'Female', 'Prefer not to say']) {
    expect(choice(name)).toHaveAttribute('aria-pressed', 'false')
  }
  expect(screen.getByText(OPTIONAL)).toBeInTheDocument()
  expect(screen.queryByText(/Settings/)).not.toBeInTheDocument()
})

it('opens on its kicker, not a greeting (the welcome greets her), with focus on the question', () => {
  renderQuestion()
  expect(screen.getByText('Your comic character ·', { exact: false })).toBeInTheDocument()
  expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument()
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: QUESTION }))
})

it('comes back (Back from screen 1) with her saved choice pressed, and saves a change', async () => {
  renderQuestion('female')
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(CLEAR)).toBeInTheDocument()
  await press('Male')
  await press('Continue')
  expect(savePersonaAction).toHaveBeenCalledWith('male')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
})

it('comes back with nothing pressed after a neutral answer, since Skip saves the same', () => {
  renderQuestion('neutral')
  for (const name of ['Male', 'Female', 'Prefer not to say']) {
    expect(choice(name)).toHaveAttribute('aria-pressed', 'false')
  }
  expect(screen.getByText(OPTIONAL)).toBeInTheDocument()
})

it('saves neutral when Start is pressed with nothing chosen, then opens screen 1 at once', async () => {
  renderQuestion()
  await press('Continue')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
  expect(screen.queryByText(/You're in/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Saved\./)).not.toBeInTheDocument()
})

it('saves female for Female', async () => {
  renderQuestion()
  await press('Female')
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'true')
  await press('Continue')
  expect(savePersonaAction).toHaveBeenCalledWith('female')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
})

it('saves neutral for "Prefer not to say"', async () => {
  renderQuestion()
  await press('Prefer not to say')
  await press('Continue')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
})

it('saves neutral on Skip, whatever was pressed', async () => {
  renderQuestion()
  await press('Male')
  await press('Skip')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
})

it('keeps one choice at a time, and pressing the chosen one again clears it', async () => {
  renderQuestion()
  await press('Male')
  await press('Female')
  expect(choice('Male')).toHaveAttribute('aria-pressed', 'false')
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'true')
  await press('Female')
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'false')
})

it('says how to clear a choice while one is chosen', async () => {
  renderQuestion()
  await press('Male')
  expect(screen.getByText(CLEAR)).toBeInTheDocument()
  expect(screen.queryByText(OPTIONAL)).not.toBeInTheDocument()
  await press('Male')
  expect(screen.getByText(OPTIONAL)).toBeInTheDocument()
  expect(screen.queryByText(CLEAR)).not.toBeInTheDocument()
})

it('says it is saving and holds the choices and a second Start while it saves', async () => {
  const answer = heldSave()
  renderQuestion()
  await press('Female')
  await press('Continue')
  const start = screen.getByRole('button', { name: 'Saving…' })
  expect(start).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Saving your answer')
  expect(choice('Male')).toHaveAttribute('aria-disabled', 'true')

  await act(async () => {
    fireEvent.click(start)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(choice('Male'))
  })
  expect(savePersonaAction).toHaveBeenCalledTimes(1)
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'true')

  await answer({ ok: true })
  expect(push).toHaveBeenCalledTimes(1)
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
})

it('keeps her answer and offers to try again when the save is refused', async () => {
  savePersonaAction.mockImplementation(async () => ({ ok: false, error: 'Please sign in again.' }))
  renderQuestion()
  await press('Female')
  await press('Continue')
  expect(screen.getByRole('alert')).toHaveTextContent(FAILED)
  expect(choice('Female')).toHaveAttribute('aria-pressed', 'true')
  expect(choice('Male')).not.toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('button', { name: 'Try again' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(push).not.toHaveBeenCalled()

  savePersonaAction.mockImplementation(saved)
  await press('Try again')
  expect(savePersonaAction).toHaveBeenLastCalledWith('female')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/where')
})

it('keeps her answer and offers to try again when the save never reaches the server', async () => {
  savePersonaAction.mockImplementation(async () => {
    throw new Error('offline')
  })
  renderQuestion()
  await press('Male')
  await press('Continue')
  expect(screen.getByRole('alert')).toHaveTextContent(FAILED)
  expect(choice('Male')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(push).not.toHaveBeenCalled()
})
