/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const social = mock(async (_: unknown) => ({ error: null as { message: string } | null }))
mock.module('@/shared/lib/auth/client', () => ({
  signIn: { social },
  signOut: async () => ({}),
  useSession: () => ({ data: null }),
}))

const { GoogleSignIn } = await import('./GoogleSignIn')

afterEach(() => {
  cleanup()
  social.mockClear()
})

const tap = () =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' })))

it('signs in with Google and comes back where the user was going', async () => {
  render(<GoogleSignIn next="/admin/users" />)
  await tap()
  expect(social).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/admin/users',
    errorCallbackURL: '/signin-error',
  })
})

it('says what to do when Google refuses', async () => {
  social.mockImplementationOnce(async () => ({ error: { message: 'boom' } }))
  render(<GoogleSignIn next="/" />)
  await tap()
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in did not start. Try again.')
  expect(screen.queryByText('boom')).toBeNull()
})
