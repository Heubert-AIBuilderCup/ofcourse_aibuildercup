/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnswerValue, StoredAnswer } from '@/shared/types/student'
import { questionOf } from '../model/questions'
import { AreaChecks } from './AreaChecks'

afterEach(cleanup)

const onAnswer = mock((_raw: AnswerValue | null) => {})
afterEach(() => onAnswer.mockClear())

const AREAS = [
  'IT and computing',
  'Business',
  'Health',
  'Engineering',
  'Design',
  'Psychology',
  'Education / Teaching',
  'Social work',
  'Hospitality & tourism',
]
const REFUSAL = "Three is the most for now. Tap one you've chosen to make room."
const NOTE = 'Nearest field used for now'

const stated = (value: AnswerValue): StoredAnswer => ({ value, state: 'stated' })

function renderChecks(answer?: StoredAnswer, borrowed?: readonly string[]) {
  return render(
    <>
      <h1 id="q">Pick up to three</h1>
      <AreaChecks
        question={questionOf('areas')}
        labelledBy="q"
        answer={answer}
        onAnswer={onAnswer}
        borrowed={borrowed}
      />
    </>,
  )
}

/** The card for an area: its name is the area, plus the note where it has one. */
const box = (area: string) =>
  screen.getAllByRole('checkbox').find((b) => b.textContent?.startsWith(area)) as HTMLElement

it('is a group named by its question, with the nine areas as checkboxes in model order', () => {
  renderChecks()
  expect(screen.getByRole('group', { name: 'Pick up to three' })).toBeInTheDocument()
  const boxes = screen.getAllByRole('checkbox')
  expect(boxes.map((b) => b.textContent?.replace(NOTE, ''))).toEqual(AREAS)
  expect(boxes.map((b) => b.tabIndex)).toEqual(AREAS.map(() => 0))
  expect(screen.queryByText('Not sure')).toBeNull()
})

it('reads nothing chosen when nothing is stored, or when the stored value is not a 1–3 list', () => {
  const first = renderChecks()
  expect(screen.getByText('0 of 3 chosen')).toBeInTheDocument()
  first.unmount()
  for (const value of ['Psychology', ['IT and computing', 'Business', 'Psychology', 'Health']]) {
    const view = renderChecks(stated(value))
    expect(screen.getByText('0 of 3 chosen')).toBeInTheDocument()
    for (const b of screen.getAllByRole('checkbox')) {
      expect(b).toHaveAttribute('aria-checked', 'false')
    }
    view.unmount()
  }
})

it('checks the stored areas and counts them, the count describing the group', () => {
  renderChecks(stated(['IT and computing', 'Psychology']))
  expect(box('IT and computing')).toHaveAttribute('aria-checked', 'true')
  expect(box('Psychology')).toHaveAttribute('aria-checked', 'true')
  expect(box('Business')).toHaveAttribute('aria-checked', 'false')
  const count = screen.getByText('2 of 3 chosen')
  expect(count.closest('[aria-live="polite"]')).not.toBeNull()
  expect(screen.getByRole('group')).toHaveAccessibleDescription('2 of 3 chosen')
})

it('adds a tapped area at the end', () => {
  renderChecks(stated(['IT and computing', 'Psychology']))
  fireEvent.click(box('Business'))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith(['IT and computing', 'Psychology', 'Business'])
})

it('removes a tapped area that is checked', () => {
  renderChecks(stated(['IT and computing', 'Psychology']))
  fireEvent.click(box('Psychology'))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith(['IT and computing'])
})

it('reports a clear when she removes the last area', () => {
  renderChecks(stated(['Psychology']))
  fireEvent.click(box('Psychology'))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith(null)
})

it('refuses a fourth area calmly, marks the rest full, and lets go when she makes room', () => {
  renderChecks(stated(['IT and computing', 'Psychology', 'Health']))
  expect(screen.getByText('3 of 3 chosen')).toBeInTheDocument()
  expect(screen.queryByText(REFUSAL)).toBeNull()
  for (const area of ['Business', 'Engineering', 'Design']) {
    expect(box(area)).toHaveAttribute('data-full')
    expect(box(area)).not.toBeDisabled()
  }
  expect(box('Psychology')).not.toHaveAttribute('data-full')

  // The live region is on the page before the refusal, so a screen reader hears the text arrive.
  const live = screen.getByRole('status')
  expect(live).toHaveAttribute('aria-live', 'polite')
  expect(live).toBeEmptyDOMElement()

  fireEvent.click(box('Business'))
  expect(onAnswer).not.toHaveBeenCalled()
  expect(box('Business')).toHaveAttribute('aria-checked', 'false')
  expect(screen.getByRole('status')).toBe(live)
  expect(live).toHaveTextContent(REFUSAL)

  fireEvent.click(box('Psychology'))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith(['IT and computing', 'Health'])
  expect(screen.queryByText(REFUSAL)).toBeNull()
  expect(live).toBeEmptyDOMElement()
})

it('notes only the areas it is told borrow the nearest field (no road teaches their own)', () => {
  renderChecks(undefined, ['Health'])
  const noted = (AREAS as string[]).filter((area) => box(area).textContent?.includes(NOTE))
  expect(noted).toEqual(['Health'])
})

it('notes no area when every one has courses of its own', () => {
  renderChecks()
  const noted = (AREAS as string[]).filter((area) => box(area).textContent?.includes(NOTE))
  expect(noted).toEqual([])
})
