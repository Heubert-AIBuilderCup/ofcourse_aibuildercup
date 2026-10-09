/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ReactNode } from 'react'
import type { ActionResult } from '@/shared/types/action-result'
import type { StoredAnswers } from '@/shared/types/student'
import type { QuestionStep } from '../model/onboarding'
import { OnboardingAnswersProvider } from '../model/onboarding-answers'

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

const { QuestionScreen } = await import('./QuestionScreen')

// happy-dom starts on about:blank, which cannot be a base for a relative URL.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/onboarding/facts/where'))
afterAll(() => dom.setURL(startUrl))

const pushState = spyOn(window.history, 'pushState').mockImplementation(() => {})
const replaceState = spyOn(window.history, 'replaceState').mockImplementation(() => {})

afterEach(() => {
  cleanup()
  saveAnswersAction.mockReset()
  saveAnswersAction.mockImplementation(saved)
  push.mockClear()
  pushState.mockClear()
  replaceState.mockClear()
})

const IDLE =
  "“Not sure” is a fine answer. Skip, and I'll assume a sensible default you can change later."
const FAILED =
  "We couldn't save that. Your answer is still here. Check your connection and try again."
const LEAVE = "Leave the rest for now: go to What you'd study"
const NEXT = "Next: What you'd study"
const STUDY_LEAVE = "Leave the rest for now: go to Where and how you'd live"
const STUDY_NEXT = "Next: Where and how you'd live"

const STEP_PATHS: Record<QuestionStep, string> = { 1: '/onboarding/facts', 2: '/onboarding/study' }

/** The step's screen with her answers in the shell's provider, as the (shell) layout gives them. */
const view = (step: QuestionStep, answers: StoredAnswers) => (
  <OnboardingAnswersProvider answers={answers}>
    <QuestionScreen step={step} relative={null} saveAnswersAction={saveAnswersAction} />
  </OnboardingAnswersProvider>
)

/** Step 01's screen at a question's URL, named by its slug as the address bar shows it. */
function screenAt(slug: string, answers: StoredAnswers = {}) {
  pathname = `${STEP_PATHS[1]}/${slug}`
  return render(view(1, answers))
}

/** Step 02's screen at a question's URL. */
function studyAt(slug: string, answers: StoredAnswers = {}) {
  pathname = `${STEP_PATHS[2]}/${slug}`
  return render(view(2, answers))
}

const rerenderAt = (rerender: (ui: ReactNode) => void, slug: string) => {
  pathname = `${STEP_PATHS[1]}/${slug}`
  rerender(view(1, {}))
}

const know = (value: string): StoredAnswers => ({ know: { value, state: 'stated' } })

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
const check = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('checkbox', { name }))
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
  expect(screen.getByRole('link', { name: LEAVE })).toHaveAttribute(
    'href',
    '/onboarding/study/know',
  )
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
  expect(push).toHaveBeenCalledWith('/onboarding/study/know')
})

it("goes on to step 02's first open question", async () => {
  screenAt('english', know('Suggest me'))
  await press(NEXT)
  expect(push).toHaveBeenCalledWith('/onboarding/study/level')
})

it('saves a tap at once when she leaves before it was sent', async () => {
  screenAt('english')
  await tap('IELTS 6.5')
  await press(NEXT)
  expect(saveAnswersAction).toHaveBeenCalledWith({ eng: 'IELTS 6.5' })
  expect(push).toHaveBeenCalledWith('/onboarding/study/know')
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

// Step 02, "What you'd study": the same screen over step 02's questions.

const AREAS_IDLE =
  "Pick one, two or three. Skip, and I'll start wide, with every field in this preview."
const AREAS_SAVED = 'Saved. Tap an area again to remove it.'

it('asks the first study question, with its place, why it asks and the ways on', async () => {
  studyAt('know')
  expect(textOf("What you'd study · 1 of 4")).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Do you know what you want to study?' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'It sets how wide your futures start: one field, a few areas, or every field in this preview.',
    ),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toHaveLength(4)
  for (const name of ['Something particular', "A few areas I'm drawn to", 'Suggest me']) {
    expect(screen.getByRole('radio', { name })).toBeInTheDocument()
  }
  expect(screen.getAllByRole('radio')[3]).toHaveAccessibleName('Not sure')
  expect(screen.getByText(IDLE)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: STUDY_LEAVE })).toHaveAttribute(
    'href',
    '/onboarding/living',
  )
  await press('Back')
  expect(push).toHaveBeenCalledWith('/onboarding/facts/english')
  expect(pushState).not.toHaveBeenCalled()
})

it('counts the field once she knows something particular, and goes on to it', async () => {
  studyAt('know')
  await tap('Something particular')
  expect(textOf("What you'd study · 1 of 5")).toBeInTheDocument()
  expect(screen.getByText('Particular: pick the field.')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText('Saved. Tap another answer to change it.')).toBeInTheDocument(),
  )
  expect(saveAnswersAction).toHaveBeenCalledWith({ know: 'Something particular' })
  await press('Continue')
  expect(pushState).toHaveBeenCalledWith(null, '', '/onboarding/study/field')
})

it('asks for the field under its group, its line showing before any tap', async () => {
  studyAt('field', know('Something particular'))
  expect(textOf("What you'd study · 2 of 5")).toBeInTheDocument()
  const group = screen.getByText('Something particular')
  const heading = screen.getByRole('heading', { level: 1, name: 'Which field?' })
  expect(group.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('Particular: pick the field.')).toBeInTheDocument()
  await tap('Not sure')
  expect(
    screen.getByText("Not sure: I'll assume “any field” and show it as a chip you can change."),
  ).toBeInTheDocument()
})

it('opens her first open question in place of one not asked, replacing the URL once', () => {
  studyAt('field', know('Suggest me'))
  expect(screen.getByRole('heading', { level: 1, name: 'Study level' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 1, name: 'Which field?' })).toBeNull()
  expect(replaceState).toHaveBeenCalledTimes(1)
  expect(replaceState).toHaveBeenCalledWith(null, '', '/onboarding/study/level')
})

it('asks the areas from her tap on screen, before the server has it', () => {
  studyAt('areas', know("A few areas I'm drawn to"))
  expect(screen.getByRole('heading', { level: 1, name: 'Pick up to three' })).toBeInTheDocument()
  expect(replaceState).not.toHaveBeenCalled()
})

it('offers up to three areas as checkboxes, and clears them when she removes the last', async () => {
  studyAt('areas', know("A few areas I'm drawn to"))
  expect(screen.getByText("A few areas I'm drawn to")).toBeInTheDocument()
  const areas = screen.getByRole('group', { name: 'Pick up to three' })
  expect(within(areas).getAllByRole('checkbox')).toHaveLength(6)
  expect(screen.getByText(AREAS_IDLE)).toBeInTheDocument()
  expect(screen.getByText('Pick up to three areas.')).toBeInTheDocument()

  await check('Data')
  await waitFor(() => expect(screen.getByText(AREAS_SAVED)).toBeInTheDocument())
  expect(saveAnswersAction).toHaveBeenLastCalledWith({ areas: ['Data'] })
  expect(screen.getByText('Data: courses across them show side by side.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()

  await check('Data')
  await waitFor(() => expect(saveAnswersAction).toHaveBeenLastCalledWith({ areas: null }))
  expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  expect(screen.getByText('0 of 3 chosen')).toBeInTheDocument()
  expect(screen.getByText('Pick up to three areas.')).toBeInTheDocument()
})

it("goes on to step 03 from step 02's last question, with no way to leave the rest", async () => {
  studyAt('length', know('Suggest me'))
  expect(textOf("What you'd study · 4 of 4")).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: STUDY_LEAVE })).not.toBeInTheDocument()
  await press(STUDY_NEXT)
  expect(push).toHaveBeenCalledWith('/onboarding/living')
})
