import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { designSystem } from '@/design-systems'
import { Providers } from '@/shared/components/Providers'
import { SITE_NAME } from '@/shared/lib/site'
import {
  parseTheme,
  parseThemeChoice,
  resolveTheme,
  SYSTEM_THEME_COOKIE,
  THEME_COOKIE,
} from '@/shared/lib/theme'

export const metadata: Metadata = { title: SITE_NAME, description: `${SITE_NAME}.` }

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const store = await cookies()
  const choice = parseThemeChoice(store.get(THEME_COOKIE)?.value)
  const system = parseTheme(store.get(SYSTEM_THEME_COOKIE)?.value)
  return (
    <html
      lang="en"
      data-theme={resolveTheme(choice, system)}
      className={designSystem.fontClassName}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        <Providers initialChoice={choice} systemTheme={system}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
