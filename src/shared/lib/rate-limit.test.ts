import { describe, expect, it } from 'bun:test'
import { clientAddress, rateLimiter } from './rate-limit'

// A fixed window per key, in memory: the limit, the refusal with how long to wait, and the reset.

const MINUTE = 60_000
const T0 = Date.parse('2026-10-11T10:00:00.000Z')

describe('rateLimiter', () => {
  it('allows the limit in a window and refuses the next with the seconds left until it resets', () => {
    const hit = rateLimiter({ limit: 3, windowMs: MINUTE, maxKeys: 10 })
    for (let i = 0; i < 3; i++) expect(hit('a', T0 + i * 1000)).toEqual({ ok: true })
    expect(hit('a', T0 + 15_500)).toEqual({ ok: false, retryAfterSeconds: 45 })
    // Another key has its own count.
    expect(hit('b', T0 + 15_500)).toEqual({ ok: true })
  })

  it('starts a new count once the window has passed', () => {
    const hit = rateLimiter({ limit: 1, windowMs: MINUTE, maxKeys: 10 })
    expect(hit('a', T0)).toEqual({ ok: true })
    expect(hit('a', T0 + MINUTE - 1)).toEqual({ ok: false, retryAfterSeconds: 1 })
    expect(hit('a', T0 + MINUTE)).toEqual({ ok: true })
  })

  it('holds at most maxKeys counts, forgetting the oldest', () => {
    const hit = rateLimiter({ limit: 1, windowMs: MINUTE, maxKeys: 2 })
    hit('a', T0)
    hit('b', T0)
    hit('c', T0)
    // "a" was forgotten, so it counts afresh; "c" is still counted.
    expect(hit('a', T0 + 1)).toEqual({ ok: true })
    expect(hit('c', T0 + 1).ok).toBe(false)
  })
})

describe('clientAddress (SR9)', () => {
  it('is the address the platform appended: the last x-forwarded-for entry, trimmed', () => {
    expect(clientAddress(new Headers({ 'x-forwarded-for': ' forged , 203.0.113.7 ' }))).toBe(
      '203.0.113.7',
    )
    expect(clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('keeps counting one visitor who rotates the browser-supplied part', () => {
    const hit = rateLimiter({ limit: 2, windowMs: MINUTE, maxKeys: 10 })
    const key = (forged: string) =>
      clientAddress(new Headers({ 'x-forwarded-for': `${forged}, 203.0.113.7` }))
    expect(hit(key('10.0.0.1'), T0)).toEqual({ ok: true })
    expect(hit(key('10.0.0.2'), T0 + 1)).toEqual({ ok: true })
    expect(hit(key('10.0.0.3'), T0 + 2).ok).toBe(false)
  })

  it('counts TRUSTED_PROXY_HOPS entries from the right', () => {
    const before = process.env.TRUSTED_PROXY_HOPS
    process.env.TRUSTED_PROXY_HOPS = '2'
    try {
      expect(clientAddress(new Headers({ 'x-forwarded-for': 'a, b, c' }))).toBe('b')
    } finally {
      if (before === undefined) delete process.env.TRUSTED_PROXY_HOPS
      else process.env.TRUSTED_PROXY_HOPS = before
    }
  })

  it('falls back to x-real-ip, then to one shared key', () => {
    expect(clientAddress(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientAddress(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown')
    expect(clientAddress(new Headers())).toBe('unknown')
  })
})
