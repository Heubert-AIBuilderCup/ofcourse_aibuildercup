/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Toaster } from 'sonner'
import type { ActionResult } from '@/shared/types/action-result'
import type { StoredAnswers } from '@/shared/types/student'
import { notSureLine } from '../model/impact'
import { SCREENS } from '../model/questions'
import { OpeningScreen } from './OpeningScreen'

const saved = async (_: unknown): Promise<ActionResult> => ({ ok: true })
const saveAnswersAction = mock(saved)

afterEach(() => {
  cleanup()
  saveAnswersAction.mockReset()
  saveAnswersAction.mockImplementation(saved)
})

const [FACTS, , , AFTER] = SCREENS

function show(screenIndex: 0 | 3, answers: StoredAnswers = {}) {
  return render(
    <OpeningScreen
      screen={SCREENS[screenIndex]}
      answers={answers}
      saveAnswersAction={saveAnswersAction}
    />,
  )
}

/** A save that never answers: whatever a tap shows, it shows without the server. */
const unanswered = () => new Promise<never>(() => {})

const group = (name: string) => screen.getByRole('group', { name })
const button = (groupName: string, option: string) =>
  within(group(groupName)).getByRole('button', { name: option })
/** A tap, its save settled. */
const tap = (groupName: string, option: string) =>
  act(async () => {
    fireEvent.click(button(groupName, option))
  })

it('heads screen 1 with its title and the first of six steps', () => {
  show(0)
  expect(screen.getByRole('heading', { level: 1, name: 'Facts about you' })).toBeInTheDocument()
  expect(screen.getByText('Getting started · step 1 of 6')).toBeInTheDocument()
  expect(screen.getByText(FACTS.sub)).toBeInTheDocument()
  expect(screen.getByLabelText('Step 1 of 6')).toBeInTheDocument()
})

it('asks every question on screen 1', () => {
  show(0)
  expect(screen.getByLabelText('Where are you right now?')).toBeInTheDocument()
  for (const name of [
    'Amount',
    'It covers',
    'Who pays',
    'Is this a hard limit, or roughly?',
    'Earliest start',
    "Latest you'd accept",
    "Most years you'd give it",
    'Anyone coming with you?',
    'Last qualification',
    'English test',
  ]) {
    expect(group(name)).toBeInTheDocument()
  }
})

it('shows the impact of an amount the moment it is pressed, before any reply, and saves it', () => {
  saveAnswersAction.mockImplementation(unanswered)
  show(0)
  fireEvent.click(button('Amount', 'AUD 36k'))
  expect(
    screen.getByText("About AUD 36k a year. Tell me if it's a hard limit."),
  ).toBeInTheDocument()
  expect(within(group('Amount')).getByRole('button', { name: 'AUD 36k' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(saveAnswersAction).toHaveBeenCalledWith({ amount: 36 })
})

it('says what "Not sure" assumes', async () => {
  show(0)
  await tap('Amount', 'Not sure')
  expect(screen.getByText(notSureLine('amount'))).toBeInTheDocument()
  expect(within(group('Amount')).getByRole('button', { name: 'Not sure' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(saveAnswersAction).toHaveBeenCalledWith({ amount: 'Not sure' })
})

it('tells onshore from offshore in where she is now', () => {
  saveAnswersAction.mockImplementation(unanswered)
  show(0)
  const where = screen.getByLabelText('Where are you right now?')
  expect(within(where).getByRole('option', { name: 'Not sure' })).toBeInTheDocument()
  fireEvent.change(where, { target: { value: 'Australia (on a visa)' } })
  expect(screen.getByText(/onshore/)).toBeInTheDocument()
  expect(saveAnswersAction).toHaveBeenCalledWith({ where: 'Australia (on a visa)' })
  fireEvent.change(where, { target: { value: 'Nepal' } })
  expect(screen.getByText('Nepal: visa required · study fees apply')).toBeInTheDocument()
  expect(screen.queryByText(/onshore/)).not.toBeInTheDocument()
})

it('says family is not covered yet for a partner, with no follow-up form', async () => {
  show(0)
  await tap('Anyone coming with you?', 'Partner')
  expect(
    screen.getByText(
      "Family isn't covered in this preview yet, so every route shows costs for you alone.",
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(saveAnswersAction).toHaveBeenCalledWith({ dep: 'Partner' })
})

it('shows the answers she left, as she left them', () => {
  show(0, { amount: { value: 36, state: 'stated' } })
  expect(within(group('Amount')).getByRole('button', { name: 'AUD 36k' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(
    screen.getByText("About AUD 36k a year. Tell me if it's a hard limit."),
  ).toBeInTheDocument()
})

it('keeps the answer and says so when the save is refused', async () => {
  saveAnswersAction.mockImplementation(async () => ({
    ok: false,
    error: 'Please sign in again.',
  }))
  render(
    <>
      <Toaster />
      <OpeningScreen screen={FACTS} answers={{}} saveAnswersAction={saveAnswersAction} />
    </>,
  )
  await tap('Anyone coming with you?', 'Partner')
  expect(await screen.findByText('Please sign in again.')).toBeInTheDocument()
  expect(
    within(group('Anyone coming with you?')).getByRole('button', { name: 'Partner' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

it('asks about staying with yes, not sure and no', () => {
  show(3)
  const stay = within(group('Would you want to stay after?'))
  expect(stay.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Yes',
    'Not sure',
    'No',
  ])
})

it('links back to the screen before and on to the next', () => {
  show(0)
  expect(screen.getByRole('link', { name: FACTS.next })).toHaveAttribute(
    'href',
    '/onboarding/study',
  )
  cleanup()

  show(3)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
    'href',
    '/onboarding/living/climate',
  )
  expect(screen.getByRole('link', { name: 'Show me three futures' })).toHaveAttribute(
    'href',
    '/futures',
  )
  expect(AFTER.next).toBe('Show me three futures')
  expect(
    screen.getByText(
      '“Not sure” is fine anywhere. It becomes an assumption you can correct on each future.',
    ),
  ).toBeInTheDocument()
})
