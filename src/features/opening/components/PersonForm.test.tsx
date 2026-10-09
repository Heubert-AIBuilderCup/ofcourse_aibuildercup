/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Relative } from '@/shared/types/student'
import { PersonForm } from './PersonForm'

const onChange = mock((_: Relative | null) => {})

afterEach(() => {
  cleanup()
  onChange.mockClear()
})

function show(relative: Relative | null = null) {
  return render(
    <>
      <h1 id="q">Who, and where?</h1>
      <PersonForm relative={relative} onChange={onChange} labelledBy="q" />
    </>,
  )
}

const pick = (label: string, value: string) =>
  act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  })

it('offers the preview places by city, "Somewhere else" last', () => {
  show()
  const place = screen.getByLabelText('City or suburb')
  const options = within(place).getAllByRole('option')
  expect(options[0]).toHaveTextContent('Choose a city or suburb')
  expect(options[0]).toHaveValue('')
  expect(options[options.length - 1]).toHaveTextContent('Somewhere else')
  const perth = place.querySelector('optgroup[label="Perth"]')
  expect(perth).not.toBeNull()
  expect(
    within(perth as HTMLElement).getByRole('option', { name: 'Cannington, Perth' }),
  ).toBeInTheDocument()
  expect(place.querySelector('optgroup:last-of-type')).toHaveAttribute('label', 'Not listed')
})

it('hands on a place she picks, with its name, and a trimmed name', async () => {
  show()
  await pick('City or suburb', 'cannington')
  expect(onChange).toHaveBeenLastCalledWith({
    placeId: 'cannington',
    place: 'Cannington',
    relationship: null,
    name: null,
  })
  await pick('Name (optional)', ' Anjali ')
  expect(onChange).toHaveBeenLastCalledWith({
    placeId: 'cannington',
    place: 'Cannington',
    relationship: null,
    name: 'Anjali',
  })
})

it('asks where once she picks "Somewhere else", a place before she types it', async () => {
  show()
  expect(screen.queryByLabelText('Where?')).not.toBeInTheDocument()
  await pick('City or suburb', 'elsewhere')
  const where = screen.getByLabelText('Where?')
  expect(where).toHaveAttribute('placeholder', 'Town or city, and country')
  expect(onChange).toHaveBeenLastCalledWith({
    placeId: null,
    place: '',
    relationship: null,
    name: null,
  })
  await pick('Where?', 'Pokhara ')
  expect(onChange).toHaveBeenLastCalledWith({
    placeId: null,
    place: 'Pokhara',
    relationship: null,
    name: null,
  })
})

it('offers the relationships as cards, the stored one checked', async () => {
  show({ placeId: null, place: 'Pokhara', relationship: 'Friend', name: null })
  const group = screen.getByRole('radiogroup', { name: "They're your…" })
  expect(
    within(group)
      .getAllByRole('radio')
      .map((card) => card.textContent),
  ).toEqual(['Cousin', 'Sibling', 'Aunt or uncle', 'Friend', 'Other'])
  expect(screen.getByRole('radio', { name: 'Friend' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByLabelText('Where?')).toHaveValue('Pokhara')
  await act(async () => {
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Friend' }), { key: 'ArrowRight' })
  })
  expect(onChange).toHaveBeenLastCalledWith({
    placeId: null,
    place: 'Pokhara',
    relationship: 'Other',
    name: null,
  })
})

it('hands on no one once every part is blank', async () => {
  show({ placeId: null, place: null, relationship: null, name: 'Anjali' })
  await pick('Name (optional)', '  ')
  expect(onChange).toHaveBeenLastCalledWith(null)
})
