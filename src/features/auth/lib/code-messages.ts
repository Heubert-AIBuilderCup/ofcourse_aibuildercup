// What the student sign-in page says about an email code. Pure, so the page and its tests share it.

import { ACCOUNT_SUSPENDED, SIGNIN_MESSAGES } from '@/shared/lib/auth/gate'

export type CodeError =
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'CODE_RECENTLY_SENT'
  | 'STUDENT_PAGE_ONLY'
  | 'SEND_FAILED'
  | 'SIGN_IN_FAILED'
  | 'INVALID_EMAIL'

export const CODE_MESSAGES: Record<CodeError, string> = {
  INVALID_OTP: 'That code is wrong. Check the email and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  TOO_MANY_ATTEMPTS: 'That code no longer works. Send a new one.',
  CODE_RECENTLY_SENT: 'Wait 30 seconds before asking for a new code.',
  STUDENT_PAGE_ONLY: SIGNIN_MESSAGES['student-only'],
  SEND_FAILED: "We couldn't send the code. Try again.",
  SIGN_IN_FAILED: "We couldn't sign you in. Try again.",
  INVALID_EMAIL: 'Enter a valid email address.',
}

/** Wrong codes before a code stops working (the server's allowedAttempts, auth/index.ts). */
export const MAX_WRONG_CODES = 5
/** How long after a send a new code may be asked for (the server's resend guard). */
export const RESEND_WAIT_SECONDS = 30
/** How long a code works (the server's SIGN_IN_CODE_TTL_SECONDS, which is server-only). */
export const CODE_LIFETIME_SECONDS = 600

// The server's codes this page has its own words for.
const SERVER_CODES: readonly CodeError[] = [
  'INVALID_OTP',
  'OTP_EXPIRED',
  'TOO_MANY_ATTEMPTS',
  'CODE_RECENTLY_SENT',
  'STUDENT_PAGE_ONLY',
]

const isServerCode = (code: string | undefined): code is CodeError =>
  code !== undefined && (SERVER_CODES as readonly string[]).includes(code)

/**
 * One of our errors for a Better Auth client error ({ code?, status? }); a suspended account is
 * 'suspended', for the suspended page. Anything unknown is a failed send, so the server's own
 * wording is never shown.
 */
export function codeErrorOf(error: { code?: string } | null | undefined): CodeError | 'suspended' {
  const code = error?.code
  if (code === ACCOUNT_SUSPENDED) return 'suspended'
  return isServerCode(code) ? code : 'SEND_FAILED'
}
