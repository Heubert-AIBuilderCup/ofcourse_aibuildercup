import { describe, expect, it } from 'bun:test'
import { SIGNIN_MESSAGES } from '@/shared/lib/auth/gate'
import { CODE_MESSAGES, codeErrorOf } from './code-messages'

describe('codeErrorOf', () => {
  it.each([
    'INVALID_OTP',
    'OTP_EXPIRED',
    'TOO_MANY_ATTEMPTS',
    'CODE_RECENTLY_SENT',
    'STUDENT_PAGE_ONLY',
  ] as const)('keeps %s', (code) => {
    expect(codeErrorOf({ code })).toBe(code)
  })

  it('sends a suspended account to the suspended page', () => {
    expect(codeErrorOf({ code: 'ACCOUNT_SUSPENDED' })).toBe('suspended')
  })

  it('treats anything else, or no error at all, as a failed send', () => {
    expect(codeErrorOf({ code: 'SOMETHING_ELSE' })).toBe('SEND_FAILED')
    expect(codeErrorOf({})).toBe('SEND_FAILED')
    expect(codeErrorOf(null)).toBe('SEND_FAILED')
    expect(codeErrorOf(undefined)).toBe('SEND_FAILED')
  })
})

describe('CODE_MESSAGES', () => {
  it('says the same thing as the sign-in page for an account that belongs on the admin page', () => {
    expect(CODE_MESSAGES.STUDENT_PAGE_ONLY).toBe(SIGNIN_MESSAGES['student-only'])
  })
})
