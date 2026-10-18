/// <reference lib="dom" />
// The "Judge access" dialog: it sends the passcode with the story chosen (the admin's has no
// choice), offers no fresh start, and says what the action answers.

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

  it('offers only the stories given, with no fresh start', () => {
    render(<JudgeAccess action={refused('')} stories={STORIES.slice(0, 1)} />)
    openAndType('cup-2026')
    const choices = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('type') === 'submit')
      .map((b) => `${b.getAttribute('name')}=${b.getAttribute('value')}`)
    expect(choices).toEqual(['story=priya'])
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

describe('JudgeAccess with the passcode shown (18 Oct: judges find it in the dialog)', () => {
  it('names the passcode and fills it in, so one press signs in', async () => {
    const action = refused('nope')
    render(<JudgeAccess action={action} stories={STORIES} passcode="ofcourse" />)
    fireEvent.click(screen.getByRole('button', { name: 'Judge access' }))
    expect(document.body.textContent?.includes('The passcode is ofcourse')).toBe(true)
    expect((screen.getByLabelText('Passcode') as HTMLInputElement).value).toBe('ofcourse')
    fireEvent.click(screen.getByRole('button', { name: /Priya/ }))
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(sent(action)).toEqual(['passcode=ofcourse', 'story=priya'])
  })

  it('never on the admin form, even when handed one: the admin judge edits and publishes', () => {
    render(<JudgeAccess action={refused('nope')} passcode="ofcourse" />)
    fireEvent.click(screen.getByRole('button', { name: 'Judge access' }))
    expect(document.body.textContent?.includes('ofcourse')).toBe(false)
    const field = screen.getByLabelText('Passcode') as HTMLInputElement
    expect(`${field.type}:${field.value}`).toBe('password:')
  })

  it('without it, says nothing of a passcode and leaves the field empty', () => {
    render(<JudgeAccess action={refused('nope')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Judge access' }))
    expect(screen.queryByText('ofcourse')).toBeNull()
    expect((screen.getByLabelText('Passcode') as HTMLInputElement).value).toBe('')
  })
})
