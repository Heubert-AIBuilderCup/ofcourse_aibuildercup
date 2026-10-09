'use server'

import { cookies } from 'next/headers'
import { parseTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE } from './theme'

// Public on purpose: it sets a display preference on the caller's own browser and nothing else.
// Input is validated to the known values; anything else is ignored.

const cookieOptions = {
  path: '/',
  maxAge: THEME_COOKIE_MAX_AGE,
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}

/** Store the person's choice: light or dark is kept for a year, system clears it (follow the phone). */
export async function setThemeChoice(choice: unknown): Promise<void> {
  const store = await cookies()
  if (choice === 'system') store.delete(THEME_COOKIE)
  else {
    const parsed = parseTheme(typeof choice === 'string' ? choice : undefined)
    if (parsed) store.set(THEME_COOKIE, parsed, cookieOptions)
  }
}
