/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Toaster } from 'sonner'
import type { ActionResult } from '@/shared/types/action-result'
import type { Relative, StoredAnswers } from '@/shared/types/student'
import { notSureLine } from '../model/impact'
import { SCREENS } from '../model/questions'
import { OpeningScreen } from './OpeningScreen'

const saved = async (_: unknown): Promise<ActionResult> => ({ ok: true })
const saveAnswersAction = mock(saved)
const saveRelativeAction = mock(saved)

afterEach(() => {
  cleanup()
  for (const action of [saveAnswersAction, saveRelativeAction]) {
    action.mockReset()
    action.mockImplementation(saved)
  }
})

const [FACTS, STUDY, LIVING, AFTER] = SCREENS

function show(
  screenIndex: 0 | 1 | 2 | 3,
  answers: StoredAnswers = {},
  relative: Relative | null = null,
) {
  return render(
    <OpeningScreen
      screen={SCREENS[screenIndex]}
      answers={answers}
      relative={relative}
      saveAnswersAction={saveAnswersAction}
      saveRelativeAction={saveRelativeAction}
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
/** A pick or a keystroke, its save settled. */
const change = (field: HTMLElement, value: string) =>
  act(async () => {
    fireEvent.change(field, { target: { value } })
  })

const COMMUNITY = 'Does a community of similar culture, or relatives nearby, matter?'
const KNOWS = 'Do you know anyone who lives in Australia?'

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
      <OpeningScreen
        screen={FACTS}
        answers={{}}
        relative={null}
        saveAnswersAction={saveAnswersAction}
        saveRelativeAction={saveRelativeAction}
      />
    </>,
  )
  await tap('Anyone coming with you?', 'Partner')
  expect(await screen.findByText('Please sign in again.')).toBeInTheDocument()
  expect(
    within(group('Anyone coming with you?')).getByRole('button', { name: 'Partner' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

it('offers up to three areas once she is drawn to a few', async () => {
  show(1)
  expect(screen.queryByRole('group', { name: 'Pick up to three' })).not.toBeInTheDocument()
  await tap('Do you know what you want to study?', "A few areas I'm drawn to")
  await tap('Pick up to three', 'IT and computing')
  await tap('Pick up to three', 'Business')
  await tap('Pick up to three', 'Data')
  expect(saveAnswersAction).toHaveBeenLastCalledWith({
    areas: ['IT and computing', 'Business', 'Data'],
  })
  expect(within(group('Pick up to three')).getByRole('button', { name: 'Health' })).toBeDisabled()
  await tap('Pick up to three', 'Business')
  expect(saveAnswersAction).toHaveBeenLastCalledWith({ areas: ['IT and computing', 'Data'] })
})

it('asks whether she knows anyone only once community matters, then who and where', async () => {
  show(2)
  expect(screen.queryByText(KNOWS)).not.toBeInTheDocument()
  await tap(COMMUNITY, 'A little')
  expect(screen.getByText(KNOWS)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Who, and where?' })).not.toBeInTheDocument()
  await tap(KNOWS, 'Yes')
  expect(screen.getByRole('heading', { name: 'Who, and where?' })).toBeInTheDocument()
  await tap(COMMUNITY, 'No')
  expect(screen.queryByText(KNOWS)).not.toBeInTheDocument()
})

it('saves her person once a place and a relationship are set, and the name on blur', async () => {
  show(2, { community: { value: 'A little', state: 'stated' } })
  await tap(KNOWS, 'Yes')
  await change(screen.getByLabelText('City or suburb'), 'cannington')
  expect(saveRelativeAction).not.toHaveBeenCalled()
  await tap("They're your…", 'Cousin')
  expect(saveRelativeAction).toHaveBeenLastCalledWith({
    placeId: 'cannington',
    place: 'Cannington',
    relationship: 'Cousin',
    name: null,
  })
  expect(screen.getByText(/^Your cousin in Cannington, Perth: /)).toBeInTheDocument()

  const name = screen.getByLabelText('Name (optional)')
  await change(name, ' Anjali ')
  expect(saveRelativeAction).toHaveBeenCalledTimes(1)
  await act(async () => {
    fireEvent.blur(name)
  })
  expect(saveRelativeAction).toHaveBeenLastCalledWith({
    placeId: 'cannington',
    place: 'Cannington',
    relationship: 'Cousin',
    name: 'Anjali',
  })
  expect(screen.getByText(/^Anjali in Cannington, Perth: /)).toBeInTheDocument()
})

it('takes a place outside the preview, typed', async () => {
  show(2, {
    community: { value: 'Yes', state: 'stated' },
    knows: { value: 'Yes', state: 'stated' },
  })
  const place = screen.getByLabelText('City or suburb')
  expect(within(place).getByRole('option', { name: 'Cannington, Perth' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Where?')).not.toBeInTheDocument()
  await change(place, 'elsewhere')
  await change(screen.getByLabelText('Where?'), 'Darwin')
  await tap("They're your…", 'Friend')
  expect(saveRelativeAction).toHaveBeenLastCalledWith({
    placeId: null,
    place: 'Darwin',
    relationship: 'Friend',
    name: null,
  })
})

it('forgets her person when she says she knows no one', async () => {
  const relative: Relative = {
    placeId: 'cannington',
    place: 'Cannington',
    relationship: 'Cousin',
    name: 'Anjali',
  }
  show(
    2,
    { community: { value: 'A little', state: 'stated' }, knows: { value: 'Yes', state: 'stated' } },
    relative,
  )
  expect(screen.getByLabelText('City or suburb')).toHaveValue('cannington')
  expect(screen.getByLabelText('Name (optional)')).toHaveValue('Anjali')
  await tap(KNOWS, 'No')
  expect(saveRelativeAction).toHaveBeenCalledWith(null)
  expect(screen.queryByRole('heading', { name: 'Who, and where?' })).not.toBeInTheDocument()
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

  show(1)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute(
    'href',
    '/onboarding/facts/english',
  )
  expect(screen.getByRole('link', { name: STUDY.next })).toHaveAttribute(
    'href',
    '/onboarding/living',
  )
  cleanup()

  show(2)
  expect(screen.getByRole('link', { name: LIVING.next })).toHaveAttribute(
    'href',
    '/onboarding/after',
  )
  cleanup()

  show(3)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/onboarding/living')
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
