/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock, setSystemTime } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'

type ClientError = { code?: string } | null

const sent = async (_: unknown) => ({
  data: { success: true } as unknown,
  error: null as ClientError,
})
const signedIn = async (_: unknown) => ({ data: {} as unknown, error: null as ClientError })

const sendVerificationOtp = mock(sent)
const emailOtpSignIn = mock(signedIn)
const social = mock(async (_: unknown) => ({ error: null }))
mock.module('@/shared/lib/auth/client', () => ({
  emailOtp: { sendVerificationOtp },
  signIn: { emailOtp: emailOtpSignIn, social },
  signOut: async () => ({}),
  useSession: () => ({ data: null }),
}))

const replace = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ replace, push: () => {}, refresh: () => {}, back: () => {} }),
}))

const { StudentSignIn } = await import('./StudentSignIn')

afterEach(() => {
  cleanup()
  sendVerificationOtp.mockReset()
  sendVerificationOtp.mockImplementation(sent)
  emailOtpSignIn.mockReset()
  emailOtpSignIn.mockImplementation(signedIn)
  replace.mockClear()
  setSystemTime()
})

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const press = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
const refuseWith = (code: string) =>
  emailOtpSignIn.mockImplementation(async () => ({ data: null, error: { code } }))

async function toCodeStep(email = 'a@b.test') {
  render(<StudentSignIn next="/start" />)
  fill('Your email', email)
  await press('Send me a code')
}

it('offers Google and an email code', () => {
  render(<StudentSignIn next="/start" />)
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  expect(screen.getByLabelText('Your email')).toBeInTheDocument()
  expect(screen.getByText('We send a six-digit code. No password.')).toBeInTheDocument()
})

it('refuses an address that is not one, and sends nothing', async () => {
  render(<StudentSignIn next="/start" />)
  fill('Your email', 'not-an-email')
  await press('Send me a code')
  // A field's own mistake is said under the field, not in the form's error block.
  expect(screen.getByLabelText('Your email')).toHaveAccessibleDescription(
    'Enter an email like name@company.com.',
  )
  expect(screen.queryByRole('alert')).toBeNull()
  expect(sendVerificationOtp).not.toHaveBeenCalled()
})

it('sends a code, then asks for it and holds back a new one for 30 seconds', async () => {
  await toCodeStep()
  expect(sendVerificationOtp).toHaveBeenCalledWith({ email: 'a@b.test', type: 'sign-in' })
  expect(screen.getByText('The code we sent to a@b.test')).toBeInTheDocument()
  const code = screen.getByLabelText('Six-digit code')
  expect(code).toHaveAttribute('inputmode', 'numeric')
  expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  expect(code).toHaveAttribute('maxlength', '6')
  expect(screen.getByRole('button', { name: 'Send a new code in 30 s' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Use a different email' })).toBeEnabled()
})

it('says when the server holds back a new code', async () => {
  sendVerificationOtp.mockImplementation(async () => ({
    data: null,
    error: { code: 'CODE_RECENTLY_SENT' },
  }))
  render(<StudentSignIn next="/start" />)
  fill('Your email', 'a@b.test')
  await press('Send me a code')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Wait 30 seconds before asking for a new code.',
  )
})

it('signs in with the right code and goes on to the page asked for', async () => {
  await toCodeStep()
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(emailOtpSignIn).toHaveBeenCalledWith({ email: 'a@b.test', otp: '123456' })
  expect(replace).toHaveBeenCalledWith('/start')
})

it('says a code is wrong, and after the fifth wrong one asks for a new code', async () => {
  refuseWith('INVALID_OTP')
  await toCodeStep()
  fill('Six-digit code', '000000')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'That code is wrong. Check the email and try again.',
  )
  for (let i = 0; i < 4; i++) await press('Sign in')
  expect(emailOtpSignIn).toHaveBeenCalledTimes(5)
  expect(screen.getByRole('alert')).toHaveTextContent('That code no longer works. Send a new one.')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  expect(replace).not.toHaveBeenCalled()
})

it('says an expired code has expired', async () => {
  refuseWith('OTP_EXPIRED')
  await toCodeStep()
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent('That code has expired. Send a new one.')
})

it('says a code entered over ten minutes after it was sent has expired, whatever the server says', async () => {
  // The server forgets an expired code as soon as any request tidies the table, and then calls
  // it wrong.
  refuseWith('INVALID_OTP')
  setSystemTime(new Date('2026-10-08T09:00:00Z'))
  await toCodeStep()
  setSystemTime(new Date('2026-10-08T09:10:01Z'))
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent('That code has expired. Send a new one.')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
})

it('refuses an account that belongs on the admin page', async () => {
  refuseWith('STUDENT_PAGE_ONLY')
  await toCodeStep()
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'This page is for students. This account signs in on the admin page.',
  )
  expect(replace).not.toHaveBeenCalled()
})

it('sends a suspended account to the suspended page', async () => {
  refuseWith('ACCOUNT_SUSPENDED')
  await toCodeStep()
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(replace).toHaveBeenCalledWith('/suspended')
})

it('goes back to the email step for a different address', async () => {
  await toCodeStep()
  await press('Use a different email')
  expect(screen.getByLabelText('Your email')).toBeInTheDocument()
  expect(screen.queryByLabelText('Six-digit code')).toBeNull()
})

it('says the sign-in failed, not the send, when the code step fails for a reason it does not know', async () => {
  await toCodeStep()
  emailOtpSignIn.mockImplementation(async () => {
    throw new Error('network down')
  })
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent("We couldn't sign you in. Try again.")

  refuseWith('SOMETHING_ELSE')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent("We couldn't sign you in. Try again.")
})

it('keeps the failed-send message for the email step', async () => {
  sendVerificationOtp.mockImplementation(async () => {
    throw new Error('network down')
  })
  render(<StudentSignIn next="/start" />)
  fill('Your email', 'a@b.test')
  await press('Send me a code')
  expect(screen.getByRole('alert')).toHaveTextContent("We couldn't send the code. Try again.")
})

/** A promise the test settles itself, to see the page while it waits. */
function deferred<T>() {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const shake = () => document.querySelector('[data-shake]')?.getAttribute('data-shake') ?? null

it('checks the email when she leaves the field, marking it invalid', () => {
  render(<StudentSignIn next="/start" />)
  const email = screen.getByLabelText('Your email')
  // Leaving it empty is not yet a mistake.
  fireEvent.blur(email)
  expect(email).not.toHaveAttribute('aria-invalid')
  fill('Your email', 'a@b')
  fireEvent.blur(email)
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(email).toHaveAccessibleDescription('Enter an email like name@company.com.')
  fill('Your email', 'a@b.test')
  expect(email).not.toHaveAttribute('aria-invalid')
  expect(email).toHaveAccessibleDescription('We send a six-digit code. No password.')
})

it('asks for an email when sent empty, and shakes the card at each failed try', async () => {
  render(<StudentSignIn next="/start" />)
  expect(shake()).toBeNull()
  await press('Send me a code')
  const email = screen.getByLabelText('Your email')
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(email).toHaveAccessibleDescription('Enter your email.')
  expect(email).toHaveFocus()
  expect(shake()).toBe('a')
  await press('Send me a code')
  expect(shake()).toBe('b')
  await press('Send me a code')
  expect(shake()).toBe('a')
  expect(sendVerificationOtp).not.toHaveBeenCalled()
})

it('shakes the card when the server refuses, with its message in the error block', async () => {
  refuseWith('INVALID_OTP')
  await toCodeStep()
  fill('Six-digit code', '000000')
  await press('Sign in')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'That code is wrong. Check the email and try again.',
  )
  expect(shake()).toBe('a')
  await press('Sign in')
  expect(shake()).toBe('b')
})

it('asks for the six digits before sending a code that is not six digits', async () => {
  await toCodeStep()
  fill('Six-digit code', '123')
  await press('Sign in')
  const code = screen.getByLabelText('Six-digit code')
  expect(code).toHaveAttribute('aria-invalid', 'true')
  expect(code).toHaveAccessibleDescription('Enter the six-digit code.')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(emailOtpSignIn).not.toHaveBeenCalled()
})

it("shows the sign-in page's own message in the error block", () => {
  render(<StudentSignIn next="/start" notice="Google sign-in did not finish. Try again." />)
  expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in did not finish. Try again.')
})

it('says it is sending, holding the field, then asks for the code', async () => {
  const send = deferred<Awaited<ReturnType<typeof sent>>>()
  sendVerificationOtp.mockImplementation(() => send.promise)
  render(<StudentSignIn next="/start" />)
  fill('Your email', 'a@b.test')
  await press('Send me a code')
  const busy = screen.getByRole('button', { name: 'Sending…' })
  expect(busy).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByLabelText('Your email')).toHaveAttribute('readonly')
  expect(screen.getByRole('status')).toHaveTextContent('Sending the code')
  await act(async () => send.settle({ data: { success: true }, error: null }))
  expect(screen.getByLabelText('Six-digit code')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
})

it('says it is signing in, then that she is signed in, before the page changes', async () => {
  const check = deferred<Awaited<ReturnType<typeof signedIn>>>()
  emailOtpSignIn.mockImplementation(() => check.promise)
  await toCodeStep()
  fill('Six-digit code', '123456')
  await press('Sign in')
  expect(screen.getByRole('button', { name: 'Signing in…' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(screen.getByLabelText('Six-digit code')).toHaveAttribute('readonly')
  expect(screen.getByRole('status')).toHaveTextContent('Signing in')
  await act(async () => check.settle({ data: {}, error: null }))
  expect(screen.getByRole('button', { name: 'Signed in' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Signed in')
  expect(replace).toHaveBeenCalledWith('/start')
})
