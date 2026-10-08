/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnswerValue, StoredAnswer } from '@/shared/types/student'
import { NOT_SURE, questionOf } from '../model/questions'
import { AnswerCards } from './AnswerCards'

afterEach(cleanup)

const onAnswer = mock((_raw: AnswerValue) => {})
afterEach(() => onAnswer.mockClear())

function renderCards(key: 'amount' | 'dep', answer?: StoredAnswer) {
  const question = questionOf(key)
  return render(
    <>
      <h1 id="q">{question.label || 'Anyone coming with you?'}</h1>
      <AnswerCards question={question} labelledBy="q" answer={answer} onAnswer={onAnswer} />
    </>,
  )
}

const LABELS = ['AUD 24k', 'AUD 30k', 'AUD 36k', 'AUD 42k', 'Not sure']
const radio = (name: string) => screen.getByRole('radio', { name })

it('is a radiogroup named by its question, with the options in order and "Not sure" last', () => {
  renderCards('amount')
  const group = screen.getByRole('radiogroup', { name: 'Amount' })
  expect(group).toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toEqual(LABELS.map(radio))
})

it('checks nothing when unanswered, and the first card alone is in the tab order', () => {
  renderCards('amount')
  const radios = screen.getAllByRole('radio')
  for (const r of radios) expect(r).not.toHaveAttribute('aria-checked', 'true')
  expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1, -1])
})

it('reports a tap on a card as its option', () => {
  renderCards('amount')
  fireEvent.click(radio('AUD 36k'))
  expect(onAnswer).toHaveBeenCalledTimes(1)
  expect(onAnswer).toHaveBeenCalledWith(36)
})

it('checks the stated answer, makes it the tab stop, and ignores a tap on it', () => {
  renderCards('amount', { value: 36, state: 'stated' })
  expect(radio('AUD 36k')).toHaveAttribute('aria-checked', 'true')
  expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1, -1])
  fireEvent.click(radio('AUD 36k'))
  expect(onAnswer).not.toHaveBeenCalled()
})

it('checks "Not sure", not the default, when the answer is assumed', () => {
  renderCards('amount', { value: 30, state: 'assumed' })
  expect(radio(NOT_SURE)).toHaveAttribute('aria-checked', 'true')
  expect(radio('AUD 30k')).not.toHaveAttribute('aria-checked', 'true')
  expect(radio(NOT_SURE).tabIndex).toBe(0)
})

it('moves and picks with the arrow keys, Home and End', () => {
  renderCards('amount', { value: 36, state: 'stated' })
  for (const key of ['ArrowRight', 'ArrowDown']) {
    onAnswer.mockClear()
    radio('AUD 36k').focus()
    fireEvent.keyDown(radio('AUD 36k'), { key })
    expect(onAnswer).toHaveBeenCalledWith(42)
    expect(radio('AUD 42k')).toHaveFocus()
  }
  for (const key of ['ArrowLeft', 'ArrowUp']) {
    onAnswer.mockClear()
    fireEvent.keyDown(radio('AUD 36k'), { key })
    expect(onAnswer).toHaveBeenCalledWith(30)
    expect(radio('AUD 30k')).toHaveFocus()
  }
  fireEvent.keyDown(radio('AUD 36k'), { key: 'Home' })
  expect(onAnswer).toHaveBeenLastCalledWith(24)
  fireEvent.keyDown(radio('AUD 36k'), { key: 'End' })
  expect(onAnswer).toHaveBeenLastCalledWith(NOT_SURE)
  expect(radio(NOT_SURE)).toHaveFocus()
})

it('wraps from "Not sure" to the first option, and back', () => {
  renderCards('amount', { value: 30, state: 'assumed' })
  fireEvent.keyDown(radio(NOT_SURE), { key: 'ArrowRight' })
  expect(onAnswer).toHaveBeenLastCalledWith(24)
  fireEvent.keyDown(radio('AUD 24k'), { key: 'ArrowLeft' })
  expect(onAnswer).toHaveBeenLastCalledWith(NOT_SURE)
})

it('leaves other keys alone', () => {
  renderCards('amount')
  fireEvent.keyDown(radio('AUD 24k'), { key: 'Tab' })
  expect(onAnswer).not.toHaveBeenCalled()
})

it('lays four cards out in two columns, five in three', () => {
  const four = renderCards('dep')
  expect(screen.getAllByRole('radio')).toHaveLength(4)
  expect(screen.getByRole('radiogroup').className).toContain('grid-cols-2')
  expect(screen.getByRole('radiogroup').className).not.toContain('grid-cols-3')
  four.unmount()
  renderCards('amount')
  expect(screen.getByRole('radiogroup').className).toContain('grid-cols-3')
})
