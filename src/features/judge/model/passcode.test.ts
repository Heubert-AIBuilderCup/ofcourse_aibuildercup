// The judges' passcode: off without one, a wrong one refused with the one sentence, attempts
// counted per address, and the right one let through.

import { describe, expect, test } from 'bun:test'
import { rateLimiter } from '@/shared/lib/rate-limit'
import {
  JUDGE_ATTEMPTS,
  judgeAccessOn,
  judgeAttempt,
  TOO_MANY_TRIES,
  WRONG_PASSCODE,
} from './passcode'

const limiter = () => rateLimiter({ ...JUDGE_ATTEMPTS, maxKeys: 100 })

describe('judgeAccessOn', () => {
  test('is off with no passcode, an empty one or only spaces', () => {
    expect(judgeAccessOn({})).toBe(false)
    expect(judgeAccessOn({ JUDGE_PASSCODE: '' })).toBe(false)
    expect(judgeAccessOn({ JUDGE_PASSCODE: '   ' })).toBe(false)
  })

  test('is on with a passcode', () => {
    expect(judgeAccessOn({ JUDGE_PASSCODE: 'cup-2026' })).toBe(true)
  })
})

describe('judgeAttempt', () => {
  const env = { JUDGE_PASSCODE: 'cup-2026' }

  test('refuses every passcode while access is off, the right-looking one too', () => {
    const hit = limiter()
    for (const passcode of ['', 'cup-2026', 'anything']) {
      expect(judgeAttempt({ env: {}, passcode, address: 'a', hit })).toEqual({
        ok: false,
        error: WRONG_PASSCODE,
      })
    }
  })

  test('a wrong passcode is refused with the one sentence, with no hint', () => {
    const hit = limiter()
    expect(WRONG_PASSCODE).toBe("That passcode isn't right.")
    for (const passcode of ['', 'cup-202', 'cup-20266', 'CUP-2026']) {
      expect(judgeAttempt({ env, passcode, address: 'a', hit })).toEqual({
        ok: false,
        error: WRONG_PASSCODE,
      })
    }
  })

  test('the right passcode goes through, around spaces too', () => {
    const hit = limiter()
    expect(judgeAttempt({ env, passcode: 'cup-2026', address: 'a', hit })).toEqual({ ok: true })
    expect(judgeAttempt({ env, passcode: ' cup-2026 ', address: 'a', hit })).toEqual({ ok: true })
  })

  test('past ten attempts from one address in ten minutes even the right one is refused', () => {
    const hit = limiter()
    for (let i = 0; i < JUDGE_ATTEMPTS.limit; i++) {
      expect(judgeAttempt({ env, passcode: `wrong-${i}`, address: 'a', hit }).ok).toBe(false)
    }
    expect(judgeAttempt({ env, passcode: 'cup-2026', address: 'a', hit })).toEqual({
      ok: false,
      error: TOO_MANY_TRIES,
    })
    // Another address keeps its own count.
    expect(judgeAttempt({ env, passcode: 'cup-2026', address: 'b', hit })).toEqual({ ok: true })
    expect(JUDGE_ATTEMPTS).toEqual({ limit: 10, windowMs: 10 * 60_000 })
  })
})
