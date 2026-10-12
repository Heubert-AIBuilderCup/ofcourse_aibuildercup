/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import { LIFE_VALUES } from '@/shared/types/student'
import { COINS_ALL_PLACED, COINS_ASSUMED, COINS_HINT } from '../model/coins'

const saved = async (_coins: unknown): Promise<ActionResult> => ({ ok: true })
const saveCoinsAction = mock(saved)

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { AttentionScreen } = await import('./AttentionScreen')

afterEach(() => {
  cleanup()
  saveCoinsAction.mockReset()
  saveCoinsAction.mockImplementation(saved)
  push.mockClear()
})

const BACK_NOTE = "Here's where you placed them last time. Move any, or keep them as they are."
const LATER = 'Spend them later: finish without placing coins'
const FIVE = 'Five is the most on one pile. Take one from here, or place it on another pile.'
const ALL_TEN = 'All ten are placed. Take one from another pile first.'
const ALL_PLACED = COINS_ALL_PLACED

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
const add = (value: string) => press(`Place a coin on ${value}`)
const take = (value: string) => press(`Take a coin from ${value}`)
const done = () => screen.getByRole('button', { name: 'Done' })
/** The tray's "<n> of 10 placed". */
const tray = (n: number) =>
  screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === `${n} of 10 placed`)
const count = (value: string, n: number) => screen.getByText(`${n} of 5 on ${value}`)

const empty = () => render(<AttentionScreen saveCoinsAction={saveCoinsAction} initial={null} />)

it('starts empty: nothing placed, Done unavailable and saving nothing, the hint, no back note', async () => {
  empty()
  expect(tray(0)).toHaveAttribute('aria-live', 'polite')
  expect(screen.getByText(COINS_HINT)).toBeInTheDocument()
  expect(screen.queryByText(BACK_NOTE)).not.toBeInTheDocument()
  expect(done()).toHaveAttribute('aria-disabled', 'true')
  expect(done()).toHaveAccessibleDescription('Place all ten to finish · 10 left.')
  for (const value of LIFE_VALUES) {
    expect(screen.getByRole('button', { name: `Take a coin from ${value}` })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  }
  await press('Done')
  expect(saveCoinsAction).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
})

it('places and takes coins on a pile, and says what the pile now shows', async () => {
  empty()
  for (let i = 0; i < 3; i++) await add('Closeness to family')
  expect(count('Closeness to family', 3)).toBeInTheDocument()
  expect(
    screen.getByText("Closeness to family at 3: we'll show trip times home on each route."),
  ).toBeInTheDocument()
  expect(tray(3)).toBeInTheDocument()
  expect(done()).toHaveAccessibleDescription('Place all ten to finish · 7 left.')
  await take('Closeness to family')
  expect(count('Closeness to family', 2)).toBeInTheDocument()
  expect(
    screen.getByText('Closeness to family at 2: trip costs home show on each route.'),
  ).toBeInTheDocument()
  expect(tray(2)).toBeInTheDocument()
})

const plusOf = (value: string) => screen.getByRole('button', { name: `Place a coin on ${value}` })

it('refuses a sixth coin on a pile, on that pile, and marks its + unavailable', async () => {
  empty()
  for (let i = 0; i < 5; i++) await add('Health')
  expect(plusOf('Health')).toHaveAttribute('aria-disabled', 'true')
  expect(plusOf('Adventure')).toHaveAttribute('aria-disabled', 'false')
  await add('Health')
  expect(count('Health', 5)).toBeInTheDocument()
  expect(screen.getByText(FIVE)).toBeInTheDocument()
})

it('says at the tray that all ten are placed, and every + is unavailable', async () => {
  empty()
  for (let i = 0; i < 5; i++) await add('Health')
  for (let i = 0; i < 5; i++) await add('Adventure')
  expect(tray(10)).toBeInTheDocument()
  // In a region that was there before it, so a screen reader announces it.
  expect(screen.getByText(ALL_PLACED).closest('[role="status"]')).not.toBeNull()
  for (const value of LIFE_VALUES) expect(plusOf(value)).toHaveAttribute('aria-disabled', 'true')
  // A tap on an unavailable + says why where she tapped, beside the notice at the tray.
  await add('Independence')
  expect(count('Independence', 0)).toBeInTheDocument()
  expect(screen.getByText(ALL_TEN)).toBeInTheDocument()
  expect(screen.getAllByText(ALL_PLACED)).toHaveLength(1)
  await take('Adventure')
  expect(screen.queryByText(ALL_TEN)).not.toBeInTheDocument()
  expect(screen.queryByText(ALL_PLACED)).not.toBeInTheDocument()
  expect(plusOf('Independence')).toHaveAttribute('aria-disabled', 'false')
})

it('spreads the coins evenly on "Not sure", assumed until she moves one', async () => {
  empty()
  await press('Not sure')
  LIFE_VALUES.forEach((value, i) => {
    expect(count(value, i === 0 || i === 2 ? 2 : 1)).toBeInTheDocument()
  })
  expect(tray(10)).toBeInTheDocument()
  expect(screen.getByText(COINS_ASSUMED)).toBeInTheDocument()
  await take('Adventure')
  expect(screen.queryByText(COINS_ASSUMED)).not.toBeInTheDocument()
})

it('saves the untouched spread as assumed on Done, and opens the end screen', async () => {
  empty()
  await press('Not sure')
  expect(done()).toHaveAttribute('aria-disabled', 'false')
  expect(done()).toHaveAccessibleDescription('All ten placed. Done finishes onboarding.')
  await press('Done')
  expect(saveCoinsAction).toHaveBeenCalledWith({
    state: 'spent',
    piles: [2, 1, 2, 1, 1, 1, 1, 1],
    assumed: true,
  })
  expect(push).toHaveBeenCalledWith('/onboarding/done')
})

it('saves coins she placed herself as not assumed', async () => {
  empty()
  for (let i = 0; i < 5; i++) await add('Health')
  for (let i = 0; i < 5; i++) await add('Adventure')
  await press('Done')
  expect(saveCoinsAction).toHaveBeenCalledWith({
    state: 'spent',
    piles: [5, 0, 0, 0, 0, 0, 0, 5],
    assumed: false,
  })
  expect(push).toHaveBeenCalledWith('/onboarding/done')
})

it('saves "later" on "Spend them later" and opens the end screen', async () => {
  empty()
  await press(LATER)
  expect(saveCoinsAction).toHaveBeenCalledWith({ state: 'later' })
  expect(push).toHaveBeenCalledWith('/onboarding/done')
})

it('keeps her on the screen when the save is refused, and Try again retries', async () => {
  saveCoinsAction.mockImplementationOnce(async () => ({
    ok: false,
    error: 'Please sign in again.',
  }))
  empty()
  await press(LATER)
  expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.')
  expect(push).not.toHaveBeenCalled()
  await press('Try again')
  expect(saveCoinsAction).toHaveBeenCalledTimes(2)
  expect(saveCoinsAction).toHaveBeenLastCalledWith({ state: 'later' })
  expect(push).toHaveBeenCalledWith('/onboarding/done')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('says so when the save never reaches the server, and stays', async () => {
  saveCoinsAction.mockImplementation(async () => {
    throw new Error('offline')
  })
  empty()
  await press('Not sure')
  await press('Done')
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Please try again.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(push).not.toHaveBeenCalled()
})

it("goes back to step 04's last question", async () => {
  empty()
  await press('Back')
  expect(push).toHaveBeenCalledWith('/onboarding/after/long-term')
})

it('shows the coins she spent before, with the back note', () => {
  render(
    <AttentionScreen
      saveCoinsAction={saveCoinsAction}
      initial={{ state: 'spent', piles: [1, 0, 2, 2, 3, 2, 0, 0], assumed: false }}
    />,
  )
  expect(screen.getByText(BACK_NOTE)).toBeInTheDocument()
  expect(count('Closeness to family', 3)).toBeInTheDocument()
  expect(count('Financial life', 2)).toBeInTheDocument()
  expect(tray(10)).toBeInTheDocument()
  expect(done()).toHaveAttribute('aria-disabled', 'false')
})
