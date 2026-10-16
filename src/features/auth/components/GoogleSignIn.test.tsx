/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const social = mock(async (_: unknown) => ({ error: null as { message: string } | null }))
// Every export of the client: bun patches a module mocked by an earlier test file in place, so a
// later file's mock (StudentSignIn.test.tsx) cannot add one this mock left out.
mock.module('@/shared/lib/auth/client', () => ({
  emailOtp: { sendVerificationOtp: async () => ({}) },
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
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })))

it('signs in with Google on its page and comes back where the user was going', async () => {
  render(
    <GoogleSignIn next="/admin/users" surface="admin" errorCallbackURL="/signin-error/admin" />,
  )
  await tap()
  expect(social).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/admin/users',
    errorCallbackURL: '/signin-error/admin',
    additionalData: { surface: 'admin' },
  })
})

it('carries the student page to its own error path', async () => {
  render(<GoogleSignIn next="/start" surface="student" errorCallbackURL="/signin-error" />)
  await tap()
  expect(social).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/start',
    errorCallbackURL: '/signin-error',
    additionalData: { surface: 'student' },
  })
})

it('says what to do when Google refuses', async () => {
  social.mockImplementationOnce(async () => ({ error: { message: 'boom' } }))
  render(<GoogleSignIn next="/start" surface="student" errorCallbackURL="/signin-error" />)
  await tap()
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in did not start. Try again.')
  expect(screen.queryByText('boom')).toBeNull()
})
