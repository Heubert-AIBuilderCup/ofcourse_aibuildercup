import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { designSystem } from '@/design-systems'
import { SPLASH_SEEN_SCRIPT, Splash } from '@/features/opening'
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
      <head>
        {/* Before the first paint: a tab that has seen the splash never draws it (splash-seen.ts). */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from a constant key, no input reaches it */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers initialChoice={choice} systemTheme={system}>
          {children}
        </Providers>
        {/* In front of every page but the admin's, on the tab's first page only (Splash.tsx). */}
        <Splash />
      </body>
    </html>
  )
}
