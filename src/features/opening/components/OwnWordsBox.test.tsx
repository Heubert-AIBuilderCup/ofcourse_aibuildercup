/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ActionResult } from '@/shared/types/action-result'
import type { RoadmapTag, StoredAnswers } from '@/shared/types/student'
import type { OwnWordsChip } from '../model/own-words'
import { ownWordsPatch } from '../model/own-words-next'
import { OwnWordsBox, type ReadOwnWords } from './OwnWordsBox'

// Criteria 35, 36, 38, 39 and 42: the box on a step's first question, what a reading shows, and
// what "Use these" stores.

const FAILED = "I couldn't pick anything out; the questions below are the same"

const CHIPS: OwnWordsChip[] = [
  { key: 'where', value: 'Nepal', quote: 'I am in Kathmandu', needsTap: false, change: false },
  { key: 'amount', value: 30, quote: 'about 26 lakh', needsTap: true, change: false },
  { key: 'who', value: 'Loan', quote: 'a bank loan', needsTap: true, change: true },
]
const TAGS: RoadmapTag[] = []

type Reading = Awaited<ReturnType<ReadOwnWords>>
const reading = (r: Reading) => mock(async (_step: unknown, _text: unknown) => r)
const saveAnswers = mock(async (_patch: StoredAnswers): Promise<ActionResult> => ({ ok: true }))
const onDone = mock(() => {})

afterEach(() => {
  cleanup()
  saveAnswers.mockClear()
  onDone.mockClear()
})

function box(readAction: ReadOwnWords) {
  return render(
    <OwnWordsBox
      step="facts"
      answers={{}}
      readAction={readAction}
      saveAnswers={saveAnswers}
      onDone={onDone}
    />,
  )
}

async function readWords(text = 'I am in Kathmandu, about 26 lakh, a bank loan') {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Read my words' }))
}

const chipButton = (quote: string) =>
  screen.getByText(`“${quote}”`, { exact: false }).closest('button') as HTMLButtonElement

it('offers a text box whose button waits for some words', () => {
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  expect(screen.getByText('Tell me in your own words')).toBeInTheDocument()
  const read = screen.getByRole('button', { name: 'Read my words' })
  expect(read).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
  expect(read).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I am in Kathmandu' } })
  expect(read).toBeEnabled()
})

it('sends the step and her words to the reading', async () => {
  const action = reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false })
  box(action)
  await readWords('I am in Kathmandu')
  await waitFor(() => expect(action).toHaveBeenCalledWith('facts', 'I am in Kathmandu'))
})

it('shows each chip with her words; an ordinary one selected, one that needs a tap not', async () => {
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  await readWords()
  await screen.findByText('“I am in Kathmandu”', { exact: false })
  expect(chipButton('I am in Kathmandu')).toHaveAttribute('aria-pressed', 'true')
  const amount = chipButton('about 26 lakh')
  expect(amount).toHaveAttribute('aria-pressed', 'false')
  expect(within(amount).getByText('Tap to use')).toBeInTheDocument()
})

it('says what a change chip would change', async () => {
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  await readWords()
  await screen.findByText('“a bank loan”', { exact: false })
  expect(within(chipButton('a bank loan')).getByText(/Would change your answer/)).toBeTruthy()
  expect(within(chipButton('I am in Kathmandu')).queryByText(/Would change/)).toBeNull()
})

it('"Use these" saves the chips she kept, once, then moves on', async () => {
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  await readWords()
  await screen.findByText('“about 26 lakh”', { exact: false })
  fireEvent.click(chipButton('about 26 lakh'))
  fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  expect(saveAnswers).toHaveBeenCalledTimes(1)
  expect(saveAnswers).toHaveBeenCalledWith(ownWordsPatch(CHIPS, new Set([0, 1]), {}))
})

it('a chip tapped off is not saved', async () => {
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  await readWords()
  await screen.findByText('“I am in Kathmandu”', { exact: false })
  fireEvent.click(chipButton('I am in Kathmandu'))
  fireEvent.click(chipButton('a bank loan'))
  fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  expect(saveAnswers).toHaveBeenCalledWith({ who: { value: 'Loan', state: 'stated' } })
})

it('a refused save keeps the chips and does not move on', async () => {
  saveAnswers.mockImplementationOnce(async () => ({ ok: false, error: 'No' }))
  box(reading({ ok: true, chips: CHIPS, tags: TAGS, failed: false }))
  await readWords()
  await screen.findByText('“I am in Kathmandu”', { exact: false })
  fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
  await waitFor(() => expect(saveAnswers).toHaveBeenCalledTimes(1))
  expect(onDone).not.toHaveBeenCalled()
  expect(chipButton('I am in Kathmandu')).toBeInTheDocument()
})

it('a failed reading says so and shows no chips', async () => {
  box(reading({ ok: true, chips: [], tags: [], failed: true }))
  await readWords()
  expect(await screen.findByText(FAILED)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Use these' })).toBeNull()
})

it('a refused reading says the same', async () => {
  box(reading({ ok: false, error: 'Onboarding is finished.' }))
  await readWords()
  expect(await screen.findByText(FAILED)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Use these' })).toBeNull()
})

it('a reading that never arrives says the same', async () => {
  box(
    mock(async () => {
      throw new Error('offline')
    }),
  )
  await readWords()
  expect(await screen.findByText(FAILED)).toBeInTheDocument()
})

it('"Use these" judges what her answers ask with the answers she has', async () => {
  const chips: OwnWordsChip[] = [
    { key: 'know', value: 'Suggest me', quote: 'I want', needsTap: true, change: true },
    { key: 'field', value: 'Data science', quote: 'data science', needsTap: false, change: false },
  ]
  render(
    <OwnWordsBox
      step="study"
      answers={{ know: { value: 'Something particular', state: 'stated' } }}
      readAction={reading({ ok: true, chips, tags: [], failed: false })}
      saveAnswers={saveAnswers}
      onDone={onDone}
    />,
  )
  await readWords('I want data science')
  await screen.findByText('“data science”', { exact: false })
  fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  expect(saveAnswers).toHaveBeenCalledWith({
    field: { value: 'Data science', state: 'stated' },
  })
})

it('shows a kept tag as the words she wrote, not the note read from them', async () => {
  const tags: RoadmapTag[] = [
    { text: 'Feels depressed', quote: 'a bit stressed', step: 'facts', wellbeing: true },
  ]
  box(reading({ ok: true, chips: CHIPS, tags, failed: false }))
  await readWords()
  expect(await screen.findByText('“a bit stressed”')).toBeInTheDocument()
  expect(screen.queryByText('Feels depressed')).toBeNull()
})

it('says it is reading while it waits, and is busy', async () => {
  box(mock(() => new Promise<Reading>(() => {})))
  await readWords()
  expect(await screen.findByRole('button', { name: 'Reading…' })).toBeDisabled()
  expect(screen.getByRole('region', { name: 'Tell me in your own words' })).toHaveAttribute(
    'aria-busy',
    'true',
  )
})
