// The theme follows the device unless the user picks one. Two cookies, both plain and
// non-sensitive: the user's choice, and the device's scheme as last seen by the browser, so
// the server renders the right `data-theme` on every request after the first.

export const THEME_COOKIE = 'theme'
export const SYSTEM_THEME_COOKIE = 'theme-os'
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const THEMES = ['light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export type ThemeChoice = Theme | 'system'

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

/** The stored choice; anything missing or unrecognised means follow the phone. */
export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return parseTheme(value) ?? 'system'
}

export function resolveTheme(choice: ThemeChoice, system: Theme | null): Theme {
  return choice === 'system' ? (system ?? 'light') : choice
}
