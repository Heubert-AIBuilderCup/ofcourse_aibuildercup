// The public theme action: only light or dark is ever stored, and `system` clears the choice.
// Anything else a caller sends sets nothing (security.md §2, §3).

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from './theme'

const set = mock((_name: string, _value: string, _options: object) => {})
const del = mock((_name: string) => {})
mock.module('next/headers', () => ({ cookies: async () => ({ set, delete: del }) }))

// Component tests replace this module with a mock for the whole run (Bun keeps module mocks
// across files), so the query makes Bun load the real file as its own module.
const real = './theme-actions.ts?real'
const { setThemeChoice } = (await import(real)) as typeof import('./theme-actions')

const options = expect.objectContaining({
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: THEME_COOKIE_MAX_AGE,
})
const junk: unknown[] = ['x', 3, {}, undefined]

afterEach(() => {
  set.mockClear()
  del.mockClear()
})

it('keeps the cookie a year', () => {
  expect(THEME_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365)
})

describe('setThemeChoice', () => {
  it.each(['light', 'dark'])('stores %s', async (value) => {
    await setThemeChoice(value)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith(THEME_COOKIE, value, options)
    expect(del).not.toHaveBeenCalled()
  })

  it('clears the choice on system', async () => {
    await setThemeChoice('system')
    expect(del).toHaveBeenCalledTimes(1)
    expect(del).toHaveBeenCalledWith(THEME_COOKIE)
    expect(set).not.toHaveBeenCalled()
  })

  it.each(junk)('ignores %p', async (value) => {
    await setThemeChoice(value)
    expect(set).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })
})
