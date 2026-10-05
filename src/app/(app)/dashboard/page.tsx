import type { Metadata } from 'next'
import { ThemeChoice } from '@/shared/components/ThemeChoice'
import { requireSession } from '@/shared/lib/auth/session'
import { SITE_NAME } from '@/shared/lib/site'

export const metadata: Metadata = { title: `Dashboard · ${SITE_NAME}` }

/** The signed-in home. Replace with your app's first screen. */
export default async function DashboardPage() {
  const { user } = await requireSession()
  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-h1 font-semibold tracking-tight">Hello, {user.name}</h1>
        <p className="text-muted-foreground">Signed in as {user.email}.</p>
      </div>
      <ThemeChoice />
    </div>
  )
}
