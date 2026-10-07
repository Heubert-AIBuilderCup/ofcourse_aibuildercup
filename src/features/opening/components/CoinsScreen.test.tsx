/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import { LIFE_VALUES } from '@/shared/types/student'
import { COINS_ASSUMED, COINS_HINT, COINS_INTRO } from '../model/coins'

const saved = async (_coins: unknown): Promise<ActionResult> => ({ ok: true })
const saveCoinsAction = mock(saved)

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { CoinsScreen } = await import('./CoinsScreen')

afterEach(() => {
  cleanup()
  saveCoinsAction.mockReset()
  saveCoinsAction.mockImplementation(saved)
  push.mockClear()
})

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
const add = (value: string) => press(`Add a coin to ${value}`)

it('starts with ten coins to place and Done not yet possible', () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  expect(screen.getByText('Getting started · step 6 of 6 · optional')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Your attention' })).toBeInTheDocument()
  expect(screen.getByText(COINS_INTRO)).toBeInTheDocument()
  expect(screen.getByText('10 coins left to place')).toBeInTheDocument()
  expect(screen.getByText(COINS_HINT)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Place all ten to finish' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
})

it('has a row of two buttons for each of the eight life values', () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  expect(LIFE_VALUES).toHaveLength(8)
  for (const value of LIFE_VALUES) {
    expect(screen.getByRole('button', { name: `Add a coin to ${value}` })).toBeEnabled()
    expect(screen.getByRole('button', { name: `Take a coin from ${value}` })).toBeDisabled()
  }
})

it('stops a pile at five coins', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  for (let i = 0; i < 5; i++) await add('Health')
  expect(screen.getByRole('button', { name: 'Add a coin to Health' })).toBeDisabled()
  expect(screen.getByText('5 coins left to place')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add a coin to Health' }))
  expect(screen.getByText('5 coins left to place')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Take a coin from Health' })).toBeEnabled()
})

it('takes a coin back, and says "1 coin" in the singular', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  for (let i = 0; i < 9; i++) await add(LIFE_VALUES[i % 2 === 0 ? 0 : 1])
  expect(screen.getByText('1 coin left to place')).toBeInTheDocument()
  await press('Take a coin from Health')
  expect(screen.getByText('2 coins left to place')).toBeInTheDocument()
})

it('disables every plus at ten and enables Done', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  for (const value of LIFE_VALUES.slice(0, 5)) {
    await add(value)
    await add(value)
  }
  expect(screen.getByText('All 10 placed')).toBeInTheDocument()
  for (const value of LIFE_VALUES) {
    expect(screen.getByRole('button', { name: `Add a coin to ${value}` })).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
})

it('says what one coin on Closeness to family does', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await add('Closeness to family')
  expect(
    screen.getByText('Closeness to family at 1: call-time tips appear in your feed.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(COINS_HINT)).not.toBeInTheDocument()
})

it('spreads the coins for her on "Not sure" and says they are assumed', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Not sure · spread them for me')
  expect(screen.getByText('All 10 placed')).toBeInTheDocument()
  expect(screen.getByText(COINS_ASSUMED)).toBeInTheDocument()
})

it('stops calling the spread assumed once she moves a coin', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Not sure · spread them for me')
  await press('Take a coin from Health')
  expect(screen.queryByText(COINS_ASSUMED)).not.toBeInTheDocument()
  expect(
    screen.getByText('Health at 1: sleep and exercise get a mention on busy weeks.'),
  ).toBeInTheDocument()
  await add('Adventure')
  await press('Done')
  expect(saveCoinsAction).toHaveBeenCalledWith({
    state: 'spent',
    piles: [1, 1, 1, 2, 1, 1, 1, 2],
    assumed: false,
  })
})

it('empties the piles on "Start again"', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Not sure · spread them for me')
  await press('Start again')
  expect(screen.getByText('10 coins left to place')).toBeInTheDocument()
  expect(screen.getByText(COINS_HINT)).toBeInTheDocument()
  expect(screen.queryByText(COINS_ASSUMED)).not.toBeInTheDocument()
})

it('saves the spread on Done and goes to the futures', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Not sure · spread them for me')
  await press('Done')
  expect(saveCoinsAction).toHaveBeenCalledWith({
    state: 'spent',
    piles: [2, 1, 1, 2, 1, 1, 1, 1],
    assumed: true,
  })
  expect(push).toHaveBeenCalledWith('/futures')
})

it('saves "later" and goes to the futures without any coin placed', async () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Spend them later')
  expect(saveCoinsAction).toHaveBeenCalledWith({ state: 'later' })
  expect(push).toHaveBeenCalledWith('/futures')
})

it('goes back to the futures (criterion 30)', () => {
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/futures')
})

it('shows the coins she spent before', () => {
  render(
    <CoinsScreen
      saveCoinsAction={saveCoinsAction}
      initial={{ state: 'spent', piles: [5, 5, 0, 0, 0, 0, 0, 0], assumed: false }}
    />,
  )
  expect(screen.getByText('All 10 placed')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
})

it('shows a refused save and stays', async () => {
  saveCoinsAction.mockImplementation(async () => ({ ok: false, error: 'Please sign in again.' }))
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Spend them later')
  expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.')
  expect(push).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Spend them later' })).toBeEnabled()
})

it('says so when the save never reaches the server, and stays', async () => {
  saveCoinsAction.mockImplementation(async () => {
    throw new Error('offline')
  })
  render(<CoinsScreen saveCoinsAction={saveCoinsAction} initial={null} />)
  await press('Not sure · spread them for me')
  await press('Done')
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Please try again.')
  expect(push).not.toHaveBeenCalled()
})
