// The email-code plugin's rate limit, which Better Auth applies when its limiter is on (in
// production). Its default, three requests a minute, would refuse a student's fourth try
// before the five tries a code allows (the intent's criterion 11). Reads the configured plugin;
// nothing here queries the database.

import { beforeAll, describe, expect, mock, test } from 'bun:test'

// auth/index.ts sends codes through email/sign-in-code.ts, which is 'server-only' (it throws
// outside Next's server build).
mock.module('server-only', () => ({}))

type PathLimit = { pathMatcher: (path: string) => boolean; window: number; max: number }

describe('the email-code rate limit', () => {
  const env = process.env as Record<string, string | undefined>
  let limits: PathLimit[]

  const limitFor = (path: string) => {
    const found = limits.find((limit) => limit.pathMatcher(path))
    if (!found) throw new Error(`No rate limit for ${path}`)
    return found
  }

  beforeAll(async () => {
    // Better Auth needs a base URL to build its context, read when the module loads.
    env.BETTER_AUTH_URL ||= 'http://localhost:3000'
    const { auth } = await import('@/shared/lib/auth')
    const plugin = auth.options.plugins?.find((candidate) => candidate.id === 'email-otp')
    limits = (plugin?.rateLimit ?? []) as PathLimit[]
  })

  test('the plugin is configured with a rate limit', () => {
    expect(limits.length).toBeGreaterThan(0)
  })

  test('a minute allows the five tries of a code and a resend on the sign-in path', () => {
    const limit = limitFor('/sign-in/email-otp')
    expect(limit.window).toBe(60)
    expect(limit.max).toBeGreaterThanOrEqual(6)
  })

  test('a minute allows a resend and its retries on the send path', () => {
    const limit = limitFor('/email-otp/send-verification-otp')
    expect(limit.window).toBe(60)
    expect(limit.max).toBeGreaterThanOrEqual(6)
  })
})
