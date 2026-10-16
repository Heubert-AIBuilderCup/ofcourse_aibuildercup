/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Fact } from '../model/types'
import { FactChip, FactNumber } from './FactChip'

afterEach(cleanup)

const FACT: Fact = {
  id: 'f1',
  text: 'Above 20 hrs/week: pass rates −11 points',
  value: null,
  ref: '¶3',
  quote: 'Above 20 hours a week, pass rates fell by 11 percentage points.',
  supported: true,
  why: null,
  span: null,
  sentenceId: '¶3.1',
}
const SOURCE = 'Hours of paid work and first-year results'
const CHECKED = '2026-10-05T23:59:00.000Z'

it('names the fact, its paragraph, its source and the day it was checked', () => {
  render(<FactChip fact={FACT} sourceTitle={SOURCE} checkedAt={CHECKED} />)
  expect(
    screen.getByText(
      'Above 20 hrs/week: pass rates −11 points · ¶3 · Hours of paid work and first-year results · checked 5 Oct 2026',
    ),
  ).toBeInTheDocument()
})

it('is a plain tag in one element, with nothing that shrinks it to its narrowest word', () => {
  render(<FactChip fact={FACT} sourceTitle={SOURCE} checkedAt={CHECKED} />)
  const chip = screen.getByText(/^Above 20 hrs\/week/)
  expect(chip.tagName).toBe('SPAN')
  expect(chip.children).toHaveLength(0)
  for (const collapsing of ['w-min', 'w-0', 'max-w-min', 'basis-0', 'inline-grid', 'break-all']) {
    expect(chip).not.toHaveClass(collapsing)
  }
  expect(chip).toHaveClass('w-fit')
})

it('shows a bound fact as its number only, and opens its source sentence and source on a press (GD23)', () => {
  render(<FactNumber fact={FACT} sourceTitle={SOURCE} checkedAt={CHECKED} />)
  expect(screen.queryByText(FACT.quote as string)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '¶3.1' }))
  expect(screen.getByText(FACT.quote as string)).toBeInTheDocument()
  expect(
    screen.getByText('Hours of paid work and first-year results · ¶3 · checked 5 Oct 2026'),
  ).toBeInTheDocument()
})

it('numbers a fact from before sentence ids by its paragraph, and opens its own words when it has no quote', () => {
  render(
    <FactNumber
      fact={{ ...FACT, sentenceId: undefined, quote: null }}
      sourceTitle={SOURCE}
      checkedAt={CHECKED}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '¶3' }))
  expect(screen.getByText(FACT.text)).toBeInTheDocument()
})

it('names the link a fact came from in place of the title, for a source read from several (GD19)', () => {
  render(<FactChip fact={FACT} sourceTitle={SOURCE} site="abc.example" checkedAt={CHECKED} />)
  expect(
    screen.getByText(
      'Above 20 hrs/week: pass rates −11 points · ¶3 · abc.example · checked 5 Oct 2026',
    ),
  ).toBeInTheDocument()
  cleanup()
  render(<FactNumber fact={FACT} sourceTitle={SOURCE} site="abc.example" checkedAt={CHECKED} />)
  fireEvent.click(screen.getByRole('button', { name: '¶3.1' }))
  expect(screen.getByText('abc.example · ¶3 · checked 5 Oct 2026')).toBeInTheDocument()
})
