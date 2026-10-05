'use server'

import { cookies } from 'next/headers'
import {
  parseTheme,
  parseThemeChoice,
  SYSTEM_THEME_COOKIE,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
} from './theme'

// Public on purpose: each sets a display preference on the caller's own browser and nothing
// else. Input is validated to the three known values; anything else is ignored.

const cookieOptions = {
  path: '/',
  maxAge: THEME_COOKIE_MAX_AGE,
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}

/** Store the user's theme choice; `system` clears it so the theme follows the device again. */
export async function saveThemeChoice(choice: unknown): Promise<void> {
  const parsed = parseThemeChoice(typeof choice === 'string' ? choice : undefined)
  const store = await cookies()
  if (parsed === 'system') store.delete(THEME_COOKIE)
  else store.set(THEME_COOKIE, parsed, cookieOptions)
}

/** Remember the phone's colour scheme, so the next page renders in it from the server. */
export async function rememberSystemTheme(theme: unknown): Promise<void> {
  const parsed = parseTheme(typeof theme === 'string' ? theme : undefined)
  if (parsed) (await cookies()).set(SYSTEM_THEME_COOKIE, parsed, cookieOptions)
}
