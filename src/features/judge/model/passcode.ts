// The judges' passcode (JUDGE_PASSCODE, from Secret Manager on Cloud Run): unset or empty, judge
// access is off and every attempt is refused. Every attempt counts against its client address
// first, then the passcode is compared in constant time; a wrong one gets one sentence, no hint.
// Pure: the caller passes the environment, the address and the limiter.

import { createHash, timingSafeEqual } from 'node:crypto'
import type { rateLimiter } from '@/shared/lib/rate-limit'

export const WRONG_PASSCODE = "That passcode isn't right."
export const TOO_MANY_TRIES = 'Too many tries. Wait a few minutes, then try again.'

/** About ten attempts per client address in ten minutes. */
export const JUDGE_ATTEMPTS = { limit: 10, windowMs: 10 * 60_000 }

type Env = Record<string, string | undefined>

const configured = (env: Env): string => env.JUDGE_PASSCODE?.trim() ?? ''

/** Whether judge access is on: a passcode is set. Off, no "Judge access" link shows. */
export const judgeAccessOn = (env: Env): boolean => configured(env) !== ''

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * One attempt at the passcode from `address`: counted first, so past the limit even the right
 * passcode is refused and guessing learns nothing; then compared as equal-length digests, so the
 * comparison takes the same time whatever was sent.
 */
export function judgeAttempt(i: {
  env: Env
  passcode: string
  address: string
  hit: ReturnType<typeof rateLimiter>
}): { ok: true } | { ok: false; error: string } {
  const secret = configured(i.env)
  if (secret === '') return { ok: false, error: WRONG_PASSCODE }
  if (!i.hit(`judge:${i.address}`).ok) return { ok: false, error: TOO_MANY_TRIES }
  const right = timingSafeEqual(digest(secret), digest(i.passcode.trim()))
  return right ? { ok: true } : { ok: false, error: WRONG_PASSCODE }
}
