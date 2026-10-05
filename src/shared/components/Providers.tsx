'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Toaster } from '@/shared/components/ui/sonner'
import { resolveTheme, type Theme, type ThemeChoice } from '@/shared/lib/theme'
import { rememberSystemTheme, saveThemeChoice } from '@/shared/lib/theme-actions'

type ThemeState = {
  /** What the person picked: light, dark, or system (follow the phone). */
  choice: ThemeChoice
  /** What is showing. */
  theme: Theme
  setChoice: (choice: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

/** The theme and the user's choice, for a theme switch (ThemeChoice). */
export function useThemeChoice(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error('useThemeChoice must be used inside <Providers>')
  return state
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

type ProvidersProps = {
  initialChoice: ThemeChoice
  /** The device's scheme as the server last heard it (a cookie), or null on a first visit. */
  systemTheme: Theme | null
  children: ReactNode
}

/** App-wide client state: the theme that follows the device, and the toaster. */
export function Providers({ initialChoice, systemTheme, children }: ProvidersProps) {
  const [choice, setChoiceState] = useState(initialChoice)
  const [system, setSystem] = useState<Theme | null>(systemTheme)
  const theme = resolveTheme(choice, system)

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

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    void saveThemeChoice(next)
  }, [])

  const value = useMemo(() => ({ choice, theme, setChoice }), [choice, theme, setChoice])

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Toaster theme={theme} position="top-center" />
    </ThemeContext.Provider>
  )
}
