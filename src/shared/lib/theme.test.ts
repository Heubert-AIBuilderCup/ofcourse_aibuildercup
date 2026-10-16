import { describe, expect, it } from 'bun:test'
import { parseTheme, parseThemeChoice, resolveTheme, toggledChoice } from './theme'

describe('parseThemeChoice', () => {
  it('reads the stored choice', () => {
    expect(parseThemeChoice('light')).toBe('light')
    expect(parseThemeChoice('dark')).toBe('dark')
    expect(parseThemeChoice('system')).toBe('system')
  })

  it('follows the phone for a missing or tampered cookie', () => {
    expect(parseThemeChoice(undefined)).toBe('system')
    expect(parseThemeChoice('"><script>')).toBe('system')
  })
})

describe('parseTheme', () => {
  it('reads only light or dark', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('system')).toBeNull()
    expect(parseTheme(undefined)).toBeNull()
  })
})

describe('resolveTheme', () => {
  it('uses an explicit choice over the phone', () => {
    expect(resolveTheme('light', 'dark')).toBe('light')
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })

  it('follows the phone when the choice is system', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
    expect(resolveTheme('system', 'light')).toBe('light')
  })

  it('falls back to light before the phone has been read', () => {
    expect(resolveTheme('system', null)).toBe('light')
  })
})

describe('toggledChoice', () => {
  it('flips the theme on screen into the explicit opposite choice', () => {
    expect(toggledChoice('light')).toBe('dark')
    expect(toggledChoice('dark')).toBe('light')
  })
})
