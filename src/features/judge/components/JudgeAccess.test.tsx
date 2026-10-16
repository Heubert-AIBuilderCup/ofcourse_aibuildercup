/// <reference lib="dom" />
// The "Judge access" dialog: it sends the passcode with the choice made (a story, or a fresh start
// from the beginning; the admin's has no choice), and says what the action answers.

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ActionResult } from '@/shared/types/action-result'

const { JudgeAccess } = await import('./JudgeAccess')

afterEach(cleanup)

const refused = (error: string) =>
  mock(
    async (_previous: ActionResult | null, _form: FormData): Promise<ActionResult> => ({
      ok: false,
      error,
    }),
  )

const STORIES = [
  { id: 'priya', name: 'Priya', country: 'Nepal', line: 'Cyber security in Perth.' },
  { id: 'aarav', name: 'Aarav', country: 'India', line: 'Data science in Sydney.' },
]

/** What the action was sent, as text: each field and its value. */
const sent = (action: ReturnType<typeof refused>) =>
  [...(action.mock.calls[0]?.[1]?.entries() ?? [])].map(([k, v]) => `${k}=${String(v)}`)

function openAndType(passcode: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Judge access' }))
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: passcode } })
}

describe('JudgeAccess for students', () => {
  it('sends the passcode with the story picked, and says the refusal', async () => {
    const action = refused("That passcode isn't right.")
    render(<JudgeAccess action={action} stories={STORIES} />)
    openAndType('cup-2026')
    fireEvent.click(screen.getByRole('button', { name: /Aarav/ }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(action)).toEqual(['passcode=cup-2026', 'story=aarav'])
    expect((await screen.findByRole('alert')).textContent).toBe("That passcode isn't right.")
  })

  it('"Start from the beginning" sends no story but a fresh start', async () => {
    const action = refused("That passcode isn't right.")
    render(<JudgeAccess action={action} stories={STORIES} />)
    openAndType('cup-2026')
    fireEvent.click(screen.getByRole('button', { name: /Start from the beginning/ }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(action)).toEqual(['passcode=cup-2026', 'story=fresh'])
  })
})

describe('JudgeAccess for the admin', () => {
  it('sends the passcode alone', async () => {
    const action = refused('Too many tries. Wait a few minutes, then try again.')
    render(<JudgeAccess action={action} />)
    openAndType('cup-2026')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as a judge' }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(action)).toEqual(['passcode=cup-2026'])
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Too many tries. Wait a few minutes, then try again.',
    )
  })
})
