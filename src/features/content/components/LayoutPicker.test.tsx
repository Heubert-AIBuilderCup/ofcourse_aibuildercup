/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LAYOUT_REASONS, type LayoutOption } from '../layout/relayout'
import type { LayoutId } from '../model/types'
import { LayoutPicker } from './LayoutPicker'

afterEach(cleanup)

const OPTIONS: LayoutOption[] = [
  { id: 'cover', ok: false, reason: LAYOUT_REASONS.cover },
  { id: 'picture', ok: true },
  { id: 'number', ok: false, reason: LAYOUT_REASONS.numbers },
  { id: 'bars', ok: false, reason: LAYOUT_REASONS.numbers },
  { id: 'quote', ok: true },
  { id: 'checklist', ok: true },
  { id: 'bullets', ok: true },
  { id: 'takeaway', ok: false, reason: LAYOUT_REASONS.takeaway },
]

const picker = (onChoose = mock((_layout: LayoutId) => {})) => {
  render(
    <LayoutPicker
      slide={2}
      options={OPTIONS}
      current="picture"
      disabled={false}
      onChoose={onChoose}
    />,
  )
  return onChoose
}

it('offers the eight layouts by name, bullet points among them, the current one pressed (GD34)', () => {
  picker()
  for (const name of [
    'Cover',
    'Picture and text',
    'Big number',
    'Comparison bars',
    'Quote',
    'Checklist',
    'Bullet points',
    'Takeaway',
  ]) {
    expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: /^Picture and text/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

it('shows a layout the slide cannot fill disabled, with its reason as text, and never chooses it (GD5)', () => {
  const onChoose = picker()
  const number = screen.getByRole('button', { name: /^Big number/ })
  expect(number).toBeDisabled()
  expect(screen.getByText(LAYOUT_REASONS.numbers)).toBeInTheDocument()
  fireEvent.click(number)
  expect(onChoose).not.toHaveBeenCalled()
})

it('writes the reasons once under the layouts, one line for the options that share one (C2)', () => {
  const shared = LAYOUT_REASONS.numbers
  render(
    <LayoutPicker
      slide={2}
      options={[
        { id: 'cover', ok: false, reason: LAYOUT_REASONS.cover },
        { id: 'picture', ok: true },
        { id: 'number', ok: false, reason: shared },
        { id: 'bars', ok: false, reason: shared },
      ]}
      current="picture"
      disabled={false}
      onChoose={() => {}}
    />,
  )
  expect(screen.getAllByText(shared)).toHaveLength(1)
  expect(screen.getByText(shared).closest('li')).toBeNull()
  expect(screen.getByRole('button', { name: /^Big number/ })).toHaveAccessibleDescription(shared)
  expect(screen.getByRole('button', { name: /^Comparison bars/ })).toHaveAccessibleDescription(
    shared,
  )
  expect(screen.getByRole('button', { name: /^Cover/ })).toHaveAccessibleDescription(
    LAYOUT_REASONS.cover,
  )
})

it('chooses a layout the slide can fill, and not the one it is in', () => {
  const onChoose = picker()
  fireEvent.click(screen.getByRole('button', { name: /^Picture and text/ }))
  expect(onChoose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Checklist/ }))
  expect(onChoose).toHaveBeenCalledWith('checklist')
})
