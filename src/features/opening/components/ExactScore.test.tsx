/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExactScore } from './ExactScore'

const onAnswer = mock((_raw: string) => {})
afterEach(() => {
  cleanup()
  onAnswer.mockClear()
})

const OPEN = 'Enter my exact score'
const click = (name: string) =>
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
const choose = (test: string) =>
  act(() => {
    fireEvent.change(screen.getByLabelText('Test'), { target: { value: test } })
  })
const type = (score: string) =>
  act(() => {
    fireEvent.change(screen.getByLabelText('Score'), { target: { value: score } })
  })

it('keeps the test picker and the score closed until she asks to enter one', () => {
  render(<ExactScore value={undefined} onAnswer={onAnswer} />)
  expect(screen.getByRole('button', { name: OPEN }).getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByLabelText('Score')).toBeNull()
})

it('saves "PTE 58" for PTE Academic and 58', () => {
  render(<ExactScore value={undefined} onAnswer={onAnswer} />)
  click(OPEN)
  choose('PTE')
  type('58')
  click('Use this score')
  expect(onAnswer.mock.calls).toEqual([['PTE 58']])
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows the range and saves nothing for a score outside it', () => {
  render(<ExactScore value={undefined} onAnswer={onAnswer} />)
  click(OPEN)
  choose('PTE')
  type('95')
  click('Use this score')
  expect(screen.getByRole('alert').textContent).toBe('Enter a PTE Academic score from 10 to 90.')
  expect(onAnswer).not.toHaveBeenCalled()
})

it('opens on the score she already gave, test and number filled in', () => {
  render(<ExactScore value="TOEFL 85" onAnswer={onAnswer} />)
  expect((screen.getByLabelText('Test') as HTMLSelectElement).value).toBe('TOEFL')
  expect((screen.getByLabelText('Score') as HTMLInputElement).value).toBe('85')
})

it('stays closed for an answer that is one of the quick options', () => {
  render(<ExactScore value="IELTS 7.5 or more" onAnswer={onAnswer} />)
  expect(screen.queryByLabelText('Score')).toBeNull()
})
