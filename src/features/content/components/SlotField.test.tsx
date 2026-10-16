/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SlotField } from './SlotField'
import { countOf } from './steps/text/shared'

afterEach(cleanup)

// One slot's text beside the slide (C1): typed in a field with a live count, saved when it is
// left changed or on Ctrl+Enter, a refusal said under it.

const HEADLINE = { unit: 'chars', min: 1, max: 24 } as const

const field = (over: Partial<Parameters<typeof SlotField>[0]> = {}) => {
  const onSave = mock((_text: string) => {})
  render(
    <SlotField
      label="Headline"
      value="Tests everywhere"
      count={(text) => countOf(text, HEADLINE)}
      disabled={false}
      error={null}
      onSave={onSave}
      {...over}
    />,
  )
  return { onSave, box: screen.getByRole('textbox', { name: 'Headline' }) }
}

it('saves the text when the field is left changed, and nothing when it is left as it was', () => {
  const { onSave, box } = field()
  fireEvent.blur(box)
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.change(box, { target: { value: 'Tests at every job' } })
  fireEvent.blur(box)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith('Tests at every job')
})

it('saves a long field on Ctrl+Enter, once, not again when it is left', () => {
  const { onSave, box } = field({ long: true, value: 'Trait tests guide hiring.' })
  expect(box.tagName).toBe('TEXTAREA')
  fireEvent.change(box, { target: { value: 'Trait tests guide hiring and coaching.' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
  fireEvent.blur(box)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith('Trait tests guide hiring and coaching.')
})

it('counts the text as it is typed, over the limit said as over', () => {
  const { box } = field()
  expect(box).toHaveAccessibleDescription('16 of 1–24 characters')
  fireEvent.change(box, { target: { value: 'Tests at every single job too' } })
  expect(box).toHaveAccessibleDescription('29 of 1–24 characters')
  expect(screen.getByText('29 of 1–24 characters')).toHaveClass('text-destructive')
})

it('counts a Nepali entry by the characters a reader sees, not code points', () => {
  const { box } = field()
  // न + े, प + ा, ल: five code points, three characters.
  fireEvent.change(box, { target: { value: 'नेपाल' } })
  expect(box).toHaveAccessibleDescription('3 of 1–24 characters')
})

it('says a refusal of the save under the field, as its description', () => {
  const refusal = 'Number not in its fact: 47% is not in ¶2.'
  const { box } = field({ error: refusal })
  expect(box).toHaveAccessibleDescription(`16 of 1–24 characters ${refusal}`)
  expect(box).toHaveAttribute('aria-invalid', 'true')
})
