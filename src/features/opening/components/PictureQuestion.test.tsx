/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'

const saved = async (_persona: unknown): Promise<ActionResult> => ({ ok: true })
const savePersonaAction = mock(saved)

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { PictureQuestion } = await import('./PictureQuestion')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

afterEach(() => {
  cleanup()
  savePersonaAction.mockReset()
  savePersonaAction.mockImplementation(saved)
  push.mockClear()
})

const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })

it('asks the question with three choices, none pressed', () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  expect(screen.getByText('Optional · one tap')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'How should we picture you?' })).toBeInTheDocument()
  expect(
    screen.getByText(
      'Used only to pick the character in your comics. Nothing else reads it. Skip it and the character is neutral.',
    ),
  ).toBeInTheDocument()
  for (const name of ['Male', 'Female', 'Prefer not to say']) {
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
  }
})

it('saves neutral when Start is pressed with nothing chosen, then opens screen 1', async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Start')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
  expect(push).toHaveBeenCalledWith('/opening/facts')
})

it('saves the choice she pressed', async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Female')
  expect(screen.getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true')
  await press('Start')
  expect(savePersonaAction).toHaveBeenCalledWith('female')
  expect(screen.getByText('Your comic character is female.')).toBeInTheDocument()
})

it('keeps one choice at a time, and a second press takes it back', async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Male')
  await press('Female')
  expect(screen.getByRole('button', { name: 'Male' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true')
  await press('Female')
  expect(screen.getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'false')
})

it('saves neutral for "Prefer not to say"', async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Prefer not to say')
  await press('Start')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
})

it('saves neutral on Skip, whatever was pressed', async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Male')
  await press('Skip')
  expect(savePersonaAction).toHaveBeenCalledWith('neutral')
  expect(push).toHaveBeenCalledWith('/opening/facts')
})

it("says she's in once the choice is saved", async () => {
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Start')
  expect(
    screen.getByRole('heading', { name: "You're in. The first screen opens in a moment." }),
  ).toBeInTheDocument()
  expect(screen.getByText('Your comic character is neutral.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
})

it('shows a refused save and stays', async () => {
  savePersonaAction.mockImplementation(async () => ({
    ok: false,
    error: 'Please sign in again.',
  }))
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Start')
  expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.')
  expect(push).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
})

it('says so when the save never reaches the server, and stays', async () => {
  savePersonaAction.mockImplementation(async () => {
    throw new Error('offline')
  })
  render(<PictureQuestion savePersonaAction={savePersonaAction} />)
  await press('Skip')
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Please try again.')
  expect(push).not.toHaveBeenCalled()
})
