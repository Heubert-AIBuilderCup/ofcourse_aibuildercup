'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { Toaster } from '@/shared/components/ui/sonner'
import { resolveTheme, type Theme, type ThemeChoice } from '@/shared/lib/theme'
import { rememberSystemTheme } from '@/shared/lib/theme-actions'

const DARK_QUERY = '(prefers-color-scheme: dark)'

type ProvidersProps = {
  /** What the person picked (a cookie): light, dark, or system (follow the phone). */
  initialChoice: ThemeChoice
  /** The device's scheme as the server last heard it (a cookie), or null on a first visit. */
  systemTheme: Theme | null
  children: ReactNode
}

/** App-wide client state: the theme that follows the device, and the toaster. */
export function Providers({ initialChoice, systemTheme, children }: ProvidersProps) {
  const [system, setSystem] = useState<Theme | null>(systemTheme)
  const theme = resolveTheme(initialChoice, system)

  // Subscribe to the device's colour scheme; when it differs from what the server knows, store it
  // so the next page renders in it without a flash.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    let known = systemTheme
    const read = () => {
      const next: Theme = query.matches ? 'dark' : 'light'
      setSystem(next)
      if (next !== known) {
        known = next
        void rememberSystemTheme(next)
      }
    }
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [systemTheme])

  // globals.css switches on <html data-theme>, which sits outside this tree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <>
      {children}
      <Toaster theme={theme} position="top-center" />
    </>
  )
}
